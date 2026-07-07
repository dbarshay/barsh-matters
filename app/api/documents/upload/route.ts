import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { isAdminRequestAuthorized, adminUnauthorizedJson } from "@/lib/adminAuth";
import { isUploadDocsEnabled, UPLOAD_DOCS_DISABLED_MESSAGE } from "@/lib/documents/uploadDocsConfig";
import { getClioStorageWriteGuard } from "@/lib/clioStorageWriteGuard";
import { resolveClioMatterFolderWithGuard } from "@/lib/clioFolderResolverExecutor";
import { uploadBufferToClioMatterDocuments } from "@/lib/clioDocumentUpload";
import { fileDocument } from "@/lib/documents/fileDocument";
import type { ClioStorageTargetInput } from "@/lib/clioStoragePlan";
import { adminSessionIdentityDiagnostics } from "@/lib/adminAuth";
import { recordFilingFeedback } from "@/lib/ocr/learning";
import { populateEmptyLawsuitLitigationFields } from "@/lib/documents/populateLitigationFields";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Upload Docs commit: upload a real file into Clio (guarded), then record the BM filing.
// Flow: validate -> (dup pre-check, no Clio call) -> resolve Clio folder (guarded) ->
//       upload buffer to Clio -> fileDocument() BM metadata -> backfill OcrExtraction.clioDocumentId.
//
// Clio is STORAGE ONLY. BM owns the matter/file numbers; folder names never contain PHI.
// The live Clio write only happens when the shared storage guard flags are all on:
//   CLIO_SINGLE_MASTER_UPLOAD_REWIRE_ENABLED=1, CLIO_SINGLE_MASTER_CREATE_FOLDERS_ENABLED=1,
//   CLIO_SINGLE_MASTER_LIVE_WRITE_ENABLED=1  (plus CLIO_SINGLE_MASTER_ROOT_FOLDER_ID + master matter).
// Otherwise we fail closed with a clear 403 and perform NO upload and NO DB write.
export async function POST(req: NextRequest) {
  if (!isUploadDocsEnabled()) {
    return NextResponse.json({ ok: false, error: UPLOAD_DOCS_DISABLED_MESSAGE }, { status: 403 });
  }
  if (!isAdminRequestAuthorized(req)) return adminUnauthorizedJson();

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const matterId = Number(body?.matterId);
  const matterDisplayNumber = String(body?.matterDisplayNumber || "").trim();
  const folderKey = String(body?.folderKey || "").trim();
  const titleKey = String(body?.titleKey || "").trim();
  const freehandTitle = body?.freehandTitle ? String(body.freehandTitle) : null;
  const level = body?.level ? String(body.level) : null;
  const fileName = body?.fileName ? String(body.fileName) : null;
  const contentType = String(body?.contentType || "application/octet-stream");
  const base64 = String(body?.base64 || "");
  const fields =
    body?.fields && typeof body.fields === "object" ? (body.fields as Record<string, unknown>) : {};
  const ocrExtractionId = body?.ocrExtractionId ? String(body.ocrExtractionId) : null;
  const confirmDuplicate = body?.confirmDuplicate === true;
  // Learning signals: what the classifier suggested + the matched entities, so we can record the
  // suggestion-vs-choice and build per-provider/carrier memory. All optional (best-effort).
  const suggestedFolderKey = body?.suggestedFolderKey ? String(body.suggestedFolderKey) : null;
  const suggestedTitleKey = body?.suggestedTitleKey ? String(body.suggestedTitleKey) : null;
  const suggestedConfidence =
    typeof body?.suggestedConfidence === "number" ? body.suggestedConfidence : null;
  const learnProviderName = body?.providerName ? String(body.providerName) : null;
  const learnInsurerName = body?.insurerName ? String(body.insurerName) : null;
  const caseType = body?.caseType ? String(body.caseType) : null;
  // Litigation fields from the scan — used ONLY to populate a lawsuit's empty Date Filed / Index Number.
  const litIndexNumber = body?.indexNumber ? String(body.indexNumber) : null;
  const litDateFiled = body?.dateFiled ? String(body.dateFiled) : null;

  if (!Number.isFinite(matterId) || matterId <= 0) {
    return NextResponse.json({ ok: false, error: "A valid matter is required." }, { status: 400 });
  }
  if (!/^BRL_\d{9}$/.test(matterDisplayNumber)) {
    return NextResponse.json(
      { ok: false, error: "Matter file number must be a Barsh Matters BRL_YYYYNNNNN number." },
      { status: 400 },
    );
  }
  if (!folderKey || !titleKey) {
    return NextResponse.json({ ok: false, error: "Folder and title are required." }, { status: 400 });
  }
  if (!base64) {
    return NextResponse.json({ ok: false, error: "No file provided." }, { status: 400 });
  }

  let buffer: Buffer;
  try {
    buffer = Buffer.from(base64, "base64");
  } catch {
    return NextResponse.json({ ok: false, error: "Could not decode file bytes." }, { status: 400 });
  }
  if (buffer.length === 0) {
    return NextResponse.json({ ok: false, error: "Uploaded file is empty." }, { status: 400 });
  }
  const fileHash = crypto.createHash("sha256").update(buffer).digest("hex");

  // Duplicate pre-check BEFORE any Clio upload, so we never push duplicate bytes to Clio.
  if (!confirmDuplicate) {
    const existing = await prisma.filedDocument.findFirst({
      where: { matterId, fileHash, status: "active" },
      select: { id: true, titleLabel: true, folderKey: true },
    });
    if (existing) {
      return NextResponse.json(
        {
          ok: false,
          duplicate: true,
          error: `This exact file is already filed on ${matterDisplayNumber} as "${existing.titleLabel}". Re-submit to file it anyway.`,
          existing,
        },
        { status: 409 },
      );
    }
  }

  // Live-write guard: fail closed with a precise message if any Clio flag is off.
  const guard = getClioStorageWriteGuard();
  if (!guard.uploadRewireEnabled || !guard.createFoldersEnabled || !guard.liveClioWriteEnabled) {
    return NextResponse.json(
      {
        ok: false,
        clioWriteDisabled: true,
        error:
          "Live Clio upload is disabled. Set CLIO_SINGLE_MASTER_UPLOAD_REWIRE_ENABLED=1, CLIO_SINGLE_MASTER_CREATE_FOLDERS_ENABLED=1, and CLIO_SINGLE_MASTER_LIVE_WRITE_ENABLED=1 to enable. No upload was performed and nothing was recorded.",
        guard: {
          uploadRewireEnabled: guard.uploadRewireEnabled,
          createFoldersEnabled: guard.createFoldersEnabled,
          liveClioWriteEnabled: guard.liveClioWriteEnabled,
        },
      },
      { status: 403 },
    );
  }

  // Resolve (or create) the matter's folder under the single-master storage tree, then upload.
  const targetInput: ClioStorageTargetInput = {
    storageTargetKind: "individual_matter",
    directMatterFileNumber: matterDisplayNumber,
    bmMatterId: matterDisplayNumber,
    displayNumber: matterDisplayNumber,
  };

  let clioDocumentId: string;
  let masterMatterId: number;
  let uploadFolderId: number;
  try {
    const resolution: any = await resolveClioMatterFolderWithGuard(targetInput);
    uploadFolderId = Number(resolution?.folderId);
    masterMatterId = Number(resolution?.targetPlan?.masterMatterId);
    if (!Number.isFinite(uploadFolderId) || uploadFolderId <= 0) {
      throw new Error("Could not resolve a valid Clio folder for this matter.");
    }
    if (!Number.isFinite(masterMatterId) || masterMatterId <= 0) {
      throw new Error("Could not resolve the Clio master matter id.");
    }

    const uploaded = await uploadBufferToClioMatterDocuments({
      matterId: masterMatterId,
      filename: fileName || `${matterDisplayNumber}-document`,
      buffer,
      contentType,
      parentType: "Folder",
      parentId: uploadFolderId,
    });
    clioDocumentId = String(uploaded.documentId);
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: `Clio upload failed: ${err?.message || "unknown error"}` },
      { status: 502 },
    );
  }

  // Record the BM filing (taxonomy enforced server-side, label dedup, audit).
  let identity: any = null;
  try {
    identity = adminSessionIdentityDiagnostics(req);
  } catch {
    identity = null;
  }
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
    sourceType: "upload",
    ocrExtractionId,
    confirmDuplicate: true, // already dup-checked above (and confirmed if the user re-submitted)
    actorName: identity?.email || identity?.userId || null,
    actorEmail: identity?.email || null,
  });

  if (!("ok" in filed) || !filed.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: (filed as any)?.error || "Filing failed after upload.",
        clioDocumentId,
        note: "File was uploaded to Clio but the BM filing record failed.",
      },
      { status: (filed as any)?.status || 500 },
    );
  }

  // Learning: record the classifier suggestion vs the operator's final pick and fold it into the
  // per-provider/carrier memory. Best-effort — never affects the filing result.
  try {
    await recordFilingFeedback(prisma, {
      matterId,
      fileName,
      fileHash,
      ocrExtractionId,
      suggestedFolderKey,
      suggestedTitleKey,
      suggestedConfidence,
      chosenFolderKey: folderKey,
      chosenTitleKey: titleKey,
      caseType,
      providerName: learnProviderName,
      insurerName: learnInsurerName,
      createdById: identity?.email || identity?.userId || null,
    } as any);
  } catch {
    // non-fatal
  }

  // Populate the lawsuit's Date Filed / Index Number from the scan — ONLY when those are blank today
  // (reference-value rule: scans never override existing values). Best-effort.
  try {
    await populateEmptyLawsuitLitigationFields(prisma, {
      matterId,
      indexNumber: litIndexNumber,
      dateFiled: litDateFiled,
      actorEmail: identity?.email || null,
    });
  } catch {
    // non-fatal
  }

  // Backfill the OCR extraction row with the real Clio document id (by id, else by fileHash).
  try {
    if (ocrExtractionId) {
      await prisma.ocrExtraction.update({
        where: { id: ocrExtractionId },
        data: { clioDocumentId, matterId, matterDisplayNumber },
      });
    } else if (fileHash) {
      await prisma.ocrExtraction.updateMany({
        where: { fileHash, clioDocumentId: null },
        data: { clioDocumentId, matterId, matterDisplayNumber },
      });
    }
  } catch {
    // non-fatal: filing already succeeded
  }

  return NextResponse.json({
    ok: true,
    clioDocumentId,
    filed: filed.document,
    matterDisplayNumber,
  });
}
