import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminRequestAuthorized, adminUnauthorizedJson } from "@/lib/adminAuth";
import { isMatterEmailEnabled, MATTER_EMAIL_DISABLED_MESSAGE } from "@/lib/graph/matterEmailConfig";
import { graphApiBase, graphFetchJson } from "@/lib/graph/client";
import { getGraphAuthConfig } from "@/lib/graph/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const enc = encodeURIComponent;

// Delete an email = move it to the mailbox's Deleted Items in Outlook (a REVERSIBLE soft delete — never
// a hard delete/purge). Mirrors Outlook's Delete. Flag-gated, admin-only, requires confirmDelete. The
// local copies are FLAGGED deletedLocal=true (not removed) so they show under the "Deleted Items" folder
// in our inbox, matching Outlook.
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

  // Flag local copies deletedLocal=true so they move to the "Deleted Items" folder in our inbox view
  // (reversible, mirrors Outlook). We keep the rows so the Deleted Items folder has contents.
  try {
    if (graphMessageId) await prisma.emailMessage.updateMany({ where: { graphMessageId }, data: { deletedLocal: true } });
    else await prisma.emailMessage.update({ where: { id: messageId }, data: { deletedLocal: true } });
  } catch {
    /* non-fatal — Graph move already succeeded */
  }

  return NextResponse.json({ ok: true, deleted: true });
}
