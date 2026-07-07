import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminRequestAuthorized, adminUnauthorizedJson, adminSessionIdentityDiagnostics } from "@/lib/adminAuth";
import { isMatterEmailEnabled, MATTER_EMAIL_DISABLED_MESSAGE } from "@/lib/graph/matterEmailConfig";
import { sendMatterEmail } from "@/lib/graph/matterEmail";
import { resolveFiledDocumentAttachments } from "@/lib/graph/matterEmailAttachments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Send a native email from a matter via Microsoft Graph. Flag-gated, admin-only, and requires an
// explicit per-send confirmation (`confirmSend: true`) — never sends silently.
function toList(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x || "").trim()).filter(Boolean);
  if (typeof v === "string") return v.split(/[,;]/).map((x) => x.trim()).filter(Boolean);
  return [];
}

function toIdList(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x || "").trim()).filter(Boolean);
  return [];
}

export async function POST(req: NextRequest) {
  if (!isMatterEmailEnabled()) {
    return NextResponse.json({ ok: false, error: MATTER_EMAIL_DISABLED_MESSAGE }, { status: 403 });
  }
  if (!isAdminRequestAuthorized(req)) return adminUnauthorizedJson();

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  if (body?.confirmSend !== true) {
    return NextResponse.json(
      { ok: false, error: "Send not confirmed. Set confirmSend=true to send this email." },
      { status: 400 },
    );
  }

  const to = toList(body?.to);
  const cc = toList(body?.cc);
  const subject = String(body?.subject || "").trim();
  const bodyHtml = String(body?.body ?? body?.bodyHtml ?? "");
  const replyToGraphMessageId = body?.replyToMessageId ? String(body.replyToMessageId) : null;
  // On a reply the recipients + subject come from the original message, so they're optional here.
  if (!replyToGraphMessageId && to.length === 0) return NextResponse.json({ ok: false, error: "At least one recipient (To) is required." }, { status: 400 });
  if (!replyToGraphMessageId && !subject) return NextResponse.json({ ok: false, error: "Subject is required." }, { status: 400 });

  const matterId = Number(body?.matterId);
  const resolvedMatterId = Number.isFinite(matterId) && matterId > 0 ? matterId : null;
  const matterDisplayNumber = body?.matterDisplayNumber ? String(body.matterDisplayNumber) : null;
  const masterLawsuitId = body?.masterLawsuitId ? String(body.masterLawsuitId) : null;

  let actorEmail: string | null = null;
  try {
    actorEmail = adminSessionIdentityDiagnostics(req)?.email || null;
  } catch {
    actorEmail = null;
  }

  // Phase C — resolve + authorize + download any requested filed-document attachments. Scoped to this
  // matter/lawsuit server-side, so a caller can never attach a document filed to a different file.
  const attachmentFiledDocumentIds = toIdList(body?.attachmentFiledDocumentIds);
  let attachments;
  if (attachmentFiledDocumentIds.length) {
    const resolved = await resolveFiledDocumentAttachments(prisma, {
      matterId: resolvedMatterId,
      masterLawsuitId,
      matterDisplayNumber,
      filedDocumentIds: attachmentFiledDocumentIds,
    });
    if (!resolved.ok) return NextResponse.json({ ok: false, error: resolved.error }, { status: 400 });
    attachments = resolved.attachments;
  }

  const result = await sendMatterEmail({
    matterId: resolvedMatterId,
    matterDisplayNumber,
    masterLawsuitId,
    to,
    cc,
    subject,
    bodyHtml,
    actorEmail,
    replyToGraphMessageId,
    attachments,
  });

  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
