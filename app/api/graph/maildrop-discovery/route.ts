import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { graphApiBase, graphFetchJson } from "@/lib/graph/client";
import { getGraphAuthConfig, getGraphAuthReadiness } from "@/lib/graph/config";
import { persistGraphThreadSyncMessages } from "@/lib/graph/emailPersistence";
import { loadKnownMaildropAddresses } from "@/lib/graph/maildropRegistry";


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

async function loadKnownMaildrops(limit: number) {
  return loadKnownMaildropAddresses(limit);
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

  if (!readiness.readyForFutureReadOnlySync) {
    return NextResponse.json(
      {
        ...base,
        ok: false,
        graphReadiness: readiness,
        error:
          "Microsoft Graph read-only sync is not configured.  Configure tenant ID, client ID, client secret, and mailbox user before running MailDrop discovery.",
      },
      { status: 503 }
    );
  }

  const knownMaildrops = await loadKnownMaildrops(maildropLimit);
  const knownByEmail = new Map<string, any>();
  for (const record of knownMaildrops) {
    const email = lowerEmail(record.clioMaildropEmail);
    if (email) knownByEmail.set(email, record);
  }

  if (knownByEmail.size === 0) {
    return NextResponse.json({
      ...base,
      ok: true,
      graphCallsMade: false,
      readsMailbox: false,
      counts: {
        knownMaildrops: 0,
        scannedGraphMessages: 0,
        matchedMessages: 0,
        discoveredThreads: 0,
        messagesUpserted: 0,
        matterLinksCreated: 0,
        filingLogsCreated: 0,
      },
      matches: [],
      message:
        "No locally known Clio MailDrop addresses were available for discovery.  Resolve or create at least one MailDrop-linked thread first.",
    });
  }

  const graphResult = await graphFetchJson({
    url: graphRecentMessagesUrl(config.mailboxUserId, messageLimit),
    method: "GET",
  });

  if (!graphResult.ok) {
    return NextResponse.json(
      {
        ...base,
        ok: false,
        graphCallsMade: true,
        readsMailbox: true,
        graphStatus: graphResult.status,
        graphError: graphResult.error || graphResult.statusText,
        error: graphResult.error || graphResult.statusText || "Microsoft Graph recent-message lookup failed.",
      },
      { status: 502 }
    );
  }

  const rows = Array.isArray(graphResult.json?.value) ? graphResult.json.value : [];
  const matchesByConversation = new Map<string, { maildrop: any; messages: any[]; matchedMaildropEmail: string }>();

  for (const row of rows) {
    const recipients = new Set(allRecipientEmails(row));
    for (const [maildropEmail, maildrop] of knownByEmail.entries()) {
      if (!recipients.has(maildropEmail)) continue;

      const normalized = normalizeGraphMessage(row);
      const conversationId = clean(normalized.conversationId);
      const graphMessageId = clean(normalized.graphMessageId);
      if (!conversationId || !graphMessageId) continue;

      if (!matchesByConversation.has(conversationId)) {
        matchesByConversation.set(conversationId, {
          maildrop,
          messages: [],
          matchedMaildropEmail: maildropEmail,
        });
      }

      matchesByConversation.get(conversationId)?.messages.push(normalized);
      break;
    }
  }

  const matches = Array.from(matchesByConversation.entries()).map(([conversationId, match]) => ({
    conversationId,
    matchedMaildropEmail: match.matchedMaildropEmail,
    clioMaildropLabel: clean(match.maildrop.clioMaildropLabel),
    matterId: match.maildrop.matterId,
    matterDisplayNumber: clean(match.maildrop.matterDisplayNumber),
    masterLawsuitId: clean(match.maildrop.masterLawsuitId),
    clioMatterId: match.maildrop.clioMatterId,
    clioDisplayNumber: clean(match.maildrop.clioDisplayNumber),
    messageCount: match.messages.length,
    subjects: Array.from(new Set(match.messages.map((message) => clean(message.subject)).filter(Boolean))).slice(0, 5),
  }));

  if (mode !== "sync") {
    return NextResponse.json({
      ...base,
      ok: true,
      previewOnly: true,
      graphCallsMade: true,
      readsMailbox: true,
      databaseRecordsChanged: false,
      counts: {
        knownMaildrops: knownByEmail.size,
        scannedGraphMessages: rows.length,
        matchedMessages: Array.from(matchesByConversation.values()).reduce((sum, match) => sum + match.messages.length, 0),
        discoveredThreads: matchesByConversation.size,
        messagesUpserted: 0,
        matterLinksCreated: 0,
        filingLogsCreated: 0,
      },
      matches,
      nextLinkPresent: Boolean(clean(graphResult.json?.["@odata.nextLink"])),
      message:
        "Preview-only MailDrop discovery completed.  This read recent Microsoft Graph messages and matched locally known MailDrop recipients, but did not persist local records.",
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
      mailboxUserId: config.mailboxUserId,
      conversationId,
      messages,
      context: contextFromMaildropRecord(match.maildrop),
    });

    messagesUpserted += Number(persisted?.messagesUpserted || 0);
    matterLinksCreated += Number(persisted?.matterLinksCreated || 0);
    filingLogsCreated += 1;

    persistedResults.push({
      conversationId,
      matchedMaildropEmail: match.matchedMaildropEmail,
      persisted,
    });
  }

  await createMaildropDiscoveryRunLog({
    status: matchesByConversation.size ? "matched" : "no_matches",
    previewOnly: false,
    databaseChanged: true,
    metadata: {
      knownMaildrops: knownByEmail.size,
      scannedGraphMessages: rows.length,
      matchedMessages: Array.from(matchesByConversation.values()).reduce((sum, match) => sum + match.messages.length, 0),
      discoveredThreads: matchesByConversation.size,
      messagesUpserted,
      matterLinksCreated,
      filingLogsCreated,
      nextLinkPresent: Boolean(clean(graphResult.json?.["@odata.nextLink"])),
    },
  });

  return NextResponse.json({
    ...base,
    ok: true,
    previewOnly: false,
    graphCallsMade: true,
    readsMailbox: true,
    databaseRecordsChanged: messagesUpserted > 0 || matterLinksCreated > 0 || filingLogsCreated > 0,
    counts: {
      knownMaildrops: knownByEmail.size,
      scannedGraphMessages: rows.length,
      matchedMessages: Array.from(matchesByConversation.values()).reduce((sum, match) => sum + match.messages.length, 0),
      discoveredThreads: matchesByConversation.size,
      messagesUpserted,
      matterLinksCreated,
      filingLogsCreated,
    },
    matches,
    persistedResults,
    nextLinkPresent: Boolean(clean(graphResult.json?.["@odata.nextLink"])),
    message:
      "Confirmed MailDrop discovery completed.  This route read recent Microsoft Graph messages, matched locally known MailDrop recipients, and persisted local Barsh Matters email metadata only.  It did not create drafts, send email, write Clio, upload documents, or use local Outlook automation.",
  });
}

export async function GET(req: NextRequest) {
  return runMaildropDiscovery(req);
}

export async function POST(req: NextRequest) {
  return runMaildropDiscovery(req);
}
