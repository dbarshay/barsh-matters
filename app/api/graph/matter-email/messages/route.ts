import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestUserMailbox } from "@/lib/graph/userMailbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Flat, date-sorted email list for a matter/lawsuit (Outlook-style inbox). Read-only. Returns synced
// EmailMessages across the file's threads, newest first, deduped by graphMessageId. Includes direction,
// deletedLocal, and isDraft so the client can bucket messages into Outlook-style folders (Inbox / Sent /
// Deleted Items / Drafts).
//   GET ?matterId= | masterLawsuitId= | matterDisplayNumber=
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const scope = (sp.get("scope") || "").trim().toLowerCase();
  const matterId = Number(sp.get("matterId"));
  const masterLawsuitId = (sp.get("masterLawsuitId") || "").trim();
  const matterDisplayNumber = (sp.get("matterDisplayNumber") || "").trim();

  const threadWhere: any = {};
  if (scope === "all") {
    // Firm-wide inbox: every matter/lawsuit-tagged thread (drives the header Emails button).
    threadWhere.OR = [{ matterId: { not: null } }, { masterLawsuitId: { not: null } }, { matterDisplayNumber: { not: null } }];
  } else if (Number.isFinite(matterId) && matterId > 0) threadWhere.matterId = matterId;
  else if (masterLawsuitId) threadWhere.masterLawsuitId = masterLawsuitId;
  else if (matterDisplayNumber) threadWhere.matterDisplayNumber = matterDisplayNumber;
  else return NextResponse.json({ ok: false, error: "matterId, masterLawsuitId, matterDisplayNumber, or scope=all required." }, { status: 400 });

  // User-specific: only the logged-in user's OWN mailbox (their account email). Messages carry the
  // mailbox on either mailboxUserPrincipalName (sync path) or mailboxUserId (send path).
  const userMailbox = getRequestUserMailbox(req);
  if (!userMailbox) return NextResponse.json({ ok: true, count: 0, messages: [] });
  const mailboxWhere = {
    OR: [
      { mailboxUserPrincipalName: { equals: userMailbox, mode: "insensitive" as const } },
      { mailboxUserId: { equals: userMailbox, mode: "insensitive" as const } },
    ],
  };

  try {
    const rows = await prisma.emailMessage.findMany({
      where: { AND: [{ thread: threadWhere }, mailboxWhere] },
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
        thread: { select: { matterId: true, matterDisplayNumber: true, masterLawsuitId: true } },
      },
    });

    // Dedupe by graphMessageId (thread/message duplication can produce more than one row per message)
    // and flatten each message's matter/lawsuit context up (for firm-wide tags + correct reply threading).
    const seen = new Set<string>();
    const messages = rows
      .filter((m) => {
        const key = String(m.graphMessageId || m.id);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((m) => {
        const { thread, ...rest } = m as any;
        return {
          ...rest,
          matterId: thread?.matterId ?? null,
          matterDisplayNumber: thread?.matterDisplayNumber ?? null,
          masterLawsuitId: thread?.masterLawsuitId ?? null,
        };
      });

    return NextResponse.json({ ok: true, count: messages.length, messages });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Could not load emails." }, { status: 500 });
  }
}
