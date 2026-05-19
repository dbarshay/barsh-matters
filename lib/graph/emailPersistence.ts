import { prisma } from "@/lib/prisma";

const PROVIDER = "microsoft_graph";

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function numberOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const raw = clean(value);
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function dateOrNull(value: unknown): Date | null {
  const raw = clean(value);
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function firstEmailAddress(recipients: any[]): string {
  for (const recipient of recipients || []) {
    const address = clean(recipient?.emailAddress?.address || recipient?.email || recipient?.address);
    if (address) return address;
  }
  return "";
}

export type PersistGraphDraftMetadataParams = {
  mailboxUserId: string;
  graphDraft: {
    graphMessageId?: string | null;
    internetMessageId?: string | null;
    conversationId?: string | null;
    subject?: string | null;
    webLink?: string | null;
    createdDateTime?: string | null;
    lastModifiedDateTime?: string | null;
  };
  payload: {
    graphMessagePayload?: any;
    attachmentPlan?: any[];
    validation?: any;
  };
  context?: {
    source?: string | null;
    matterId?: string | number | null;
    matterDisplayNumber?: string | null;
    masterLawsuitId?: string | null;
    clioMatterId?: string | number | null;
    clioDisplayNumber?: string | null;
    clioMaildropEmail?: string | null;
    clioMaildropLabel?: string | null;
  };
};

export type PersistGraphDraftMetadataResult = {
  emailThreadId: string;
  emailMessageId: string;
  emailMatterLinkId: string | null;
  emailFilingLogId: string;
  graphMessageId: string;
  conversationId: string;
};

export async function persistGraphDraftMetadata(
  params: PersistGraphDraftMetadataParams
): Promise<PersistGraphDraftMetadataResult> {
  const mailboxUserPrincipalName = clean(params.mailboxUserId);
  const graphMessageId = clean(params.graphDraft.graphMessageId);
  const conversationId = clean(params.graphDraft.conversationId);
  const subject = clean(params.graphDraft.subject || params.payload.graphMessagePayload?.subject);
  const internetMessageId = clean(params.graphDraft.internetMessageId);
  const webLink = clean(params.graphDraft.webLink);
  const createdDateTime = clean(params.graphDraft.createdDateTime);
  const lastModifiedDateTime = clean(params.graphDraft.lastModifiedDateTime);
  const graphPayload = params.payload.graphMessagePayload || {};
  const toRecipients = Array.isArray(graphPayload.toRecipients) ? graphPayload.toRecipients : [];
  const ccRecipients = Array.isArray(graphPayload.ccRecipients) ? graphPayload.ccRecipients : [];
  const bccRecipients = Array.isArray(graphPayload.bccRecipients) ? graphPayload.bccRecipients : [];
  const context = params.context || {};

  if (!mailboxUserPrincipalName) {
    throw new Error("Cannot persist Graph draft metadata without mailbox user principal name.");
  }
  if (!graphMessageId) {
    throw new Error("Cannot persist Graph draft metadata without graphMessageId.");
  }
  if (!conversationId) {
    throw new Error("Cannot persist Graph draft metadata without conversationId.");
  }

  const matterId = numberOrNull(context.matterId);
  const clioMatterId = numberOrNull(context.clioMatterId);
  const matterDisplayNumber = clean(context.matterDisplayNumber || context.clioDisplayNumber);
  const masterLawsuitId = clean(context.masterLawsuitId);
  const clioDisplayNumber = clean(context.clioDisplayNumber);
  const clioMaildropEmail = clean(context.clioMaildropEmail);
  const clioMaildropLabel = clean(context.clioMaildropLabel);
  const now = new Date();

  const thread = await prisma.emailThread.upsert({
    where: {
      provider_conversationId_mailboxUserPrincipalName: {
        provider: PROVIDER,
        conversationId,
        mailboxUserPrincipalName,
      },
    },
    update: {
      internetMessageId: internetMessageId || undefined,
      subject: subject || undefined,
      normalizedSubject: subject.toLowerCase() || undefined,
      latestMessageAt: dateOrNull(createdDateTime) || now,
      lastSyncedAt: now,
      direction: "outbound",
      source: clean(context.source) || "graph_draft",
      matterId,
      matterDisplayNumber: matterDisplayNumber || null,
      masterLawsuitId: masterLawsuitId || null,
      clioMatterId,
      clioDisplayNumber: clioDisplayNumber || null,
      clioMaildropEmail: clioMaildropEmail || null,
      clioMaildropLabel: clioMaildropLabel || null,
      status: "active",
      metadata: {
        lastDraftGraphMessageId: graphMessageId,
        validation: params.payload.validation || null,
      },
    },
    create: {
      provider: PROVIDER,
      mailboxUserPrincipalName,
      conversationId,
      internetMessageId: internetMessageId || null,
      subject: subject || null,
      normalizedSubject: subject.toLowerCase() || null,
      latestMessageAt: dateOrNull(createdDateTime) || now,
      lastSyncedAt: now,
      direction: "outbound",
      source: clean(context.source) || "graph_draft",
      matterId,
      matterDisplayNumber: matterDisplayNumber || null,
      masterLawsuitId: masterLawsuitId || null,
      clioMatterId,
      clioDisplayNumber: clioDisplayNumber || null,
      clioMaildropEmail: clioMaildropEmail || null,
      clioMaildropLabel: clioMaildropLabel || null,
      status: "active",
      metadata: {
        firstDraftGraphMessageId: graphMessageId,
        validation: params.payload.validation || null,
      },
    },
  });

  const message = await prisma.emailMessage.upsert({
    where: {
      provider_graphMessageId_mailboxUserPrincipalName: {
        provider: PROVIDER,
        graphMessageId,
        mailboxUserPrincipalName,
      },
    },
    update: {
      threadId: thread.id,
      internetMessageId: internetMessageId || undefined,
      conversationId,
      subject: subject || undefined,
      from: mailboxUserPrincipalName,
      fromEmail: mailboxUserPrincipalName,
      toRecipients,
      ccRecipients,
      bccRecipients,
      sentAt: null,
      receivedAt: null,
      direction: "outbound",
      isDraft: true,
      isSent: false,
      hasAttachments: Array.isArray(params.payload.attachmentPlan) && params.payload.attachmentPlan.length > 0,
      bodyPreview: clean(graphPayload.body?.content).slice(0, 500) || null,
      bodyText: clean(graphPayload.body?.content) || null,
      webLink: webLink || null,
      raw: {
        graphDraft: params.graphDraft,
        graphMessagePayload: graphPayload,
        attachmentPlan: params.payload.attachmentPlan || [],
      },
    },
    create: {
      threadId: thread.id,
      provider: PROVIDER,
      mailboxUserPrincipalName,
      graphMessageId,
      internetMessageId: internetMessageId || null,
      conversationId,
      subject: subject || null,
      from: mailboxUserPrincipalName,
      fromEmail: mailboxUserPrincipalName,
      toRecipients,
      ccRecipients,
      bccRecipients,
      sentAt: null,
      receivedAt: null,
      folderName: "drafts",
      direction: "outbound",
      isDraft: true,
      isSent: false,
      isRead: true,
      hasAttachments: Array.isArray(params.payload.attachmentPlan) && params.payload.attachmentPlan.length > 0,
      bodyPreview: clean(graphPayload.body?.content).slice(0, 500) || null,
      bodyText: clean(graphPayload.body?.content) || null,
      webLink: webLink || null,
      raw: {
        graphDraft: params.graphDraft,
        graphMessagePayload: graphPayload,
        attachmentPlan: params.payload.attachmentPlan || [],
      },
    },
  });

  for (const attachment of params.payload.attachmentPlan || []) {
    await prisma.emailAttachment.create({
      data: {
        messageId: message.id,
        provider: PROVIDER,
        name: clean(attachment?.name) || null,
        contentType: clean(attachment?.contentType) || null,
        sizeBytes: numberOrNull(attachment?.sizeBytes),
        isInline: false,
        clioDocumentId: attachment?.clioDocumentId === undefined || attachment?.clioDocumentId === null
          ? null
          : String(attachment.clioDocumentId),
        clioDocumentName: clean(attachment?.clioDocumentName) || clean(attachment?.name) || null,
        clioDocumentVersionUuid: clean(attachment?.clioDocumentVersionUuid) || null,
        storageStatus: "metadata_only",
        metadata: attachment,
      },
    });
  }

  const link = await prisma.emailMatterLink.create({
    data: {
      threadId: thread.id,
      messageId: message.id,
      matterId,
      matterDisplayNumber: matterDisplayNumber || null,
      masterLawsuitId: masterLawsuitId || null,
      clioMatterId,
      clioDisplayNumber: clioDisplayNumber || null,
      linkReason: "graph_draft_create",
      confidence: "confirmed",
      createdBy: "barsh_matters_graph",
      metadata: {
        clioMaildropEmail,
        clioMaildropLabel,
        firstToRecipient: firstEmailAddress(toRecipients),
        firstCcRecipient: firstEmailAddress(ccRecipients),
      },
    },
  });

  const filingLog = await prisma.emailFilingLog.create({
    data: {
      threadId: thread.id,
      messageId: message.id,
      provider: PROVIDER,
      targetSystem: "microsoft_graph",
      targetType: "outlook_draft",
      targetId: graphMessageId,
      action: "graph_draft_created",
      status: "created",
      previewOnly: false,
      clioRecordsChanged: false,
      databaseChanged: true,
      requestedBy: "barsh_matters",
      metadata: {
        conversationId,
        internetMessageId,
        webLinkPresent: Boolean(webLink),
        createdDateTime,
        lastModifiedDateTime,
        attachmentUploadDeferred: true,
      },
    },
  });

  return {
    emailThreadId: thread.id,
    emailMessageId: message.id,
    emailMatterLinkId: link.id,
    emailFilingLogId: filingLog.id,
    graphMessageId,
    conversationId,
  };
}
