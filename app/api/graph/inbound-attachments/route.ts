import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { isAdminRequestAuthorized, adminUnauthorizedJson, adminSessionIdentityDiagnostics } from "@/lib/adminAuth";
import { isInboundAttachmentOcrEnabled, INBOUND_ATTACHMENT_OCR_DISABLED_MESSAGE } from "@/lib/graph/inboundOcrConfig";
import { graphApiBase, graphFetchJson } from "@/lib/graph/client";
import { getGraphAuthConfig } from "@/lib/graph/config";
import { getClioStorageWriteGuard } from "@/lib/clioStorageWriteGuard";
import { resolveClioMatterFolderWithGuard } from "@/lib/clioFolderResolverExecutor";
import { uploadBufferToClioMatterDocuments } from "@/lib/clioDocumentUpload";
import { fileDocument } from "@/lib/documents/fileDocument";
import type { ClioStorageTargetInput } from "@/lib/clioStoragePlan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Phase D — inbound email attachment OCR review queue.
//   GET  ?matterId= | masterLawsuitId= | matterDisplayNumber=   → list pending inbound attachments
//   POST { action: "dismiss", attachmentId }                    → operator declines (no Clio write)
//   POST { action: "file", attachmentId, folderKey, titleKey, fields?, freehandTitle?, confirmFile: true }
//        → re-fetch bytes from Graph, upload to Clio (guarded), file the BM doc, mark filed
// Flag-gated + admin-only. Filing is per-document and requires confirmFile — nothing files silently.

const enc = encodeURIComponent;

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const matterId = Number(sp.get("matterId"));
  const masterLawsuitId = (sp.get("masterLawsuitId") || "").trim();
  const matterDisplayNumber = (sp.get("matterDisplayNumber") || "").trim();

  const threadWhere: any = {};
  if (Number.isFinite(matterId) && matterId > 0) threadWhere.matterId = matterId;
  else if (masterLawsuitId) threadWhere.masterLawsuitId = masterLawsuitId;
  else if (matterDisplayNumber) threadWhere.matterDisplayNumber = matterDisplayNumber;
  else return NextResponse.json({ ok: false, error: "matterId, masterLawsuitId, or matterDisplayNumber required." }, { status: 400 });

  try {
    const rows = await prisma.emailAttachment.findMany({
      where: {
        reviewStatus: "pending",
        message: { direction: "inbound", thread: threadWhere },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        contentType: true,
        sizeBytes: true,
        ocrSuggestion: true,
        ocrPredictedMatterId: true,
        createdAt: true,
        message: {
          select: {
            subject: true,
            fromEmail: true,
            receivedAt: true,
            thread: { select: { matterId: true, matterDisplayNumber: true, masterLawsuitId: true } },
          },
        },
      },
    });
    return NextResponse.json({ ok: true, count: rows.length, attachments: rows });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Could not load inbound attachments." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!isInboundAttachmentOcrEnabled()) {
    return NextResponse.json({ ok: false, error: INBOUND_ATTACHMENT_OCR_DISABLED_MESSAGE }, { status: 403 });
  }
  if (!isAdminRequestAuthorized(req)) return adminUnauthorizedJson();

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const action = String(body?.action || "").trim();
  const attachmentId = String(body?.attachmentId || "").trim();
  if (!attachmentId) return NextResponse.json({ ok: false, error: "attachmentId required." }, { status: 400 });

  let identity: any = null;
  try {
    identity = adminSessionIdentityDiagnostics(req);
  } catch {
    identity = null;
  }

  const record = await prisma.emailAttachment.findUnique({
    where: { id: attachmentId },
    select: {
      id: true,
      name: true,
      contentType: true,
      reviewStatus: true,
      graphAttachmentId: true,
      ocrExtractionId: true,
      message: {
        select: {
          graphMessageId: true,
          mailboxUserId: true,
          thread: { select: { matterId: true, matterDisplayNumber: true, masterLawsuitId: true } },
        },
      },
    },
  });
  if (!record) return NextResponse.json({ ok: false, error: "Attachment not found." }, { status: 404 });
  if (record.reviewStatus === "filed") return NextResponse.json({ ok: false, error: "This attachment is already filed." }, { status: 409 });

  if (action === "dismiss") {
    await prisma.emailAttachment.update({
      where: { id: attachmentId },
      data: { reviewStatus: "dismissed", reviewedAt: new Date(), reviewedBy: identity?.email || null },
    });
    return NextResponse.json({ ok: true, dismissed: true });
  }

  if (action !== "file") {
    return NextResponse.json({ ok: false, error: "Unknown action. Use 'file' or 'dismiss'." }, { status: 400 });
  }

  if (body?.confirmFile !== true) {
    return NextResponse.json({ ok: false, error: "Filing not confirmed. Set confirmFile=true." }, { status: 400 });
  }

  const folderKey = String(body?.folderKey || "").trim();
  const titleKey = String(body?.titleKey || "").trim();
  const freehandTitle = body?.freehandTitle ? String(body.freehandTitle) : null;
  const level = body?.level ? String(body.level) : null;
  const fields = body?.fields && typeof body.fields === "object" ? (body.fields as Record<string, unknown>) : {};
  if (!folderKey || !titleKey) return NextResponse.json({ ok: false, error: "Folder and title are required." }, { status: 400 });

  const matterId = Number(record.message?.thread?.matterId);
  const matterDisplayNumber = String(record.message?.thread?.matterDisplayNumber || "").trim();
  if (!Number.isFinite(matterId) || matterId <= 0 || !/^BRL_\d{9}$/.test(matterDisplayNumber)) {
    return NextResponse.json(
      { ok: false, error: "This attachment's email is not linked to an individual matter (BRL_) — file it from the matter it belongs to." },
      { status: 400 },
    );
  }

  const mailbox = String(record.message?.mailboxUserId || (getGraphAuthConfig() as any)?.mailboxUserId || "").trim();
  const graphMessageId = String(record.message?.graphMessageId || "").trim();
  const graphAttachmentId = String(record.graphAttachmentId || "").trim();
  if (!mailbox || !graphMessageId || !graphAttachmentId) {
    return NextResponse.json({ ok: false, error: "Missing Graph identifiers to fetch this attachment." }, { status: 400 });
  }

  // Re-fetch the attachment bytes from Graph (source of truth — we never persisted the bytes).
  const att = await graphFetchJson({
    url: `${graphApiBase()}/users/${enc(mailbox)}/messages/${enc(graphMessageId)}/attachments/${enc(graphAttachmentId)}`,
    method: "GET",
  });
  if (!att.ok) return NextResponse.json({ ok: false, error: `Could not fetch attachment from Graph: ${att.error}` }, { status: 502 });
  const contentBytes = typeof att.json?.contentBytes === "string" ? att.json.contentBytes : "";
  if (!contentBytes) return NextResponse.json({ ok: false, error: "Attachment has no downloadable content." }, { status: 502 });

  let buffer: Buffer;
  try {
    buffer = Buffer.from(contentBytes, "base64");
  } catch {
    return NextResponse.json({ ok: false, error: "Could not decode attachment bytes." }, { status: 400 });
  }
  if (buffer.length === 0) return NextResponse.json({ ok: false, error: "Attachment downloaded as an empty file." }, { status: 400 });
  const fileHash = crypto.createHash("sha256").update(buffer).digest("hex");
  const contentType = String(record.contentType || att.json?.contentType || "application/octet-stream");
  const fileName = record.name || `${matterDisplayNumber}-email-attachment`;

  // Duplicate pre-check BEFORE any Clio upload.
  if (body?.confirmDuplicate !== true) {
    const existing = await prisma.filedDocument.findFirst({
      where: { matterId, fileHash, status: "active" },
      select: { id: true, titleLabel: true },
    });
    if (existing) {
      return NextResponse.json(
        { ok: false, duplicate: true, error: `This exact file is already filed on ${matterDisplayNumber} as "${existing.titleLabel}". Re-submit to file it anyway.`, existing },
        { status: 409 },
      );
    }
  }

  // Live Clio write guard — fail closed if any flag is off (no upload, no DB write).
  const guard = getClioStorageWriteGuard();
  if (!guard.uploadRewireEnabled || !guard.createFoldersEnabled || !guard.liveClioWriteEnabled) {
    return NextResponse.json(
      {
        ok: false,
        clioWriteDisabled: true,
        error:
          "Live Clio upload is disabled. Set CLIO_SINGLE_MASTER_UPLOAD_REWIRE_ENABLED=1, CLIO_SINGLE_MASTER_CREATE_FOLDERS_ENABLED=1, and CLIO_SINGLE_MASTER_LIVE_WRITE_ENABLED=1 to enable. Nothing was filed.",
      },
      { status: 403 },
    );
  }

  // Resolve/create the matter folder, upload bytes to Clio.
  let clioDocumentId: string;
  try {
    const targetInput: ClioStorageTargetInput = {
      storageTargetKind: "individual_matter",
      directMatterFileNumber: matterDisplayNumber,
      bmMatterId: matterDisplayNumber,
      displayNumber: matterDisplayNumber,
    };
    const resolution: any = await resolveClioMatterFolderWithGuard(targetInput);
    const uploadFolderId = Number(resolution?.folderId);
    const masterMatterId = Number(resolution?.targetPlan?.masterMatterId);
    if (!Number.isFinite(uploadFolderId) || uploadFolderId <= 0) throw new Error("Could not resolve a valid Clio folder for this matter.");
    if (!Number.isFinite(masterMatterId) || masterMatterId <= 0) throw new Error("Could not resolve the Clio master matter id.");
    const uploaded = await uploadBufferToClioMatterDocuments({
      matterId: masterMatterId,
      filename: fileName,
      buffer,
      contentType,
      parentType: "Folder",
      parentId: uploadFolderId,
    });
    clioDocumentId = String(uploaded.documentId);
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: `Clio upload failed: ${err?.message || "unknown error"}` }, { status: 502 });
  }

  // Record the BM filing (taxonomy enforced, label dedup, audit). sourceType marks the email origin.
  const filed = await fileDocument(prisma, {
    matterId,
    matterDisplayNumber,
    clioDocumentId,
    folderKey,
    titleKey,
    level,
    freehandTitle,
    fields,
    fileName,
    contentType,
    fileHash,
    sourceType: "email_attachment",
    ocrExtractionId: record.ocrExtractionId || null,
    confirmDuplicate: true,
    actorName: identity?.email || identity?.userId || null,
    actorEmail: identity?.email || null,
  } as any);

  if (!("ok" in filed) || !filed.ok) {
    return NextResponse.json(
      { ok: false, error: (filed as any)?.error || "Filing failed after upload.", clioDocumentId, note: "File was uploaded to Clio but the BM filing record failed." },
      { status: (filed as any)?.status || 500 },
    );
  }

  // Mark the attachment filed + link it to the filed document and the Clio doc.
  await prisma.emailAttachment.update({
    where: { id: attachmentId },
    data: {
      reviewStatus: "filed",
      filedDocumentId: (filed as any).document?.id || null,
      clioDocumentId,
      clioDocumentName: fileName,
      storageStatus: "clio_vault",
      reviewedAt: new Date(),
      reviewedBy: identity?.email || null,
    },
  });

  // Backfill the OCR extraction row with the real Clio document id (best-effort).
  try {
    if (record.ocrExtractionId) {
      await prisma.ocrExtraction.update({ where: { id: record.ocrExtractionId }, data: { clioDocumentId, matterId, matterDisplayNumber } });
    } else if (fileHash) {
      await prisma.ocrExtraction.updateMany({ where: { fileHash, clioDocumentId: null }, data: { clioDocumentId, matterId, matterDisplayNumber } });
    }
  } catch {
    /* non-fatal */
  }

  return NextResponse.json({ ok: true, filed: (filed as any).document, clioDocumentId, matterDisplayNumber });
}
