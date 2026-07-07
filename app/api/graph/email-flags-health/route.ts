import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isMatterEmailEnabled } from "@/lib/graph/matterEmailConfig";
import { isInboundAttachmentOcrEnabled } from "@/lib/graph/inboundOcrConfig";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Read-only diagnostic. Reports whether the server sees the email feature flags + (optionally, with
// ?matterId= or ?masterLawsuitId=) the synced email state for that file, so we can tell whether an
// inbound reply actually got synced and why the unread badge is/ isn't counting it. No secret VALUES.
function flagState(key: string) {
  const raw = process.env[key];
  const isString = typeof raw === "string";
  return { set: isString && raw.length > 0, length: isString ? raw.length : 0, normalized: isString ? raw.trim().toLowerCase() : null };
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const matterId = Number(sp.get("matterId"));
  const masterLawsuitId = (sp.get("masterLawsuitId") || "").trim();
  const matterDisplayNumber = (sp.get("matterDisplayNumber") || "").trim();

  const base: any = {
    ok: true,
    vercelEnv: process.env.VERCEL_ENV || null,
    nodeEnv: process.env.NODE_ENV || null,
    computed: {
      matterEmailEnabled: isMatterEmailEnabled(),
      inboundAttachmentOcrEnabled: isInboundAttachmentOcrEnabled(),
    },
    env: {
      BARSH_MATTER_EMAIL_ENABLED: flagState("BARSH_MATTER_EMAIL_ENABLED"),
      BARSH_INBOUND_ATTACHMENT_OCR_ENABLED: flagState("BARSH_INBOUND_ATTACHMENT_OCR_ENABLED"),
      // These authorize the every-minute background sync cron. If neither is set, the cron fail-closes.
      CRON_SECRET: flagState("CRON_SECRET"),
      BARSH_MATTERS_BACKGROUND_EMAIL_SYNC_SECRET: flagState("BARSH_MATTERS_BACKGROUND_EMAIL_SYNC_SECRET"),
    },
  };

  const threadWhere: any = {};
  if (Number.isFinite(matterId) && matterId > 0) threadWhere.matterId = matterId;
  else if (masterLawsuitId) threadWhere.masterLawsuitId = masterLawsuitId;
  else if (matterDisplayNumber) threadWhere.matterDisplayNumber = matterDisplayNumber;

  if (Object.keys(threadWhere).length === 0) {
    base.note = "Add ?matterId=<numeric matter id> to also see this matter's synced email state.";
    return NextResponse.json(base);
  }

  try {
    const threads = await prisma.emailThread.findMany({
      where: threadWhere,
      select: { id: true, conversationId: true, subject: true, matterId: true, latestMessageAt: true },
    });
    const threadIds = threads.map((t) => t.id);
    const messages = threadIds.length
      ? await prisma.emailMessage.findMany({
          where: { threadId: { in: threadIds } },
          select: { direction: true, isSent: true, isRead: true, subject: true, receivedAt: true, hasAttachments: true },
          orderBy: { receivedAt: "desc" },
          take: 20,
        })
      : [];
    const inbound = messages.filter((m) => m.direction === "inbound" || m.isSent === false);
    const unreadInbound = inbound.filter((m) => m.isRead !== true);

    base.matterEmailState = {
      query: threadWhere,
      threads: threads.length,
      messages: messages.length,
      inboundMessages: inbound.length,
      unreadInbound: unreadInbound.length, // this is what the badge shows
      latestMessages: messages.slice(0, 8).map((m) => ({
        direction: m.direction,
        isSent: m.isSent,
        isRead: m.isRead,
        hasAttachments: m.hasAttachments,
        receivedAt: m.receivedAt,
        subject: (m.subject || "").slice(0, 60),
      })),
    };
  } catch (e: any) {
    base.matterEmailStateError = e?.message || "query failed";
  }

  return NextResponse.json(base);
}
