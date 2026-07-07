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

export type PersistGraphThreadSyncMessage = {
  graphMessageId?: string | null;
  internetMessageId?: string | null;
  conversationId?: string | null;
  subject?: string | null;
  from?: any;
  toRecipients?: any[];
  ccRecipients?: any[];
  bccRecipients?: any[];
  replyTo?: any[];
  sentAt?: string | null;
  receivedAt?: string | null;
  folderId?: string | null;
  folderName?: string | null;
  isDraft?: boolean;
  isRead?: boolean | null;
  hasAttachments?: boolean;
  importance?: string | null;
  bodyPreview?: string | null;
  bodyText?: string | null;
  bodyHtml?: string | null;
  webLink?: string | null;
  webLinkPresent?: boolean;
  raw?: any;
};

export type PersistGraphThreadSyncParams = {
  mailboxUserId: string;
  conversationId: string;
  messages: PersistGraphThreadSyncMessage[];
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

export type PersistGraphThreadSyncResult = {
  emailThreadId: string;
  conversationId: string;
  messagesUpserted: number;
  matterLinksCreated: number;
  filingLogId: string;
};

function graphRecipientAddress(value: any): string {
  return clean(value?.emailAddress?.address || value?.address || value?.email);
}

function graphRecipientName(value: any): string {
  return clean(value?.emailAddress?.name || value?.name || value?.displayName);
}

function graphFromDisplay(value: any): string {
  const name = graphRecipientName(value);
  const address = graphRecipientAddress(value);
  if (name && address) return `${name} <${address}>`;
  return name || address;
}

function graphFromEmail(value: any): string {
  return graphRecipientAddress(value);
}

function latestGraphMessageDate(messages: PersistGraphThreadSyncMessage[]): Date | null {
  let latest: Date | null = null;

  for (const message of messages || []) {
    const date = dateOrNull(message.receivedAt || message.sentAt);
    if (!date) continue;
    if (!latest || date.getTime() > latest.getTime()) latest = date;
  }

  return latest;
}

function graphMessageDirection(message: PersistGraphThreadSyncMessage, mailboxUserPrincipalName: string): string {
  if (message.isDraft) return "outbound";
  // Some callers pre-extract the address into `fromEmail` and pass `from` as a display string; prefer
  // the pre-extracted address, falling back to parsing the raw `from` object.
  const fromEmail = (clean((message as any).fromEmail) || graphFromEmail(message.from)).toLowerCase();
  const mailbox = clean(mailboxUserPrincipalName).toLowerCase();
  if (fromEmail && mailbox && fromEmail === mailbox) return "outbound";
  // Exchange returns the mailbox's OWN messages (its sent copies) with an X.500 legacy DN
  // (e.g. "/o=exchangelabs/ou=.../cn=...") instead of the SMTP address; our extractor can't parse that
  // and returns "", so the equality check misses them and they'd be mislabeled "inbound". Any sender
  // that isn't a real SMTP address (missing "@", including empty) is the mailbox itself → outbound.
  // Genuine external senders always have an "@" address.
  if (!fromEmail.includes("@")) return "outbound";
  return "inbound";
}

function threadDirectionFromMessages(messages: PersistGraphThreadSyncMessage[], mailboxUserPrincipalName: string): string {
  const directions = new Set(messages.map((message) => graphMessageDirection(message, mailboxUserPrincipalName)));
  if (directions.size === 1) return [...directions][0] || "unknown";
  if (directions.size > 1) return "mixed";
  return "unknown";
}

export async function persistGraphThreadSyncMessages(
  params: PersistGraphThreadSyncParams
): Promise<PersistGraphThreadSyncResult> {
  const mailboxUserPrincipalName = clean(params.mailboxUserId);
  const conversationId = clean(params.conversationId);
  const context = params.context || {};
  const messages = (params.messages || []).filter((message) => clean(message.graphMessageId));

  if (!mailboxUserPrincipalName) {
    throw new Error("Cannot persist Graph thread sync without mailbox user principal name.");
  }

  if (!conversationId) {
    throw new Error("Cannot persist Graph thread sync without conversationId.");
  }

  if (!messages.length) {
    throw new Error("Cannot persist Graph thread sync without at least one Graph message.");
  }

  const matterId = numberOrNull(context.matterId);
  const clioMatterId = numberOrNull(context.clioMatterId);
  const matterDisplayNumber = clean(context.matterDisplayNumber || context.clioDisplayNumber);
  const masterLawsuitId = clean(context.masterLawsuitId);
  const clioDisplayNumber = clean(context.clioDisplayNumber);
  const clioMaildropEmail = clean(context.clioMaildropEmail);
  const clioMaildropLabel = clean(context.clioMaildropLabel);
  const latestMessageAt = latestGraphMessageDate(messages) || new Date();
  const primaryMessage = messages[messages.length - 1] || messages[0];
  const primarySubject = clean(primaryMessage?.subject || messages[0]?.subject);
  const primaryInternetMessageId = clean(primaryMessage?.internetMessageId || messages[0]?.internetMessageId);
  const direction = threadDirectionFromMessages(messages, mailboxUserPrincipalName);
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
      internetMessageId: primaryInternetMessageId || undefined,
      subject: primarySubject || undefined,
      normalizedSubject: primarySubject.toLowerCase() || undefined,
      latestMessageAt,
      lastSyncedAt: now,
      direction,
      source: clean(context.source) || "graph_thread_sync",
      matterId,
      matterDisplayNumber: matterDisplayNumber || null,
      masterLawsuitId: masterLawsuitId || null,
      clioMatterId,
      clioDisplayNumber: clioDisplayNumber || null,
      clioMaildropEmail: clioMaildropEmail || null,
      clioMaildropLabel: clioMaildropLabel || null,
      status: "active",
      metadata: {
        lastGraphThreadSyncAt: now.toISOString(),
        syncedMessageCount: messages.length,
        attachmentMetadataOnly: true,
      },
    },
    create: {
      provider: PROVIDER,
      mailboxUserPrincipalName,
      conversationId,
      internetMessageId: primaryInternetMessageId || null,
      subject: primarySubject || null,
      normalizedSubject: primarySubject.toLowerCase() || null,
      latestMessageAt,
      lastSyncedAt: now,
      direction,
      source: clean(context.source) || "graph_thread_sync",
      matterId,
      matterDisplayNumber: matterDisplayNumber || null,
      masterLawsuitId: masterLawsuitId || null,
      clioMatterId,
      clioDisplayNumber: clioDisplayNumber || null,
      clioMaildropEmail: clioMaildropEmail || null,
      clioMaildropLabel: clioMaildropLabel || null,
      status: "active",
      metadata: {
        firstGraphThreadSyncAt: now.toISOString(),
        syncedMessageCount: messages.length,
        attachmentMetadataOnly: true,
      },
    },
  });

  let messagesUpserted = 0;
  let matterLinksCreated = 0;
  let lastMessageId: string | null = null;

  for (const message of messages) {
    const graphMessageId = clean(message.graphMessageId);
    if (!graphMessageId) continue;

    const messageDirection = graphMessageDirection(message, mailboxUserPrincipalName);
    const isDraft = Boolean(message.isDraft);
    const sentAt = dateOrNull(message.sentAt);
    const receivedAt = dateOrNull(message.receivedAt);
    const from = graphFromDisplay(message.from);
    // Prefer a pre-extracted address (background sync flattens `from` to a display string and provides
    // `fromEmail` separately); otherwise parse the raw `from` object (manual thread-sync path).
    const fromEmail = clean((message as any).fromEmail) || graphFromEmail(message.from);
    const bodyPreview = clean(message.bodyPreview);
    const bodyText = clean(message.bodyText);
    const bodyHtml = clean(message.bodyHtml);
    const webLink = clean(message.webLink);

    const persistedMessage = await prisma.emailMessage.upsert({
      where: {
        provider_graphMessageId_mailboxUserPrincipalName: {
          provider: PROVIDER,
          graphMessageId,
          mailboxUserPrincipalName,
        },
      },
      update: {
        threadId: thread.id,
        internetMessageId: clean(message.internetMessageId) || undefined,
        conversationId,
        subject: clean(message.subject) || undefined,
        from: from || null,
        fromEmail: fromEmail || null,
        toRecipients: Array.isArray(message.toRecipients) ? message.toRecipients : [],
        ccRecipients: Array.isArray(message.ccRecipients) ? message.ccRecipients : [],
        bccRecipients: Array.isArray(message.bccRecipients) ? message.bccRecipients : [],
        replyTo: Array.isArray(message.replyTo) ? message.replyTo : [],
        sentAt,
        receivedAt,
        folderId: clean(message.folderId) || null,
        folderName: clean(message.folderName) || (isDraft ? "drafts" : null),
        direction: messageDirection,
        isDraft,
        isSent: !isDraft && Boolean(sentAt),
        isRead: typeof message.isRead === "boolean" ? message.isRead : null,
        hasAttachments: Boolean(message.hasAttachments),
        importance: clean(message.importance) || null,
        bodyPreview: bodyPreview || null,
        bodyText: bodyText || null,
        bodyHtml: bodyHtml || null,
        webLink: webLink || null,
        raw: {
          source: "graph_thread_sync",
          graphMessage: message.raw || message,
          attachmentMetadataOnly: true,
        },
      },
      create: {
        threadId: thread.id,
        provider: PROVIDER,
        mailboxUserPrincipalName,
        graphMessageId,
        internetMessageId: clean(message.internetMessageId) || null,
        conversationId,
        subject: clean(message.subject) || null,
        from: from || null,
        fromEmail: fromEmail || null,
        toRecipients: Array.isArray(message.toRecipients) ? message.toRecipients : [],
        ccRecipients: Array.isArray(message.ccRecipients) ? message.ccRecipients : [],
        bccRecipients: Array.isArray(message.bccRecipients) ? message.bccRecipients : [],
        replyTo: Array.isArray(message.replyTo) ? message.replyTo : [],
        sentAt,
        receivedAt,
        folderId: clean(message.folderId) || null,
        folderName: clean(message.folderName) || (isDraft ? "drafts" : null),
        direction: messageDirection,
        isDraft,
        isSent: !isDraft && Boolean(sentAt),
        isRead: typeof message.isRead === "boolean" ? message.isRead : null,
        hasAttachments: Boolean(message.hasAttachments),
        importance: clean(message.importance) || null,
        bodyPreview: bodyPreview || null,
        bodyText: bodyText || null,
        bodyHtml: bodyHtml || null,
        webLink: webLink || null,
        raw: {
          source: "graph_thread_sync",
          graphMessage: message.raw || message,
          attachmentMetadataOnly: true,
        },
      },
    });

    messagesUpserted += 1;
    lastMessageId = persistedMessage.id;

    if (matterId || matterDisplayNumber || masterLawsuitId || clioMatterId || clioDisplayNumber) {
      const existingLink = await prisma.emailMatterLink.findFirst({
        where: {
          threadId: thread.id,
          messageId: persistedMessage.id,
          linkReason: "graph_thread_sync",
        },
      });

      if (!existingLink) {
        await prisma.emailMatterLink.create({
          data: {
            threadId: thread.id,
            messageId: persistedMessage.id,
            matterId,
            matterDisplayNumber: matterDisplayNumber || null,
            masterLawsuitId: masterLawsuitId || null,
            clioMatterId,
            clioDisplayNumber: clioDisplayNumber || null,
            linkReason: "graph_thread_sync",
            confidence: "confirmed",
            createdBy: "barsh_matters_graph_sync",
            metadata: {
              clioMaildropEmail,
              clioMaildropLabel,
              graphMessageId,
              conversationId,
            },
          },
        });
        matterLinksCreated += 1;
      }
    }
  }

  const filingLog = await prisma.emailFilingLog.create({
    data: {
      threadId: thread.id,
      messageId: lastMessageId,
      provider: PROVIDER,
      targetSystem: "barsh_matters",
      targetType: "email_thread",
      targetId: conversationId,
      action: "graph_thread_sync_persisted",
      status: "synced",
      previewOnly: false,
      clioRecordsChanged: false,
      databaseChanged: true,
      requestedBy: "barsh_matters",
      metadata: {
        mailboxUserPrincipalName,
        conversationId,
        messagesUpserted,
        matterLinksCreated,
        attachmentMetadataOnly: true,
      },
    },
  });

  return {
    emailThreadId: thread.id,
    conversationId,
    messagesUpserted,
    matterLinksCreated,
    filingLogId: filingLog.id,
  };
}
