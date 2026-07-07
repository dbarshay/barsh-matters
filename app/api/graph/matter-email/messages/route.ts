import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Flat, date-sorted email list for a matter/lawsuit (Outlook-style inbox). Read-only. Returns synced
// EmailMessages across the file's threads, newest first, deduped by graphMessageId. Includes direction,
// deletedLocal, and isDraft so the client can bucket messages into Outlook-style folders (Inbox / Sent /
// Deleted Items / Drafts).
//   GET ?matterId= | masterLawsuitId= | matterDisplayNumber=
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
    const rows = await prisma.emailMessage.findMany({
      where: { thread: threadWhere },
      orderBy: [{ receivedAt: "desc" }, { sentAt: "desc" }, { createdAt: "desc" }],
      take: 500,
      select: {
        id: true,
        graphMessageId: true,
        conversationId: true,
        direction: true,
        isRead: true,
        isSent: true,
        isDraft: true,
        deletedLocal: true,
        subject: true,
        from: true,
        fromEmail: true,
        toRecipients: true,
        ccRecipients: true,
        receivedAt: true,
        sentAt: true,
        hasAttachments: true,
        bodyHtml: true,
        bodyPreview: true,
      },
    });

    // Dedupe by graphMessageId (thread/message duplication can produce more than one row per message).
    const seen = new Set<string>();
    const messages = rows.filter((m) => {
      const key = String(m.graphMessageId || m.id);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return NextResponse.json({ ok: true, count: messages.length, messages });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Could not load emails." }, { status: 500 });
  }
}
