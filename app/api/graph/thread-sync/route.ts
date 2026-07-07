import { NextRequest, NextResponse } from "next/server";
import { graphApiBase, graphFetchJson } from "@/lib/graph/client";
import { getGraphAuthConfig, getGraphAuthReadiness } from "@/lib/graph/config";
import { prisma } from "@/lib/prisma";
import { persistGraphThreadSyncMessages } from "@/lib/graph/emailPersistence";
import { isInboundAttachmentOcrEnabled } from "@/lib/graph/inboundOcrConfig";
import { ingestInboundMessageAttachments } from "@/lib/graph/inboundAttachmentOcr";

export const dynamic = "force-dynamic";

const REQUIRED_CONFIRMATION = "sync-graph-thread";

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function objectValue(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, any>) : {};
}

function numberOrDefault(value: unknown, fallback: number): number {
  const raw = clean(value);
  // A missing value cleans to ""; Number("") is 0 (finite), which would clamp to 1 and sync only ONE
  // message. Treat an empty value as the fallback.
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.trunc(parsed), 1), 50);
}

function numberOrNull(value: unknown): number | null {
  const raw = clean(value);
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function escapeGraphFilterString(value: string): string {
  return value.replace(/'/g, "''");
}

function graphThreadMessagesUrl(mailboxUserId: string, conversationId: string, limit: number): string {
  const params = new URLSearchParams();
  params.set("$top", String(limit));
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
      "replyTo",
      "sentDateTime",
      "receivedDateTime",
      "parentFolderId",
      "isDraft",
      "isRead",
      "hasAttachments",
      "importance",
      "bodyPreview",
      "webLink",
    ].join(",")
  );
  params.set("$filter", `conversationId eq '${escapeGraphFilterString(conversationId)}'`);

  return `${graphApiBase()}/users/${encodeURIComponent(mailboxUserId)}/messages?${params.toString()}`;
}

function messageTimestamp(message: any): number {
  const raw = clean(message?.receivedDateTime || message?.sentDateTime);
  const date = raw ? new Date(raw) : null;
  return date && !Number.isNaN(date.getTime()) ? date.getTime() : 0;
}

function summarizeMessage(message: any) {
  return {
    graphMessageId: clean(message?.id),
    internetMessageId: clean(message?.internetMessageId),
    conversationId: clean(message?.conversationId),
    subject: clean(message?.subject),
    from: message?.from || null,
    toRecipients: Array.isArray(message?.toRecipients) ? message.toRecipients : [],
    ccRecipients: Array.isArray(message?.ccRecipients) ? message.ccRecipients : [],
    bccRecipients: Array.isArray(message?.bccRecipients) ? message.bccRecipients : [],
    replyTo: Array.isArray(message?.replyTo) ? message.replyTo : [],
    sentAt: clean(message?.sentDateTime) || null,
    receivedAt: clean(message?.receivedDateTime) || null,
    folderId: clean(message?.parentFolderId) || null,
    folderName: null,
    isDraft: Boolean(message?.isDraft),
    isRead: typeof message?.isRead === "boolean" ? message.isRead : null,
    hasAttachments: Boolean(message?.hasAttachments),
    importance: clean(message?.importance) || null,
    bodyPreview: clean(message?.bodyPreview),
    webLink: clean(message?.webLink),
    webLinkPresent: Boolean(clean(message?.webLink)),
    raw: message,
  };
}

async function localContextForConversation(conversationId: string) {
  const thread = await prisma.emailThread.findFirst({
    where: {
      provider: "microsoft_graph",
      conversationId,
    },
    orderBy: { updatedAt: "desc" },
  });

  return thread
    ? {
        source: "graph_thread_sync",
        matterId: thread.matterId,
        matterDisplayNumber: thread.matterDisplayNumber,
        masterLawsuitId: thread.masterLawsuitId,
        clioMatterId: thread.clioMatterId,
        clioDisplayNumber: thread.clioDisplayNumber,
        clioMaildropEmail: thread.clioMaildropEmail,
        clioMaildropLabel: thread.clioMaildropLabel,
      }
    : {};
}

export async function POST(req: NextRequest) {
  const confirm = clean(req.nextUrl.searchParams.get("confirm"));
  const config = getGraphAuthConfig();
  const readiness = getGraphAuthReadiness(config);
  const body = objectValue(await req.json().catch(() => ({})));
  const conversationId = clean(body.conversationId || req.nextUrl.searchParams.get("conversationId"));
  const limit = numberOrDefault(body.limit || req.nextUrl.searchParams.get("limit"), 25);

  const responseBase = {
    action: "graph-thread-sync",
    readOnly: false,
    previewOnly: false,
    failClosed: true,
    graphCallsMade: false,
    createsOutlookDraft: false,
    sendsEmail: false,
    readsMailbox: false,
    syncsMailbox: false,
    attachesDocument: false,
    clioRecordsChanged: false,
    databaseRecordsChanged: false,
    crossPlatformRuntime: true,
    localOutlookAutomationRequired: false,
  };

  if (confirm !== REQUIRED_CONFIRMATION) {
    return NextResponse.json(
      {
        ...responseBase,
        previewOnly: true,
        readOnly: true,
        blocked: true,
        requiredConfirmation: REQUIRED_CONFIRMATION,
        readiness,
        query: {
          conversationId: conversationId || null,
          limit,
        },
        note:
          "Fail-closed Graph thread sync route.  First use /api/graph/thread-sync-preview, then add ?confirm=sync-graph-thread to explicitly read Microsoft Graph and persist normalized EmailThread/EmailMessage metadata locally.  This route never sends email, creates drafts, writes Clio, uploads documents, or uses local Outlook automation.",
      },
      { status: 400 }
    );
  }

  if (!conversationId) {
    return NextResponse.json(
      {
        ...responseBase,
        blocked: true,
        readiness,
        error: "conversationId is required for confirmed Graph thread sync.",
      },
      { status: 400 }
    );
  }

  if (!readiness.readyForFutureReadOnlySync) {
    return NextResponse.json(
      {
        ...responseBase,
        blocked: true,
        readiness,
        error:
          "Microsoft Graph read-only sync is not configured.  Configure tenant ID, client ID, client secret, and mailbox user before syncing a thread.",
      },
      { status: 400 }
    );
  }

  const graphResult = await graphFetchJson({
    url: graphThreadMessagesUrl(config.mailboxUserId, conversationId, limit),
    method: "GET",
  });

  if (!graphResult.ok) {
    return NextResponse.json(
      {
        ...responseBase,
        graphCallsMade: true,
        readsMailbox: true,
        blocked: true,
        readiness,
        result: {
          ok: graphResult.ok,
          status: graphResult.status,
          statusText: graphResult.statusText,
          error: graphResult.error,
        },
      },
      { status: 502 }
    );
  }

  const rows = Array.isArray(graphResult.json?.value) ? graphResult.json.value : [];
  const messages = rows
    .map(summarizeMessage)
    .sort((a: any, b: any) => messageTimestamp(a.raw) - messageTimestamp(b.raw));

  if (!messages.length) {
    return NextResponse.json(
      {
        ...responseBase,
        graphCallsMade: true,
        readsMailbox: true,
        blocked: true,
        readiness,
        query: {
          conversationId,
          limit,
        },
        counts: {
          graphMessages: 0,
        },
        error: "No Microsoft Graph messages were returned for this conversationId.",
      },
      { status: 404 }
    );
  }

  const localContext = await localContextForConversation(conversationId);
  const context = {
    ...localContext,
    ...objectValue(body.context),
    source: "graph_thread_sync",
    matterId: body.matterId ?? objectValue(body.context).matterId ?? (localContext as any).matterId,
    matterDisplayNumber: clean(body.matterDisplayNumber || objectValue(body.context).matterDisplayNumber || (localContext as any).matterDisplayNumber),
    masterLawsuitId: clean(body.masterLawsuitId || objectValue(body.context).masterLawsuitId || (localContext as any).masterLawsuitId),
    clioMatterId: numberOrNull(body.clioMatterId ?? objectValue(body.context).clioMatterId ?? (localContext as any).clioMatterId),
    clioDisplayNumber: clean(body.clioDisplayNumber || objectValue(body.context).clioDisplayNumber || (localContext as any).clioDisplayNumber),
    clioMaildropEmail: clean(body.clioMaildropEmail || objectValue(body.context).clioMaildropEmail || (localContext as any).clioMaildropEmail),
    clioMaildropLabel: clean(body.clioMaildropLabel || objectValue(body.context).clioMaildropLabel || (localContext as any).clioMaildropLabel),
  };

  const persisted = await persistGraphThreadSyncMessages({
    mailboxUserId: config.mailboxUserId,
    conversationId,
    messages,
    context,
  });

  // Phase D — stage inbound attachments into the OCR review queue (flag-gated, best-effort, no Clio
  // write). Nothing files without a later per-document operator confirmation. Idempotent on re-sync.
  let inboundAttachmentOcr: any = null;
  if (isInboundAttachmentOcrEnabled()) {
    try {
      const inboundMessages = await prisma.emailMessage.findMany({
        where: { conversationId, direction: "inbound", graphMessageId: { not: null } },
        select: {
          id: true,
          graphMessageId: true,
          mailboxUserId: true,
          thread: { select: { matterId: true, masterLawsuitId: true, matterDisplayNumber: true } },
        },
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
      inboundAttachmentOcr = { enabled: true, processed, ocrPending };
    } catch (err: any) {
      inboundAttachmentOcr = { enabled: true, error: err?.message || "inbound attachment ocr failed" };
    }
  }

  return NextResponse.json({
    ...responseBase,
    graphCallsMade: true,
    readsMailbox: true,
    syncsMailbox: true,
    databaseRecordsChanged: true,
    readiness,
    query: {
      conversationId,
      limit,
    },
    counts: {
      graphMessages: messages.length,
      drafts: messages.filter((message: any) => message.isDraft).length,
      sentOrReceived: messages.filter((message: any) => !message.isDraft).length,
      withAttachments: messages.filter((message: any) => message.hasAttachments).length,
    },
    persisted,
    inboundAttachmentOcr,
    nextLinkPresent: Boolean(clean(graphResult.json?.["@odata.nextLink"])),
    note:
      "Confirmed Graph thread sync completed.  This route read Microsoft Graph and persisted normalized Barsh Matters email metadata locally.  It did not create drafts, send email, write Clio, upload documents, or use local Outlook automation.",
  });
}
