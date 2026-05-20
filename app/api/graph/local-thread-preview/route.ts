import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function numberOrUndefined(value: string | null): number | undefined {
  const raw = clean(value);
  if (!raw) return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

async function expectedMasterDisplayNumber(masterLawsuitId: string): Promise<string> {
  if (!masterLawsuitId) return "";

  const lawsuit = await prisma.lawsuit.findUnique({
    where: { masterLawsuitId },
    select: {
      clioMasterDisplayNumber: true,
    },
  });

  return clean(lawsuit?.clioMasterDisplayNumber);
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl;

  const graphMessageId = clean(url.searchParams.get("graphMessageId"));
  const conversationId = clean(url.searchParams.get("conversationId"));
  const masterLawsuitId = clean(url.searchParams.get("masterLawsuitId"));
  const matterDisplayNumber = clean(url.searchParams.get("matterDisplayNumber"));
  const clioDisplayNumber = clean(url.searchParams.get("clioDisplayNumber"));
  const matterId = numberOrUndefined(url.searchParams.get("matterId"));
  const clioMatterId = numberOrUndefined(url.searchParams.get("clioMatterId"));
  const limit = Math.min(Math.max(numberOrUndefined(url.searchParams.get("limit")) || 10, 1), 50);

  const messageWhere: any = {};
  if (graphMessageId) messageWhere.graphMessageId = graphMessageId;
  if (conversationId) messageWhere.conversationId = conversationId;

  const mappedMasterDisplayNumber = masterLawsuitId
    ? await expectedMasterDisplayNumber(masterLawsuitId)
    : "";

  const shouldStrictFilterMasterThreads = Boolean(
    masterLawsuitId &&
    mappedMasterDisplayNumber &&
    !conversationId &&
    !matterDisplayNumber &&
    !clioDisplayNumber &&
    matterId === undefined &&
    clioMatterId === undefined
  );

  const threadWhere: any = {};
  if (conversationId) threadWhere.conversationId = conversationId;
  if (masterLawsuitId) threadWhere.masterLawsuitId = masterLawsuitId;
  if (matterDisplayNumber) threadWhere.matterDisplayNumber = matterDisplayNumber;
  if (clioDisplayNumber) threadWhere.clioDisplayNumber = clioDisplayNumber;
  if (matterId !== undefined) threadWhere.matterId = matterId;
  if (clioMatterId !== undefined) threadWhere.clioMatterId = clioMatterId;
  if (shouldStrictFilterMasterThreads) {
    threadWhere.OR = [
      { matterDisplayNumber: mappedMasterDisplayNumber },
      { clioDisplayNumber: mappedMasterDisplayNumber },
    ];
  }

  const threads = await prisma.emailThread.findMany({
    where: Object.keys(threadWhere).length ? threadWhere : undefined,
    orderBy: [{ latestMessageAt: "desc" }, { createdAt: "desc" }],
    take: limit,
    include: {
      messages: {
        where: Object.keys(messageWhere).length ? messageWhere : undefined,
        orderBy: [{ receivedAt: "asc" }, { sentAt: "asc" }, { createdAt: "asc" }],
        include: {
          attachments: {
            orderBy: { createdAt: "asc" },
          },
        },
      },
    },
  });

  const threadIds = threads.map((thread) => thread.id);
  const messageIds = threads.flatMap((thread) => thread.messages.map((message) => message.id));

  const [matterLinks, filingLogs] = await Promise.all([
    prisma.emailMatterLink.findMany({
      where: {
        OR: [
          threadIds.length ? { threadId: { in: threadIds } } : undefined,
          messageIds.length ? { messageId: { in: messageIds } } : undefined,
        ].filter(Boolean) as any[],
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.emailFilingLog.findMany({
      where: {
        OR: [
          threadIds.length ? { threadId: { in: threadIds } } : undefined,
          messageIds.length ? { messageId: { in: messageIds } } : undefined,
        ].filter(Boolean) as any[],
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);

  return NextResponse.json({
    action: "graph-local-thread-preview",
    readOnly: true,
    previewOnly: true,
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
    query: {
      graphMessageId: graphMessageId || null,
      conversationId: conversationId || null,
      masterLawsuitId: masterLawsuitId || null,
      matterDisplayNumber: matterDisplayNumber || null,
      clioDisplayNumber: clioDisplayNumber || null,
      matterId: matterId ?? null,
      clioMatterId: clioMatterId ?? null,
      mappedMasterDisplayNumber: mappedMasterDisplayNumber || null,
      strictMasterDisplayFilterApplied: shouldStrictFilterMasterThreads,
      limit,
    },
    counts: {
      threads: threads.length,
      messages: threads.reduce((sum, thread) => sum + thread.messages.length, 0),
      attachments: threads.reduce(
        (sum, thread) => sum + thread.messages.reduce((inner, message) => inner + message.attachments.length, 0),
        0
      ),
      matterLinks: matterLinks.length,
      filingLogs: filingLogs.length,
    },
    threads: threads.map((thread) => ({
      id: thread.id,
      provider: thread.provider,
      mailboxUserPrincipalName: thread.mailboxUserPrincipalName,
      conversationId: thread.conversationId,
      internetMessageId: thread.internetMessageId,
      subject: thread.subject,
      latestMessageAt: thread.latestMessageAt,
      direction: thread.direction,
      source: thread.source,
      matterId: thread.matterId,
      matterDisplayNumber: thread.matterDisplayNumber,
      masterLawsuitId: thread.masterLawsuitId,
      clioMatterId: thread.clioMatterId,
      clioDisplayNumber: thread.clioDisplayNumber,
      clioMaildropEmailPresent: Boolean(thread.clioMaildropEmail),
      clioMaildropLabel: thread.clioMaildropLabel,
      status: thread.status,
      messages: thread.messages.map((message) => ({
        id: message.id,
        graphMessageId: message.graphMessageId,
        internetMessageId: message.internetMessageId,
        conversationId: message.conversationId,
        subject: message.subject,
        from: message.from,
        fromEmail: message.fromEmail,
        toRecipients: message.toRecipients,
        ccRecipients: message.ccRecipients,
        bccRecipients: message.bccRecipients,
        sentAt: message.sentAt,
        receivedAt: message.receivedAt,
        folderName: message.folderName,
        direction: message.direction,
        isDraft: message.isDraft,
        isSent: message.isSent,
        hasAttachments: message.hasAttachments,
        bodyPreview: message.bodyPreview,
        webLink: message.webLink,
        webLinkPresent: Boolean(message.webLink),
        attachments: message.attachments.map((attachment) => ({
          id: attachment.id,
          name: attachment.name,
          contentType: attachment.contentType,
          sizeBytes: attachment.sizeBytes,
          storageStatus: attachment.storageStatus,
          clioDocumentId: attachment.clioDocumentId,
          clioDocumentName: attachment.clioDocumentName,
          clioDocumentVersionUuid: attachment.clioDocumentVersionUuid,
        })),
      })),
    })),
    matterLinks,
    filingLogs,
    note:
      "Read-only local email-thread preview.  This route reads Barsh Matters local email metadata only and does not call Microsoft Graph, read a mailbox, send email, create drafts, write Clio, or modify database records.",
  });
}
