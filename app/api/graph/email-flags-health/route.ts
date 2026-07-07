import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isMatterEmailEnabled } from "@/lib/graph/matterEmailConfig";
import { isInboundAttachmentOcrEnabled } from "@/lib/graph/inboundOcrConfig";
import { graphApiBase, graphFetchJson } from "@/lib/graph/client";
import { getGraphAuthConfig } from "@/lib/graph/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Read-only diagnostic. Reports the email feature flags and, with ?matterDisplayNumber= / ?matterId=,
// this file's SYNCED (DB) email state. Add &live=1 to ALSO fetch the live state straight from Microsoft
// Graph for each of this matter's conversations — so we can compare "what Graph says now" vs "what's
// stored" (isRead / from / hasAttachments). No secret values are returned.
function flagState(key: string) {
  const raw = process.env[key];
  const isString = typeof raw === "string";
  return { set: isString && raw.length > 0, length: isString ? raw.length : 0, normalized: isString ? raw.trim().toLowerCase() : null };
}

const enc = encodeURIComponent;

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const matterId = Number(sp.get("matterId"));
  const masterLawsuitId = (sp.get("masterLawsuitId") || "").trim();
  const matterDisplayNumber = (sp.get("matterDisplayNumber") || "").trim();
  const live = sp.get("live") === "1";

  const base: any = {
    ok: true,
    vercelEnv: process.env.VERCEL_ENV || null,
    nodeEnv: process.env.NODE_ENV || null,
    computed: { matterEmailEnabled: isMatterEmailEnabled(), inboundAttachmentOcrEnabled: isInboundAttachmentOcrEnabled() },
    env: {
      BARSH_MATTER_EMAIL_ENABLED: flagState("BARSH_MATTER_EMAIL_ENABLED"),
      BARSH_INBOUND_ATTACHMENT_OCR_ENABLED: flagState("BARSH_INBOUND_ATTACHMENT_OCR_ENABLED"),
      CRON_SECRET: flagState("CRON_SECRET"),
      BARSH_MATTERS_BACKGROUND_EMAIL_SYNC_SECRET: flagState("BARSH_MATTERS_BACKGROUND_EMAIL_SYNC_SECRET"),
    },
  };

  const threadWhere: any = {};
  if (Number.isFinite(matterId) && matterId > 0) threadWhere.matterId = matterId;
  else if (masterLawsuitId) threadWhere.masterLawsuitId = masterLawsuitId;
  else if (matterDisplayNumber) threadWhere.matterDisplayNumber = matterDisplayNumber;

  if (Object.keys(threadWhere).length === 0) {
    base.note = "Add ?matterDisplayNumber=BRL_... (and &live=1 for the live Graph read).";
    return NextResponse.json(base);
  }

  try {
    const threads = await prisma.emailThread.findMany({
      where: threadWhere,
      select: { id: true, conversationId: true, subject: true, matterId: true },
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
    const inbound = messages.filter((m) => m.direction === "inbound");
    base.matterEmailState = {
      threads: threads.length,
      messages: messages.length,
      inboundMessages: inbound.length,
      unreadInbound: inbound.filter((m) => m.isRead !== true).length,
    };

    if (live) {
      const config = getGraphAuthConfig();
      const mailbox = (config as any)?.mailboxUserId || "";
      const liveConversations: any[] = [];
      for (const t of threads) {
        const cid = (t.conversationId || "").trim();
        if (!cid || !mailbox) continue;
        const url =
          `${graphApiBase()}/users/${enc(mailbox)}/messages?` +
          `$top=25&$select=id,from,isRead,hasAttachments,receivedDateTime,subject&` +
          `$filter=${enc(`conversationId eq '${cid.replace(/'/g, "''")}'`)}`;
        const r = await graphFetchJson({ url, method: "GET" });
        liveConversations.push({
          conversationId: cid,
          ok: r.ok,
          error: r.ok ? undefined : r.error,
          messages: r.ok && Array.isArray(r.json?.value)
            ? r.json.value.map((m: any) => ({
                fromEmail: m?.from?.emailAddress?.address || null,
                isRead: m?.isRead,
                hasAttachments: Boolean(m?.hasAttachments),
                receivedDateTime: m?.receivedDateTime || null,
                subject: String(m?.subject || "").slice(0, 60),
              }))
            : [],
        });
      }
      base.liveGraph = { mailboxConfigured: Boolean(mailbox), conversations: liveConversations };
    }
  } catch (e: any) {
    base.matterEmailStateError = e?.message || "query failed";
  }

  return NextResponse.json(base);
}
