-- Add Microsoft Graph / Outlook email-thread local foundation.
-- These tables are local Barsh Matters records only.  This migration does not call Microsoft Graph, send email, write to Clio, or alter existing document records.

CREATE TABLE IF NOT EXISTS "EmailThread" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'microsoft_graph',
    "mailboxUserId" TEXT,
    "mailboxUserPrincipalName" TEXT,
    "conversationId" TEXT NOT NULL,
    "internetMessageId" TEXT,
    "subject" TEXT,
    "normalizedSubject" TEXT,
    "latestMessageAt" TIMESTAMP(3),
    "lastSyncedAt" TIMESTAMP(3),
    "direction" TEXT,
    "source" TEXT,
    "matterId" INTEGER,
    "matterDisplayNumber" TEXT,
    "masterLawsuitId" TEXT,
    "clioMatterId" INTEGER,
    "clioDisplayNumber" TEXT,
    "clioMaildropEmail" TEXT,
    "clioMaildropLabel" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EmailThread_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "EmailMessage" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'microsoft_graph',
    "mailboxUserId" TEXT,
    "mailboxUserPrincipalName" TEXT,
    "graphMessageId" TEXT,
    "internetMessageId" TEXT,
    "conversationId" TEXT,
    "subject" TEXT,
    "from" TEXT,
    "fromEmail" TEXT,
    "toRecipients" JSONB,
    "ccRecipients" JSONB,
    "bccRecipients" JSONB,
    "replyTo" JSONB,
    "sentAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "folderId" TEXT,
    "folderName" TEXT,
    "direction" TEXT,
    "isDraft" BOOLEAN NOT NULL DEFAULT false,
    "isSent" BOOLEAN NOT NULL DEFAULT false,
    "isRead" BOOLEAN,
    "hasAttachments" BOOLEAN NOT NULL DEFAULT false,
    "importance" TEXT,
    "bodyPreview" TEXT,
    "bodyText" TEXT,
    "bodyHtml" TEXT,
    "webLink" TEXT,
    "raw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EmailMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "EmailAttachment" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'microsoft_graph',
    "graphAttachmentId" TEXT,
    "name" TEXT,
    "contentType" TEXT,
    "sizeBytes" INTEGER,
    "isInline" BOOLEAN NOT NULL DEFAULT false,
    "contentId" TEXT,
    "clioDocumentId" TEXT,
    "clioDocumentName" TEXT,
    "clioDocumentVersionUuid" TEXT,
    "storageStatus" TEXT NOT NULL DEFAULT 'metadata_only',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EmailAttachment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "EmailSyncState" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'microsoft_graph',
    "mailboxUserId" TEXT,
    "mailboxUserPrincipalName" TEXT,
    "folderId" TEXT,
    "folderName" TEXT NOT NULL,
    "deltaLink" TEXT,
    "nextLink" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "lastSuccessfulSyncAt" TIMESTAMP(3),
    "lastErrorAt" TIMESTAMP(3),
    "lastError" TEXT,
    "status" TEXT NOT NULL DEFAULT 'idle',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EmailSyncState_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "EmailMatterLink" (
    "id" TEXT NOT NULL,
    "threadId" TEXT,
    "messageId" TEXT,
    "matterId" INTEGER,
    "matterDisplayNumber" TEXT,
    "masterLawsuitId" TEXT,
    "clioMatterId" INTEGER,
    "clioDisplayNumber" TEXT,
    "linkReason" TEXT,
    "confidence" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    CONSTRAINT "EmailMatterLink_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "EmailFilingLog" (
    "id" TEXT NOT NULL,
    "threadId" TEXT,
    "messageId" TEXT,
    "provider" TEXT NOT NULL DEFAULT 'microsoft_graph',
    "targetSystem" TEXT NOT NULL DEFAULT 'clio',
    "targetType" TEXT,
    "targetId" TEXT,
    "action" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'preview',
    "previewOnly" BOOLEAN NOT NULL DEFAULT true,
    "clioRecordsChanged" BOOLEAN NOT NULL DEFAULT false,
    "databaseChanged" BOOLEAN NOT NULL DEFAULT false,
    "requestedBy" TEXT,
    "error" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EmailFilingLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "EmailThread_provider_conversationId_mailboxUserPrincipalName_key" ON "EmailThread"("provider", "conversationId", "mailboxUserPrincipalName");
CREATE INDEX IF NOT EXISTS "EmailThread_provider_idx" ON "EmailThread"("provider");
CREATE INDEX IF NOT EXISTS "EmailThread_conversationId_idx" ON "EmailThread"("conversationId");
CREATE INDEX IF NOT EXISTS "EmailThread_internetMessageId_idx" ON "EmailThread"("internetMessageId");
CREATE INDEX IF NOT EXISTS "EmailThread_matterId_idx" ON "EmailThread"("matterId");
CREATE INDEX IF NOT EXISTS "EmailThread_matterDisplayNumber_idx" ON "EmailThread"("matterDisplayNumber");
CREATE INDEX IF NOT EXISTS "EmailThread_masterLawsuitId_idx" ON "EmailThread"("masterLawsuitId");
CREATE INDEX IF NOT EXISTS "EmailThread_clioMatterId_idx" ON "EmailThread"("clioMatterId");
CREATE INDEX IF NOT EXISTS "EmailThread_clioDisplayNumber_idx" ON "EmailThread"("clioDisplayNumber");
CREATE INDEX IF NOT EXISTS "EmailThread_latestMessageAt_idx" ON "EmailThread"("latestMessageAt");

CREATE UNIQUE INDEX IF NOT EXISTS "EmailMessage_provider_graphMessageId_mailboxUserPrincipalName_key" ON "EmailMessage"("provider", "graphMessageId", "mailboxUserPrincipalName");
CREATE INDEX IF NOT EXISTS "EmailMessage_threadId_idx" ON "EmailMessage"("threadId");
CREATE INDEX IF NOT EXISTS "EmailMessage_provider_idx" ON "EmailMessage"("provider");
CREATE INDEX IF NOT EXISTS "EmailMessage_graphMessageId_idx" ON "EmailMessage"("graphMessageId");
CREATE INDEX IF NOT EXISTS "EmailMessage_internetMessageId_idx" ON "EmailMessage"("internetMessageId");
CREATE INDEX IF NOT EXISTS "EmailMessage_conversationId_idx" ON "EmailMessage"("conversationId");
CREATE INDEX IF NOT EXISTS "EmailMessage_sentAt_idx" ON "EmailMessage"("sentAt");
CREATE INDEX IF NOT EXISTS "EmailMessage_receivedAt_idx" ON "EmailMessage"("receivedAt");
CREATE INDEX IF NOT EXISTS "EmailMessage_folderName_idx" ON "EmailMessage"("folderName");
CREATE INDEX IF NOT EXISTS "EmailMessage_direction_idx" ON "EmailMessage"("direction");

CREATE INDEX IF NOT EXISTS "EmailAttachment_messageId_idx" ON "EmailAttachment"("messageId");
CREATE INDEX IF NOT EXISTS "EmailAttachment_graphAttachmentId_idx" ON "EmailAttachment"("graphAttachmentId");
CREATE INDEX IF NOT EXISTS "EmailAttachment_clioDocumentId_idx" ON "EmailAttachment"("clioDocumentId");
CREATE INDEX IF NOT EXISTS "EmailAttachment_storageStatus_idx" ON "EmailAttachment"("storageStatus");

CREATE UNIQUE INDEX IF NOT EXISTS "EmailSyncState_provider_mailboxUserPrincipalName_folderName_key" ON "EmailSyncState"("provider", "mailboxUserPrincipalName", "folderName");
CREATE INDEX IF NOT EXISTS "EmailSyncState_provider_idx" ON "EmailSyncState"("provider");
CREATE INDEX IF NOT EXISTS "EmailSyncState_mailboxUserPrincipalName_idx" ON "EmailSyncState"("mailboxUserPrincipalName");
CREATE INDEX IF NOT EXISTS "EmailSyncState_folderName_idx" ON "EmailSyncState"("folderName");
CREATE INDEX IF NOT EXISTS "EmailSyncState_status_idx" ON "EmailSyncState"("status");
CREATE INDEX IF NOT EXISTS "EmailSyncState_lastSyncedAt_idx" ON "EmailSyncState"("lastSyncedAt");

CREATE INDEX IF NOT EXISTS "EmailMatterLink_threadId_idx" ON "EmailMatterLink"("threadId");
CREATE INDEX IF NOT EXISTS "EmailMatterLink_messageId_idx" ON "EmailMatterLink"("messageId");
CREATE INDEX IF NOT EXISTS "EmailMatterLink_matterId_idx" ON "EmailMatterLink"("matterId");
CREATE INDEX IF NOT EXISTS "EmailMatterLink_matterDisplayNumber_idx" ON "EmailMatterLink"("matterDisplayNumber");
CREATE INDEX IF NOT EXISTS "EmailMatterLink_masterLawsuitId_idx" ON "EmailMatterLink"("masterLawsuitId");
CREATE INDEX IF NOT EXISTS "EmailMatterLink_clioMatterId_idx" ON "EmailMatterLink"("clioMatterId");
CREATE INDEX IF NOT EXISTS "EmailMatterLink_clioDisplayNumber_idx" ON "EmailMatterLink"("clioDisplayNumber");

CREATE INDEX IF NOT EXISTS "EmailFilingLog_threadId_idx" ON "EmailFilingLog"("threadId");
CREATE INDEX IF NOT EXISTS "EmailFilingLog_messageId_idx" ON "EmailFilingLog"("messageId");
CREATE INDEX IF NOT EXISTS "EmailFilingLog_targetSystem_idx" ON "EmailFilingLog"("targetSystem");
CREATE INDEX IF NOT EXISTS "EmailFilingLog_targetType_idx" ON "EmailFilingLog"("targetType");
CREATE INDEX IF NOT EXISTS "EmailFilingLog_targetId_idx" ON "EmailFilingLog"("targetId");
CREATE INDEX IF NOT EXISTS "EmailFilingLog_action_idx" ON "EmailFilingLog"("action");
CREATE INDEX IF NOT EXISTS "EmailFilingLog_status_idx" ON "EmailFilingLog"("status");
CREATE INDEX IF NOT EXISTS "EmailFilingLog_createdAt_idx" ON "EmailFilingLog"("createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'EmailMessage_threadId_fkey'
  ) THEN
    ALTER TABLE "EmailMessage"
      ADD CONSTRAINT "EmailMessage_threadId_fkey"
      FOREIGN KEY ("threadId") REFERENCES "EmailThread"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'EmailAttachment_messageId_fkey'
  ) THEN
    ALTER TABLE "EmailAttachment"
      ADD CONSTRAINT "EmailAttachment_messageId_fkey"
      FOREIGN KEY ("messageId") REFERENCES "EmailMessage"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
