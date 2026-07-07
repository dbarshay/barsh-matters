import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminRequestAuthorized, adminUnauthorizedJson } from "@/lib/adminAuth";
import { isInboundAttachmentOcrEnabled, INBOUND_ATTACHMENT_OCR_DISABLED_MESSAGE } from "@/lib/graph/inboundOcrConfig";
import { graphApiBase, graphFetchJson } from "@/lib/graph/client";
import { getGraphAuthConfig } from "@/lib/graph/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const enc = encodeURIComponent;

// Stream an inbound email attachment's bytes INLINE for preview (so the operator can confirm what a
// document is before filing it). Bytes are re-fetched from Microsoft Graph on demand — never persisted.
// Flag-gated + admin-only. Read-only.
//   GET /api/graph/inbound-attachments/preview?attachmentId=<EmailAttachment id>
export async function GET(req: NextRequest) {
  if (!isInboundAttachmentOcrEnabled()) {
    return NextResponse.json({ ok: false, error: INBOUND_ATTACHMENT_OCR_DISABLED_MESSAGE }, { status: 403 });
  }
  if (!isAdminRequestAuthorized(req)) return adminUnauthorizedJson();

  const attachmentId = (req.nextUrl.searchParams.get("attachmentId") || "").trim();
  if (!attachmentId) return NextResponse.json({ ok: false, error: "attachmentId required." }, { status: 400 });

  const rec = await prisma.emailAttachment.findUnique({
    where: { id: attachmentId },
    select: {
      name: true,
      contentType: true,
      graphAttachmentId: true,
      message: { select: { graphMessageId: true, mailboxUserId: true } },
    },
  });
  if (!rec) return NextResponse.json({ ok: false, error: "Attachment not found." }, { status: 404 });

  // Graph calls target the app's configured mailbox; per-message mailboxUserId is often null on synced
  // rows (persist stores mailboxUserPrincipalName), so fall back to the configured mailbox.
  const mailbox = String(rec.message?.mailboxUserId || (getGraphAuthConfig() as any)?.mailboxUserId || "").trim();
  const graphMessageId = String(rec.message?.graphMessageId || "").trim();
  const graphAttachmentId = String(rec.graphAttachmentId || "").trim();
  if (!mailbox || !graphMessageId || !graphAttachmentId) {
    return NextResponse.json({ ok: false, error: "Missing Graph identifiers for this attachment." }, { status: 400 });
  }

  const att = await graphFetchJson({
    url: `${graphApiBase()}/users/${enc(mailbox)}/messages/${enc(graphMessageId)}/attachments/${enc(graphAttachmentId)}`,
    method: "GET",
  });
  if (!att.ok) return NextResponse.json({ ok: false, error: `Graph fetch failed: ${att.error}` }, { status: 502 });
  const contentBytes = typeof att.json?.contentBytes === "string" ? att.json.contentBytes : "";
  if (!contentBytes) return NextResponse.json({ ok: false, error: "Attachment has no content." }, { status: 502 });

  const buffer = Buffer.from(contentBytes, "base64");
  const contentType = String(rec.contentType || att.json?.contentType || "application/octet-stream");
  const safeName = String(rec.name || "attachment").replace(/[\r\n"\\]/g, "_");

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `inline; filename="${safeName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
