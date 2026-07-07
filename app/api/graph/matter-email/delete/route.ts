import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminRequestAuthorized, adminUnauthorizedJson } from "@/lib/adminAuth";
import { isMatterEmailEnabled, MATTER_EMAIL_DISABLED_MESSAGE } from "@/lib/graph/matterEmailConfig";
import { graphApiBase, graphFetchJson } from "@/lib/graph/client";
import { getGraphAuthConfig } from "@/lib/graph/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const enc = encodeURIComponent;

// Delete an email = move it to the mailbox's Deleted Items (a REVERSIBLE soft delete — never a hard
// delete/purge). Mirrors Outlook's Delete. Flag-gated, admin-only, requires confirmDelete. Also removes
// the local copies so it leaves the Barsh Matters inbox view immediately.
//   POST { messageId, confirmDelete: true }
export async function POST(req: NextRequest) {
  if (!isMatterEmailEnabled()) return NextResponse.json({ ok: false, error: MATTER_EMAIL_DISABLED_MESSAGE }, { status: 403 });
  if (!isAdminRequestAuthorized(req)) return adminUnauthorizedJson();

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }
  const messageId = String(body?.messageId || "").trim();
  if (!messageId) return NextResponse.json({ ok: false, error: "messageId required." }, { status: 400 });
  if (body?.confirmDelete !== true) return NextResponse.json({ ok: false, error: "Delete not confirmed. Set confirmDelete=true." }, { status: 400 });

  const rec = await prisma.emailMessage.findUnique({
    where: { id: messageId },
    select: { graphMessageId: true, mailboxUserId: true },
  });
  if (!rec) return NextResponse.json({ ok: false, error: "Message not found." }, { status: 404 });

  const mailbox = String(rec.mailboxUserId || (getGraphAuthConfig() as any)?.mailboxUserId || "").trim();
  const graphMessageId = String(rec.graphMessageId || "").trim();

  // Move the Graph message to Deleted Items (reversible). Graph DELETE /messages/{id} soft-deletes.
  if (mailbox && graphMessageId) {
    const del = await graphFetchJson({
      url: `${graphApiBase()}/users/${enc(mailbox)}/messages/${enc(graphMessageId)}`,
      method: "DELETE",
    });
    if (!del.ok) return NextResponse.json({ ok: false, error: `Delete failed: ${del.error}` }, { status: 502 });
  }

  // Remove local copies so it disappears from the inbox view. Cascades remove any EmailAttachment rows.
  try {
    if (graphMessageId) await prisma.emailMessage.deleteMany({ where: { graphMessageId } });
    else await prisma.emailMessage.delete({ where: { id: messageId } });
  } catch {
    /* non-fatal — Graph move already succeeded */
  }

  return NextResponse.json({ ok: true, deleted: true });
}
