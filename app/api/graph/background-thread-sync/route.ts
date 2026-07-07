import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { graphApiBase, graphFetchJson } from "@/lib/graph/client";
import { getGraphAuthConfig, getGraphAuthReadiness } from "@/lib/graph/config";
import { persistGraphThreadSyncMessages } from "@/lib/graph/emailPersistence";
import { isInboundAttachmentOcrEnabled } from "@/lib/graph/inboundOcrConfig";
import { ingestInboundMessageAttachments } from "@/lib/graph/inboundAttachmentOcr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROVIDER = "microsoft_graph";
const REQUIRED_CONFIRMATION = "background-graph-thread-sync";
const DEFAULT_THREAD_LIMIT = 10;
const MAX_THREAD_LIMIT = 25;
const DEFAULT_MESSAGE_LIMIT = 50;
const MAX_MESSAGE_LIMIT = 100;

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function numberOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function boundedInt(value: unknown, fallback: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(Math.floor(parsed), max));
}

function escapeGraphFilterString(value: string): string {
  return value.replace(/'/g, "''");
}

function graphThreadMessagesUrl(mailboxUserId: string, conversationId: string, limit: number): string {
  const params = new URLSearchParams();
  params.set(
    "$select",
    [
      "id",
      "conversationId",
      "internetMessageId",
      "subject",
      "from",
      "toRecipients",
      "ccRecipients",
      "bccRecipients",
      "sentDateTime",
      "receivedDateTime",
      "lastModifiedDateTime",
      "bodyPreview",
      "body",
      "webLink",
      "hasAttachments",
      "isRead",
    ].join(",")
  );
  params.set("$filter", `conversationId eq '${escapeGraphFilterString(conversationId)}'`);
  // Do not combine conversationId filtering with Graph-side receivedDateTime ordering.
  // Microsoft Graph can reject that combination as "too complex"; sort locally after retrieval.
  params.set("$top", String(limit));

  return `${graphApiBase()}/users/${encodeURIComponent(mailboxUserId)}/messages?${params.toString()}`;
}

function graphRecipientEmail(value: any): string {
  return clean(value?.emailAddress?.address || value?.address || value?.email);
}

function graphRecipientName(value: any): string {
  return clean(value?.emailAddress?.name || value?.name || graphRecipientEmail(value));
}

function graphRecipientList(values: any): string[] {
  return Array.isArray(values)
    ? values.map((value) => graphRecipientEmail(value)).filter(Boolean)
    : [];
}

function graphFrom(value: any): { from: string | null; fromEmail: string | null } {
  const fromEmail = graphRecipientEmail(value);
  const fromName = graphRecipientName(value);
  return {
    from: fromName || fromEmail || null,
    fromEmail: fromEmail || null,
  };
}

function normalizeGraphMessage(message: any, fallbackConversationId: string) {
  const from = graphFrom(message?.from);
  return {
    graphMessageId: clean(message?.id),
    internetMessageId: clean(message?.internetMessageId),
    conversationId: clean(message?.conversationId) || fallbackConversationId,
    subject: clean(message?.subject),
    from: from.from,
    fromEmail: from.fromEmail,
    to: graphRecipientList(message?.toRecipients),
    cc: graphRecipientList(message?.ccRecipients),
    bcc: graphRecipientList(message?.bccRecipients),
    sentAt: clean(message?.sentDateTime),
    receivedAt: clean(message?.receivedDateTime),
    lastModifiedAt: clean(message?.lastModifiedDateTime),
    bodyPreview: clean(message?.bodyPreview),
    bodyText: clean(message?.body?.content || message?.bodyPreview),
    webLink: clean(message?.webLink),
    hasAttachments: Boolean(message?.hasAttachments),
    isRead: typeof message?.isRead === "boolean" ? message.isRead : null,
    raw: message,
  };
}

function bearerSecretOk(req: NextRequest): boolean {
  const configuredSecret = clean(process.env.BARSH_MATTERS_BACKGROUND_EMAIL_SYNC_SECRET || process.env.CRON_SECRET);
  if (!configuredSecret) return false;

  const authorization = clean(req.headers.get("authorization"));
  const bearer = authorization.toLowerCase().startsWith("bearer ")
    ? authorization.slice("bearer ".length).trim()
    : "";

  return bearer.length > 0 && bearer === configuredSecret;
}

function requestIsConfirmed(req: NextRequest): boolean {
  const confirm = clean(req.nextUrl.searchParams.get("confirm"));
  if (confirm === REQUIRED_CONFIRMATION) return true;
  return bearerSecretOk(req);
}

function threadContext(thread: any) {
  return {
    source: "graph_background_thread_sync",
    matterId: numberOrNull(thread.matterId),
    matterDisplayNumber: clean(thread.matterDisplayNumber),
    masterLawsuitId: clean(thread.masterLawsuitId),
    clioMatterId: numberOrNull(thread.clioMatterId),
    clioDisplayNumber: clean(thread.clioDisplayNumber),
    clioMaildropEmail: clean(thread.clioMaildropEmail),
    clioMaildropLabel: clean(thread.clioMaildropLabel),
  };
}

async function runBackgroundThreadSync(req: NextRequest) {
  const config = getGraphAuthConfig();
  const readiness = getGraphAuthReadiness(config);

  const threadLimit = boundedInt(req.nextUrl.searchParams.get("threads"), DEFAULT_THREAD_LIMIT, MAX_THREAD_LIMIT);
  const messageLimit = boundedInt(req.nextUrl.searchParams.get("messages"), DEFAULT_MESSAGE_LIMIT, MAX_MESSAGE_LIMIT);

  const base = {
    action: "graph-background-thread-sync",
    previewOnly: false,
    backgroundSync: true,
    graphCallsMade: false,
    readsMailbox: false,
    createsOutlookDraft: false,
    sendsEmail: false,
    syncsMailbox: true,
    uploadsDocuments: false,
    clioRecordsChanged: false,
    databaseRecordsChanged: false,
    limits: {
      threadLimit,
      messageLimit,
      maxThreadLimit: MAX_THREAD_LIMIT,
      maxMessageLimit: MAX_MESSAGE_LIMIT,
    },
    safety: [
      "Background known-thread sync only.",
      "Reads Microsoft Graph only for locally stored EmailThread conversationId values.",
      "Persists only local Barsh Matters EmailThread, EmailMessage, EmailAttachment, EmailMatterLink, and EmailFilingLog metadata.",
      "Does not create Outlook drafts.",
      "Does not send email.",
      "Does not write Clio.",
      "Does not upload documents.",
      "Does not use local Outlook automation.",
    ],
  };

  if (!requestIsConfirmed(req)) {
    return NextResponse.json(
      {
        ...base,
        ok: false,
        error:
          "Fail-closed background Graph thread sync.  Use ?confirm=background-graph-thread-sync locally, or call with Authorization: Bearer <BARSH_MATTERS_BACKGROUND_EMAIL_SYNC_SECRET or CRON_SECRET> from a trusted scheduler.",
      },
      { status: 403 }
    );
  }

  if (!readiness.readyForFutureReadOnlySync) {
    return NextResponse.json(
      {
        ...base,
        ok: false,
        graphReadiness: readiness,
        error:
          "Microsoft Graph read-only sync is not configured.  Configure tenant ID, client ID, client secret, and mailbox user before running background thread sync.",
      },
      { status: 503 }
    );
  }

  const threads = await prisma.emailThread.findMany({
    where: {
      provider: PROVIDER,
      conversationId: { not: "" },
      OR: [
        { mailboxUserPrincipalName: config.mailboxUserId },
        { mailboxUserPrincipalName: null },
      ],
    },
    orderBy: [{ latestMessageAt: "desc" }, { updatedAt: "desc" }],
    take: threadLimit,
    select: {
      id: true,
      provider: true,
      mailboxUserPrincipalName: true,
      conversationId: true,
      subject: true,
      matterId: true,
      matterDisplayNumber: true,
      masterLawsuitId: true,
      clioMatterId: true,
      clioDisplayNumber: true,
      clioMaildropEmail: true,
      clioMaildropLabel: true,
      latestMessageAt: true,
      updatedAt: true,
    },
  });

  const results = [];
  let graphCalls = 0;
  let graphMessages = 0;
  let messagesUpserted = 0;
  let matterLinksCreated = 0;
  let filingLogsCreated = 0;
  let failures = 0;

  for (const thread of threads) {
    const conversationId = clean(thread.conversationId);
    if (!conversationId) continue;

    const graphResult = await graphFetchJson({
      url: graphThreadMessagesUrl(config.mailboxUserId, conversationId, messageLimit),
      method: "GET",
    });

    graphCalls += 1;

    if (!graphResult.ok) {
      failures += 1;
      results.push({
        conversationId,
        ok: false,
        graphStatus: graphResult.status,
        error: graphResult.error || graphResult.statusText || "Microsoft Graph thread lookup failed.",
      });
      continue;
    }

    const rows = Array.isArray(graphResult.json?.value) ? graphResult.json.value : [];
    const messages = rows
      .map((row: any) => normalizeGraphMessage(row, conversationId))
      .filter((row: any) => clean(row.graphMessageId))
      .sort((a: any, b: any) => {
        const aTime = Date.parse(clean(a.receivedAt || a.sentAt || a.lastModifiedAt));
        const bTime = Date.parse(clean(b.receivedAt || b.sentAt || b.lastModifiedAt));
        const aSafe = Number.isFinite(aTime) ? aTime : 0;
        const bSafe = Number.isFinite(bTime) ? bTime : 0;
        return aSafe - bSafe;
      });

    graphMessages += messages.length;

    if (messages.length === 0) {
      results.push({
        conversationId,
        ok: true,
        graphMessages: 0,
        persisted: null,
        note: "No Microsoft Graph messages returned for this stored conversationId.",
      });
      continue;
    }

    const persisted = await persistGraphThreadSyncMessages({
      mailboxUserId: config.mailboxUserId,
      conversationId,
      messages,
      context: threadContext(thread),
    });

    messagesUpserted += Number(persisted?.messagesUpserted || 0);
    matterLinksCreated += Number(persisted?.matterLinksCreated || 0);
    filingLogsCreated += 1;

    // Phase D — auto-stage inbound attachments into the OCR review queue during the background sync
    // (flag-gated, best-effort, no Clio write; filing stays a per-document operator step). This is
    // what makes the review queue populate automatically, without a manual thread sync.
    let inboundAttachmentOcr: any = null;
    if (isInboundAttachmentOcrEnabled()) {
      try {
        const inboundMessages = await prisma.emailMessage.findMany({
          where: { conversationId, direction: "inbound", graphMessageId: { not: null } },
          select: { id: true, graphMessageId: true, mailboxUserId: true, thread: { select: { matterId: true, masterLawsuitId: true, matterDisplayNumber: true } } },
        });
        let processed = 0;
        let ocrPending = 0;
        for (const m of inboundMessages) {
          if (!m.graphMessageId) continue;
          const r = await ingestInboundMessageAttachments(prisma, {
            mailboxUserId: m.mailboxUserId || config.mailboxUserId,
            graphMessageId: m.graphMessageId,
            localMessageId: m.id,
            context: {
              matterId: m.thread?.matterId ?? null,
              masterLawsuitId: m.thread?.masterLawsuitId ?? null,
              matterDisplayNumber: m.thread?.matterDisplayNumber ?? null,
            },
          });
          processed += r.processed;
          ocrPending += r.ocrPending;
        }
        inboundAttachmentOcr = { processed, ocrPending };
      } catch (err: any) {
        inboundAttachmentOcr = { error: err?.message || "inbound attachment ocr failed" };
      }
    }

    results.push({
      conversationId,
      ok: true,
      graphMessages: messages.length,
      persisted,
      inboundAttachmentOcr,
      nextLinkPresent: Boolean(clean(graphResult.json?.["@odata.nextLink"])),
    });
  }

  return NextResponse.json({
    ...base,
    ok: failures === 0,
    graphCallsMade: graphCalls > 0,
    readsMailbox: graphCalls > 0,
    databaseRecordsChanged: messagesUpserted > 0 || matterLinksCreated > 0 || filingLogsCreated > 0,
    counts: {
      localThreadsConsidered: threads.length,
      graphCalls,
      graphMessages,
      messagesUpserted,
      matterLinksCreated,
      filingLogsCreated,
      failures,
    },
    results,
    graphReadiness: readiness,
    message:
      "Background known-thread sync completed.  This route read Microsoft Graph for locally stored conversationId values and persisted local Barsh Matters email metadata only.  It did not create drafts, send email, write Clio, upload documents, or use local Outlook automation.",
  });
}

export async function GET(req: NextRequest) {
  return runBackgroundThreadSync(req);
}

export async function POST(req: NextRequest) {
  return runBackgroundThreadSync(req);
}
