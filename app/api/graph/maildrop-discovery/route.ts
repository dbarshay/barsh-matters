import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { graphApiBase, graphFetchJson } from "@/lib/graph/client";
import { getGraphAuthConfig, getGraphAuthReadiness } from "@/lib/graph/config";
import { persistGraphThreadSyncMessages } from "@/lib/graph/emailPersistence";
import { listActiveUserMailboxes } from "@/lib/graph/userMailbox";
import { resolveMatterContext } from "@/lib/graph/webhookMessageSync";


const MAILDROP_DISCOVERY_SOURCE = "graph_maildrop_discovery";

async function createMaildropDiscoveryRunLog(input: {
  status: string;
  previewOnly: boolean;
  databaseChanged: boolean;
  targetId?: string | null;
  error?: string | null;
  metadata?: Record<string, any>;
}) {
  return prisma.emailFilingLog.create({
    data: {
      provider: "microsoft_graph",
      targetSystem: "barsh_matters",
      targetType: "maildrop_discovery_run",
      targetId: input.targetId || "maildrop-discovery",
      action: MAILDROP_DISCOVERY_SOURCE,
      status: input.status,
      previewOnly: input.previewOnly,
      clioRecordsChanged: false,
      databaseChanged: input.databaseChanged,
      requestedBy: "barsh_matters_cron",
      error: input.error || null,
      metadata: {
        source: "graph_maildrop_discovery",
        ...input.metadata,
      },
    },
  });
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROVIDER = "microsoft_graph";
const REQUIRED_PREVIEW_CONFIRMATION = "preview-maildrop-discovery";
const REQUIRED_SYNC_CONFIRMATION = "sync-maildrop-discovery";
const DEFAULT_MAILDROP_LIMIT = 25;
const MAX_MAILDROP_LIMIT = 100;
const DEFAULT_MESSAGE_LIMIT = 50;
const MAX_MESSAGE_LIMIT = 100;

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function lowerEmail(value: unknown): string {
  return clean(value).toLowerCase();
}

function boundedInt(value: unknown, fallback: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(Math.floor(parsed), max));
}

function numberOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function graphRecentMessagesUrl(mailboxUserId: string, limit: number): string {
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
  params.set("$orderby", "receivedDateTime desc");
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

function normalizeGraphMessage(message: any) {
  const from = graphFrom(message?.from);
  return {
    graphMessageId: clean(message?.id),
    internetMessageId: clean(message?.internetMessageId),
    conversationId: clean(message?.conversationId),
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

function allRecipientEmails(message: any): string[] {
  return [
    ...graphRecipientList(message?.toRecipients),
    ...graphRecipientList(message?.ccRecipients),
    ...graphRecipientList(message?.bccRecipients),
  ].map((email) => email.toLowerCase()).filter(Boolean);
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

function confirmMode(req: NextRequest): "preview" | "sync" | null {
  const confirm = clean(req.nextUrl.searchParams.get("confirm"));
  if (confirm === REQUIRED_PREVIEW_CONFIRMATION) return "preview";
  if (confirm === REQUIRED_SYNC_CONFIRMATION) return "sync";
  if (bearerSecretOk(req)) return "sync";
  return null;
}

function contextFromMaildropRecord(record: any) {
  return {
    source: MAILDROP_DISCOVERY_SOURCE,
    matterId: numberOrNull(record.matterId),
    matterDisplayNumber: clean(record.matterDisplayNumber),
    masterLawsuitId: clean(record.masterLawsuitId),
    clioMatterId: numberOrNull(record.clioMatterId),
    clioDisplayNumber: clean(record.clioDisplayNumber),
    clioMaildropEmail: clean(record.clioMaildropEmail),
    clioMaildropLabel: clean(record.clioMaildropLabel),
  };
}

async function runMaildropDiscovery(req: NextRequest) {
  const mode = confirmMode(req);
  const config = getGraphAuthConfig();
  const readiness = getGraphAuthReadiness(config);

  const maildropLimit = boundedInt(req.nextUrl.searchParams.get("maildrops"), DEFAULT_MAILDROP_LIMIT, MAX_MAILDROP_LIMIT);
  const messageLimit = boundedInt(req.nextUrl.searchParams.get("messages"), DEFAULT_MESSAGE_LIMIT, MAX_MESSAGE_LIMIT);

  const base = {
    action: "graph-maildrop-discovery",
    previewOnly: mode !== "sync",
    backgroundDiscovery: true,
    graphCallsMade: false,
    readsMailbox: false,
    createsOutlookDraft: false,
    sendsEmail: false,
    syncsMailbox: mode === "sync",
    uploadsDocuments: false,
    clioRecordsChanged: false,
    databaseRecordsChanged: false,
    limits: {
      maildropLimit,
      messageLimit,
      maxMaildropLimit: MAX_MAILDROP_LIMIT,
      maxMessageLimit: MAX_MESSAGE_LIMIT,
    },
    safety: [
      "MailDrop discovery scans recent Microsoft Graph mailbox messages and matches only locally known Clio MailDrop recipient addresses.",
      "Preview mode reads Graph and returns matched candidates only.",
      "Sync mode persists only local Barsh Matters EmailThread, EmailMessage, EmailAttachment, EmailMatterLink, and EmailFilingLog metadata.",
      "Does not create Outlook drafts.",
      "Does not send email.",
      "Does not write Clio.",
      "Does not upload documents.",
      "Does not use local Outlook automation.",
    ],
  };

  if (!mode) {
    return NextResponse.json(
      {
        ...base,
        ok: false,
        error:
          "Fail-closed MailDrop discovery.  Use ?confirm=preview-maildrop-discovery for read-only preview, ?confirm=sync-maildrop-discovery for confirmed local persistence, or Authorization: Bearer <BARSH_MATTERS_BACKGROUND_EMAIL_SYNC_SECRET or CRON_SECRET> from a trusted scheduler.",
      },
      { status: 403 }
    );
  }

  // Per-user: app creds (tenant/client/secret) are enough — discovery scans each active user's mailbox.
  if (!readiness.appOnlyTokenConfigReady) {
    return NextResponse.json(
      {
        ...base,
        ok: false,
        graphReadiness: readiness,
        error:
          "Microsoft Graph read-only sync is not configured.  Configure tenant ID, client ID, and client secret before running MailDrop discovery.",
      },
      { status: 503 }
    );
  }

  // Backstop discovery: scan EACH active user's own mailbox for recent messages carrying a matter number
  // (BRL_ or YYYY.MM.NNNNN) in the subject or body — the same rule the real-time webhook uses. MailDrop
  // address matching is retired.
  const mailboxes = await listActiveUserMailboxes();
  if (mailboxes.length === 0) {
    return NextResponse.json({
      ...base,
      ok: true,
      status: "no_active_user_mailboxes",
      graphCallsMade: false,
      readsMailbox: false,
      counts: { mailboxesScanned: 0, scannedGraphMessages: 0, matchedMessages: 0, discoveredThreads: 0, messagesUpserted: 0, matterLinksCreated: 0, filingLogsCreated: 0 },
      matches: [],
      message: "No active user mailboxes to scan.",
    });
  }

  let graphCalls = 0;
  let scannedGraphMessages = 0;
  const graphErrors: { mailbox: string; error: string }[] = [];
  // Keyed by conversationId; carries the resolved matter/lawsuit context + owning mailbox.
  const matchesByConversation = new Map<string, { context: any; messages: any[]; mailbox: string }>();

  for (const mailbox of mailboxes) {
    const graphResult = await graphFetchJson({ url: graphRecentMessagesUrl(mailbox, messageLimit), method: "GET" });
    graphCalls += 1;
    if (!graphResult.ok) {
      graphErrors.push({ mailbox, error: graphResult.error || graphResult.statusText || "lookup failed" });
      continue; // one mailbox failing must not abort the others
    }
    const rows = Array.isArray(graphResult.json?.value) ? graphResult.json.value : [];
    scannedGraphMessages += rows.length;
    for (const row of rows) {
      const normalized = normalizeGraphMessage(row);
      const conversationId = clean(normalized.conversationId);
      const graphMessageId = clean(normalized.graphMessageId);
      if (!conversationId || !graphMessageId) continue;
      const existing = matchesByConversation.get(conversationId);
      if (existing) { existing.messages.push(normalized); continue; }
      const matchText = [normalized.subject, normalized.bodyText, normalized.bodyPreview].filter(Boolean).join("\n");
      const context = await resolveMatterContext(conversationId, matchText);
      if (!context) continue; // not matter-related — never stored
      matchesByConversation.set(conversationId, { context, messages: [normalized], mailbox });
    }
  }

  const matchedMessages = Array.from(matchesByConversation.values()).reduce((sum, match) => sum + match.messages.length, 0);
  const matches = Array.from(matchesByConversation.entries()).map(([conversationId, match]) => ({
    conversationId,
    mailbox: match.mailbox,
    matterId: match.context?.matterId ?? null,
    matterDisplayNumber: clean(match.context?.matterDisplayNumber),
    masterLawsuitId: clean(match.context?.masterLawsuitId),
    messageCount: match.messages.length,
    subjects: Array.from(new Set(match.messages.map((message) => clean(message.subject)).filter(Boolean))).slice(0, 5),
  }));

  if (mode !== "sync") {
    return NextResponse.json({
      ...base,
      ok: true,
      previewOnly: true,
      graphCallsMade: graphCalls > 0,
      readsMailbox: graphCalls > 0,
      databaseRecordsChanged: false,
      counts: { mailboxesScanned: mailboxes.length, scannedGraphMessages, matchedMessages, discoveredThreads: matchesByConversation.size, messagesUpserted: 0, matterLinksCreated: 0, filingLogsCreated: 0 },
      matches,
      graphErrors,
      message:
        "Preview-only matter-number discovery completed.  This read recent Microsoft Graph messages across active user mailboxes and matched matter numbers (BRL_ / YYYY.MM.NNNNN) in subject/body, but did not persist local records.",
    });
  }

  let messagesUpserted = 0;
  let matterLinksCreated = 0;
  let filingLogsCreated = 0;
  const persistedResults = [];

  for (const [conversationId, match] of matchesByConversation.entries()) {
    const messages = match.messages.sort((a: any, b: any) => {
      const aTime = Date.parse(clean(a.receivedAt || a.sentAt || a.lastModifiedAt));
      const bTime = Date.parse(clean(b.receivedAt || b.sentAt || b.lastModifiedAt));
      const aSafe = Number.isFinite(aTime) ? aTime : 0;
      const bSafe = Number.isFinite(bTime) ? bTime : 0;
      return aSafe - bSafe;
    });

    const persisted = await persistGraphThreadSyncMessages({
      mailboxUserId: match.mailbox,
      conversationId,
      messages,
      context: { ...match.context, source: MAILDROP_DISCOVERY_SOURCE },
    });

    messagesUpserted += Number(persisted?.messagesUpserted || 0);
    matterLinksCreated += Number(persisted?.matterLinksCreated || 0);
    filingLogsCreated += 1;

    persistedResults.push({ conversationId, mailbox: match.mailbox, matterDisplayNumber: clean(match.context?.matterDisplayNumber), persisted });
  }

  await createMaildropDiscoveryRunLog({
    status: matchesByConversation.size ? "matched" : "no_matches",
    previewOnly: false,
    databaseChanged: true,
    metadata: { mailboxesScanned: mailboxes.length, scannedGraphMessages, matchedMessages, discoveredThreads: matchesByConversation.size, messagesUpserted, matterLinksCreated, filingLogsCreated, graphErrors },
  });

  return NextResponse.json({
    ...base,
    ok: true,
    previewOnly: false,
    graphCallsMade: graphCalls > 0,
    readsMailbox: graphCalls > 0,
    databaseRecordsChanged: messagesUpserted > 0 || matterLinksCreated > 0 || filingLogsCreated > 0,
    counts: { mailboxesScanned: mailboxes.length, scannedGraphMessages, matchedMessages, discoveredThreads: matchesByConversation.size, messagesUpserted, matterLinksCreated, filingLogsCreated },
    matches,
    persistedResults,
    graphErrors,
    message:
      "Confirmed matter-number discovery completed.  This route read recent Microsoft Graph messages across active user mailboxes, matched matter numbers (BRL_ / YYYY.MM.NNNNN) in subject/body, and persisted local Barsh Matters email metadata only.  It did not create drafts, send email, write Clio, upload documents, or use local Outlook automation.",
  });
}

export async function GET(req: NextRequest) {
  return runMaildropDiscovery(req);
}

export async function POST(req: NextRequest) {
  return runMaildropDiscovery(req);
}
