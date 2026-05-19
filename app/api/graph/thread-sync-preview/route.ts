import { NextRequest, NextResponse } from "next/server";
import { graphApiBase, graphFetchJson } from "@/lib/graph/client";
import { getGraphAuthConfig, getGraphAuthReadiness } from "@/lib/graph/config";

export const dynamic = "force-dynamic";

const REQUIRED_CONFIRMATION = "preview-graph-thread-sync";

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function numberOrDefault(value: string | null, fallback: number): number {
  const raw = clean(value);
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.trunc(parsed), 1), 50);
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
    isDraft: Boolean(message?.isDraft),
    isRead: typeof message?.isRead === "boolean" ? message.isRead : null,
    hasAttachments: Boolean(message?.hasAttachments),
    importance: clean(message?.importance) || null,
    bodyPreview: clean(message?.bodyPreview),
    webLinkPresent: Boolean(clean(message?.webLink)),
  };
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const confirm = clean(url.searchParams.get("confirm"));
  const conversationId = clean(url.searchParams.get("conversationId"));
  const limit = numberOrDefault(url.searchParams.get("limit"), 25);

  const config = getGraphAuthConfig();
  const readiness = getGraphAuthReadiness(config);

  const responseBase = {
    action: "graph-thread-sync-preview",
    readOnly: true,
    previewOnly: true,
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
        blocked: true,
        requiredConfirmation: REQUIRED_CONFIRMATION,
        readiness,
        query: {
          conversationId: conversationId || null,
          limit,
        },
        note:
          "Fail-closed Graph thread sync preview.  Add ?confirm=preview-graph-thread-sync to explicitly run a read-only Microsoft Graph mailbox lookup.  This preview never persists messages, creates drafts, sends email, writes Clio, or modifies database records.",
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
        error: "conversationId is required for Graph thread sync preview.",
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
          "Microsoft Graph read-only sync is not configured.  Configure tenant ID, client ID, client secret, and mailbox user before running a mailbox read preview.",
      },
      { status: 400 }
    );
  }

  const graphUrl = graphThreadMessagesUrl(config.mailboxUserId, conversationId, limit);
  const graphResult = await graphFetchJson({
    url: graphUrl,
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
        query: {
          conversationId,
          limit,
        },
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
    .sort((a: any, b: any) => messageTimestamp(a) - messageTimestamp(b));

  return NextResponse.json({
    ...responseBase,
    graphCallsMade: true,
    readsMailbox: true,
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
    messages,
    nextLinkPresent: Boolean(clean(graphResult.json?.["@odata.nextLink"])),
    note:
      "Preview only.  This route reads matching Microsoft Graph mailbox messages for a stored conversationId and returns a normalized preview.  It does not persist or update EmailThread, EmailMessage, EmailAttachment, EmailMatterLink, or EmailFilingLog records.",
  });
}
