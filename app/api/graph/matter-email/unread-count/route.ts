import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestUserMailbox } from "@/lib/graph/userMailbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Count of UNREAD INCOMING emails in the LOGGED-IN USER'S OWN mailbox — drives the alert badge on the
// per-matter Emails button and the firm-wide header Emails button (scope=all). Incoming = direction
// inbound; unread = isRead not true; excludes soft-deleted. Read-only, no Graph call.
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const scope = (url.searchParams.get("scope") || "").trim().toLowerCase();
  const matterId = Number(url.searchParams.get("matterId"));
  const masterLawsuitId = (url.searchParams.get("masterLawsuitId") || "").trim();
  const displayNumber = (url.searchParams.get("matterDisplayNumber") || "").trim();

  const userMailbox = getRequestUserMailbox(req);
  if (!userMailbox) return NextResponse.json({ ok: true, unread: 0 });

  const threadWhere: any = {};
  if (scope === "all") {
    threadWhere.OR = [{ matterId: { not: null } }, { masterLawsuitId: { not: null } }, { matterDisplayNumber: { not: null } }];
  } else if (Number.isFinite(matterId) && matterId > 0) threadWhere.matterId = matterId;
  else if (masterLawsuitId) threadWhere.masterLawsuitId = masterLawsuitId;
  else if (displayNumber) threadWhere.matterDisplayNumber = displayNumber;
  else return NextResponse.json({ ok: true, unread: 0 });

  const mailboxWhere = {
    OR: [
      { mailboxUserPrincipalName: { equals: userMailbox, mode: "insensitive" as const } },
      { mailboxUserId: { equals: userMailbox, mode: "insensitive" as const } },
    ],
  };

  try {
    const threads = await prisma.emailThread.findMany({ where: threadWhere, select: { id: true } });
    const threadIds = threads.map((t) => t.id);
    if (threadIds.length === 0) return NextResponse.json({ ok: true, unread: 0 });
    const unread = await prisma.emailMessage.count({
      where: { AND: [{ threadId: { in: threadIds }, direction: "inbound", deletedLocal: false, NOT: { isRead: true } }, mailboxWhere] },
    });
    return NextResponse.json({ ok: true, unread });
  } catch {
    return NextResponse.json({ ok: true, unread: 0 });
  }
}
