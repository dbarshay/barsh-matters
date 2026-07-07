import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Count of UNREAD INCOMING emails for a matter/lawsuit — drives the alert badge on the Emails button.
// Incoming = not sent by us; unread = isRead not true. Read-only, no Graph call (uses synced records).
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const matterId = Number(url.searchParams.get("matterId"));
  const masterLawsuitId = (url.searchParams.get("masterLawsuitId") || "").trim();
  const displayNumber = (url.searchParams.get("matterDisplayNumber") || "").trim();

  const threadWhere: any = {};
  if (Number.isFinite(matterId) && matterId > 0) threadWhere.matterId = matterId;
  else if (masterLawsuitId) threadWhere.masterLawsuitId = masterLawsuitId;
  else if (displayNumber) threadWhere.matterDisplayNumber = displayNumber;
  else return NextResponse.json({ ok: true, unread: 0 });

  try {
    const threads = await prisma.emailThread.findMany({ where: threadWhere, select: { id: true } });
    const threadIds = threads.map((t) => t.id);
    if (threadIds.length === 0) return NextResponse.json({ ok: true, unread: 0 });
    const unread = await prisma.emailMessage.count({
      where: { threadId: { in: threadIds }, isSent: false, NOT: { isRead: true } },
    });
    return NextResponse.json({ ok: true, unread });
  } catch {
    return NextResponse.json({ ok: true, unread: 0 });
  }
}
