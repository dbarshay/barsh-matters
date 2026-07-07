import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminRequestAuthorized, adminUnauthorizedJson } from "@/lib/adminAuth";
import { isMatterEmailEnabled, MATTER_EMAIL_DISABLED_MESSAGE } from "@/lib/graph/matterEmailConfig";
import { graphApiBase, graphFetchJson } from "@/lib/graph/client";
import { getGraphAuthConfig } from "@/lib/graph/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const enc = encodeURIComponent;

// Mark an inbound email read/unread (Outlook opens a message = read). Updates Microsoft Graph + the
// local copy so the unread badge stays in sync. Flag-gated + admin-only.
//   POST { messageId, isRead? (default true) }
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
  const isRead = body?.isRead === false ? false : true;

  const rec = await prisma.emailMessage.findUnique({
    where: { id: messageId },
    select: { graphMessageId: true, conversationId: true, mailboxUserId: true },
  });
  if (!rec) return NextResponse.json({ ok: false, error: "Message not found." }, { status: 404 });

  const mailbox = String(rec.mailboxUserId || (getGraphAuthConfig() as any)?.mailboxUserId || "").trim();
  const graphMessageId = String(rec.graphMessageId || "").trim();

  // Best-effort Graph update (keeps Outlook in sync); local update is what drives our badge.
  if (mailbox && graphMessageId) {
    await graphFetchJson({
      url: `${graphApiBase()}/users/${enc(mailbox)}/messages/${enc(graphMessageId)}`,
      method: "PATCH",
      body: { isRead },
    }).catch(() => null);
  }

  // Update every local copy of this message (thread/message duplication) + all copies in the conversation
  // when marking read is triggered by opening (so duplicates don't keep the badge lit).
  await prisma.emailMessage.updateMany({
    where: graphMessageId ? { graphMessageId } : { id: messageId },
    data: { isRead },
  });

  return NextResponse.json({ ok: true, isRead });
}
