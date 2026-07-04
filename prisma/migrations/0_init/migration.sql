-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "LawsuitSequenceCounter" (
    "id" SERIAL NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "lastSequence" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LawsuitSequenceCounter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatterSequenceCounter" (
    "id" SERIAL NOT NULL,
    "year" INTEGER NOT NULL,
    "lastSequence" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatterSequenceCounter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatterIdCounter" (
    "id" INTEGER NOT NULL,
    "lastId" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatterIdCounter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportMapping" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'other',
    "mapping" JSONB NOT NULL,
    "fixed" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportBatch" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceFile" TEXT,
    "actorName" TEXT,
    "actorEmail" TEXT,
    "status" TEXT NOT NULL DEFAULT 'committed',
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "createdCount" INTEGER NOT NULL DEFAULT 0,
    "rejectedCount" INTEGER NOT NULL DEFAULT 0,
    "reportCount" INTEGER NOT NULL DEFAULT 0,
    "ignoredCount" INTEGER NOT NULL DEFAULT 0,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportRow" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "rowIndex" INTEGER NOT NULL,
    "outcome" TEXT NOT NULL,
    "reason" TEXT,
    "matterId" INTEGER,
    "fingerprint" TEXT,
    "holdReason" TEXT,
    "reviewStatus" TEXT,
    "staged" JSONB,
    "resolution" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Patient" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'import',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Patient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lawsuit" (
    "id" SERIAL NOT NULL,
    "masterLawsuitId" TEXT NOT NULL,
    "claimNumber" TEXT,
    "lawsuitMatters" TEXT NOT NULL,
    "sharedFolderPath" TEXT NOT NULL,
    "venue" TEXT,
    "venueSelection" TEXT,
    "venueOther" TEXT,
    "indexAaaNumber" TEXT,
    "lawsuitNotes" TEXT,
    "lawsuitOptions" JSONB,
    "amountSoughtMode" TEXT NOT NULL DEFAULT 'balance_presuit',
    "amountSought" DOUBLE PRECISION,
    "customAmountSought" DOUBLE PRECISION,
    "amountSoughtBreakdown" JSONB,
    "clioMasterMatterId" INTEGER,
    "clioMasterDisplayNumber" TEXT,
    "clioMasterMatterDescription" TEXT,
    "clioMasterMappedAt" TIMESTAMP(3),
    "clioMasterMappingSource" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lawsuit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClioToken" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tokenType" TEXT NOT NULL DEFAULT 'bearer',
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "ClioToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClaimIndex" (
    "matter_id" INTEGER NOT NULL,
    "display_number" TEXT,
    "description" TEXT,
    "claim_number_raw" TEXT,
    "claim_number_normalized" TEXT,
    "patient_name" TEXT,
    "client_name" TEXT,
    "insurer_name" TEXT,
    "claim_amount" DOUBLE PRECISION,
    "settled_amount" DOUBLE PRECISION,
    "settled_with" TEXT,
    "allocated_settlement" DOUBLE PRECISION,
    "interest_amount" DOUBLE PRECISION,
    "principal_fee" DOUBLE PRECISION,
    "interest_fee" DOUBLE PRECISION,
    "total_fee" DOUBLE PRECISION,
    "provider_net" DOUBLE PRECISION,
    "provider_principal_net" DOUBLE PRECISION,
    "provider_interest_net" DOUBLE PRECISION,
    "overdue_days" DOUBLE PRECISION,
    "payment_amount" DOUBLE PRECISION,
    "balance_amount" DOUBLE PRECISION,
    "bill_number" TEXT,
    "dos_start" TEXT,
    "dos_end" TEXT,
    "denial_reason" TEXT,
    "service_type" TEXT,
    "policy_number" TEXT,
    "date_of_loss" TEXT,
    "payment_voluntary" DOUBLE PRECISION,
    "balance_presuit" DOUBLE PRECISION,
    "master_lawsuit_id" TEXT,
    "status" TEXT,
    "close_reason" TEXT,
    "final_status" TEXT,
    "raw_json" TEXT,
    "indexed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "matter_stage_name" TEXT,
    "index_aaa_number" TEXT,
    "patient_insurer" TEXT,
    "patient_provider" TEXT,
    "provider_name" TEXT,
    "treating_provider" TEXT,
    "cic_number" TEXT,
    "case_type" TEXT,
    "status_notes" TEXT,
    "status_date" TEXT,
    "date_bill_submitted" TEXT,
    "provider_tin" TEXT,
    "treating_physician_npi" TEXT,
    "treating_physician_license" TEXT,
    "place_of_service_address" TEXT,
    "place_of_service_address2" TEXT,
    "place_of_service_city" TEXT,
    "place_of_service_state" TEXT,
    "place_of_service_zip" TEXT,
    "carisk_operator" TEXT,
    "fingerprint" TEXT,
    "patient_id" TEXT,

    CONSTRAINT "ClaimIndex_pkey" PRIMARY KEY ("matter_id")
);

-- CreateTable
CREATE TABLE "ClaimClusterCache" (
    "claim_number_normalized" TEXT NOT NULL,
    "matter_ids" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClaimClusterCache_pkey" PRIMARY KEY ("claim_number_normalized")
);

-- CreateTable
CREATE TABLE "DocumentFinalization" (
    "id" SERIAL NOT NULL,
    "masterLawsuitId" TEXT NOT NULL,
    "masterMatterId" INTEGER NOT NULL,
    "masterDisplayNumber" TEXT,
    "status" TEXT NOT NULL,
    "requestedKeys" JSONB,
    "uploaded" JSONB,
    "skipped" JSONB,
    "clioUploadTarget" JSONB,
    "validationSnapshot" JSONB,
    "packetSummarySnapshot" JSONB,
    "allowDuplicateUploads" BOOLEAN NOT NULL DEFAULT false,
    "noUploadPerformed" BOOLEAN NOT NULL DEFAULT false,
    "error" TEXT,
    "finalizedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentFinalization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentPrintQueueItem" (
    "id" SERIAL NOT NULL,
    "uniqueQueueKey" TEXT NOT NULL,
    "masterLawsuitId" TEXT NOT NULL,
    "masterMatterId" INTEGER NOT NULL,
    "masterDisplayNumber" TEXT,
    "finalizationId" INTEGER,
    "documentKey" TEXT NOT NULL,
    "documentLabel" TEXT,
    "filename" TEXT NOT NULL,
    "clioDocumentId" TEXT,
    "clioDocumentName" TEXT,
    "clioDocumentVersionUuid" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "documentSnapshot" JSONB,
    "sourceFinalizationSnapshot" JSONB,
    "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "printedAt" TIMESTAMP(3),
    "printDecision" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentPrintQueueItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SettlementWriteback" (
    "id" SERIAL NOT NULL,
    "masterLawsuitId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "grossSettlement" DOUBLE PRECISION,
    "settledWith" TEXT,
    "settlementDate" TEXT,
    "allocationMode" TEXT,
    "childMatterIds" JSONB,
    "previewSnapshot" JSONB,
    "readinessSnapshot" JSONB,
    "writeResults" JSONB,
    "safetySnapshot" JSONB,
    "error" TEXT,
    "noWritePerformed" BOOLEAN NOT NULL DEFAULT false,
    "finalizedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SettlementWriteback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LocalSettlementRecord" (
    "id" TEXT NOT NULL,
    "masterLawsuitId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'recorded',
    "source" TEXT NOT NULL DEFAULT 'barsh-matters-local',
    "payloadKind" TEXT,
    "recordIntent" TEXT,
    "settledWith" TEXT,
    "settlementDate" TEXT,
    "paymentExpectedDate" TEXT,
    "notes" TEXT,
    "allocationMode" TEXT,
    "grossSettlementAmount" DOUBLE PRECISION,
    "interestAmountTotal" DOUBLE PRECISION,
    "principalFeePercent" DOUBLE PRECISION,
    "interestFeePercent" DOUBLE PRECISION,
    "allocatedSettlementTotal" DOUBLE PRECISION,
    "principalFeeTotal" DOUBLE PRECISION,
    "interestFeeTotal" DOUBLE PRECISION,
    "totalFee" DOUBLE PRECISION,
    "providerPrincipalNetTotal" DOUBLE PRECISION,
    "providerInterestNetTotal" DOUBLE PRECISION,
    "providerNetTotal" DOUBLE PRECISION,
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "previewSnapshot" JSONB,
    "roundingAdjustmentsSnapshot" JSONB,
    "safetySnapshot" JSONB,
    "recordedBy" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "voided" BOOLEAN NOT NULL DEFAULT false,
    "voidedAt" TIMESTAMP(3),
    "voidedBy" TEXT,
    "voidReason" TEXT,
    "voidSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LocalSettlementRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LocalSettlementRow" (
    "id" TEXT NOT NULL,
    "settlementRecordId" TEXT NOT NULL,
    "masterLawsuitId" TEXT NOT NULL,
    "matterId" INTEGER NOT NULL,
    "displayNumber" TEXT,
    "provider" TEXT,
    "patient" TEXT,
    "insurer" TEXT,
    "claimNumber" TEXT,
    "billNumber" TEXT,
    "dosStart" TEXT,
    "dosEnd" TEXT,
    "denialReason" TEXT,
    "claimAmount" DOUBLE PRECISION,
    "principalBasis" DOUBLE PRECISION,
    "allocatedSettlement" DOUBLE PRECISION,
    "interestAmount" DOUBLE PRECISION,
    "principalFee" DOUBLE PRECISION,
    "interestFee" DOUBLE PRECISION,
    "totalFee" DOUBLE PRECISION,
    "providerPrincipalNet" DOUBLE PRECISION,
    "providerInterestNet" DOUBLE PRECISION,
    "providerNet" DOUBLE PRECISION,
    "settlementStatus" TEXT,
    "rowSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LocalSettlementRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatterPaymentReceipt" (
    "id" SERIAL NOT NULL,
    "matterId" INTEGER NOT NULL,
    "displayNumber" TEXT,
    "paymentDate" TEXT NOT NULL,
    "paymentAmount" DOUBLE PRECISION NOT NULL,
    "transactionType" TEXT,
    "transactionStatus" TEXT,
    "transactionDate" TEXT,
    "checkNumber" TEXT,
    "checkDate" TEXT,
    "invoiceId" TEXT,
    "description" TEXT,
    "transactionFee" DOUBLE PRECISION,
    "postedBy" TEXT,
    "posted" BOOLEAN NOT NULL DEFAULT true,
    "voided" BOOLEAN NOT NULL DEFAULT false,
    "voidedAt" TIMESTAMP(3),
    "voidedBy" TEXT,
    "voidReason" TEXT,
    "reversalSnapshot" JSONB,
    "editedAt" TIMESTAMP(3),
    "editedBy" TEXT,
    "editReason" TEXT,
    "editSnapshot" JSONB,
    "claimAmountBefore" DOUBLE PRECISION,
    "paymentVoluntaryBefore" DOUBLE PRECISION,
    "balancePresuitBefore" DOUBLE PRECISION,
    "paymentVoluntaryAfter" DOUBLE PRECISION,
    "balancePresuitAfter" DOUBLE PRECISION,
    "clioReadback" JSONB,
    "safetySnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatterPaymentReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderClientInvoice" (
    "id" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "providerClientInfoId" TEXT,
    "referenceEntityId" TEXT NOT NULL,
    "providerDisplayName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "dateFrom" TEXT,
    "dateTo" TEXT,
    "statusFilter" TEXT,
    "transactionTypeFilter" TEXT,
    "receiptRowCount" INTEGER NOT NULL DEFAULT 0,
    "principalInterestTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "filingFeePaymentTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "costsExpendedTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "retainerFeeTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "invoicePackageTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "baseNetRemitToProvider" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "costBalanceThisRemittancePeriod" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "costBalanceDeductionCap" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "costBalanceAdjustmentToNetRemit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "costBalanceLedgerBefore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "costBalanceLedgerChange" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "costBalanceLedgerAfter" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "netRemitToProviderTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "clientSnapshot" JSONB,
    "filterSnapshot" JSONB,
    "totalsSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "finalizedAt" TIMESTAMP(3),
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,
    "auditSnapshot" JSONB,

    CONSTRAINT "ProviderClientInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderClientInvoiceLine" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "lineType" TEXT NOT NULL,
    "sourceId" TEXT,
    "sourceTable" TEXT,
    "sortDate" TEXT,
    "matter" TEXT,
    "patient" TEXT,
    "provider" TEXT,
    "insurer" TEXT,
    "lawsuit" TEXT,
    "description" TEXT,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "retainerFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rowSnapshot" JSONB,
    "dateOfLoss" TEXT,
    "dateOfService" TEXT,
    "dosEnd" TEXT,
    "caseType" TEXT,
    "checkDate" TEXT,
    "checkNumber" TEXT,
    "billedAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "retainer" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sourceType" TEXT,
    "sourceMatterId" TEXT,
    "sourceMatterDisplayNumber" TEXT,
    "sourcePaymentReceiptId" TEXT,
    "sourceSettlementId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderClientInvoiceLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClaimIndexRebuildState" (
    "name" TEXT NOT NULL,
    "currentBrlNumber" INTEGER,
    "lastProcessedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'idle',
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClaimIndexRebuildState_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "action" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "fieldName" TEXT,
    "priorValue" JSONB,
    "newValue" JSONB,
    "details" JSONB,
    "affectedMatterIds" JSONB,
    "matterId" INTEGER,
    "matterDisplayNumber" TEXT,
    "masterMatterId" INTEGER,
    "masterMatterDisplayNumber" TEXT,
    "masterLawsuitId" TEXT,
    "sourcePage" TEXT,
    "workflow" TEXT,
    "actorName" TEXT,
    "actorEmail" TEXT,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatterLocalField" (
    "id" TEXT NOT NULL,
    "matterId" INTEGER NOT NULL,
    "matterDisplayNumber" TEXT,
    "fieldName" TEXT NOT NULL,
    "fieldValue" TEXT,
    "fieldValueId" TEXT,
    "details" JSONB,
    "source" TEXT NOT NULL DEFAULT 'barsh-matters-local',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatterLocalField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferenceEntity" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "details" JSONB,
    "source" TEXT NOT NULL DEFAULT 'barsh-matters-local',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferenceEntity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderClientInfo" (
    "id" TEXT NOT NULL,
    "referenceEntityId" TEXT NOT NULL,
    "displayNameSnapshot" TEXT,
    "address" TEXT,
    "owner" TEXT,
    "providerGroup" TEXT,
    "tin" TEXT,
    "retainerNFPrincipal" TEXT,
    "retainerNFInterest" TEXT,
    "retainerWCPrincipal" TEXT,
    "retainerWCInterest" TEXT,
    "retainerLiensPrincipal" TEXT,
    "retainerLiensInterest" TEXT,
    "pullCosts" TEXT,
    "remit" TEXT,
    "notes" TEXT,
    "source" TEXT NOT NULL DEFAULT 'admin-client-info',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderClientInfo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferenceAlias" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "normalizedAlias" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferenceAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaildropAddress" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'local_registry',
    "matterId" INTEGER,
    "matterDisplayNumber" TEXT,
    "masterLawsuitId" TEXT,
    "clioMatterId" INTEGER,
    "clioDisplayNumber" TEXT,
    "clioMaildropEmail" TEXT NOT NULL,
    "clioMaildropLabel" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastResolvedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaildropAddress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailThread" (
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

-- CreateTable
CREATE TABLE "EmailMessage" (
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

-- CreateTable
CREATE TABLE "EmailAttachment" (
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

-- CreateTable
CREATE TABLE "EmailSyncState" (
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

-- CreateTable
CREATE TABLE "EmailMatterLink" (
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

-- CreateTable
CREATE TABLE "EmailFilingLog" (
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

-- CreateTable
CREATE TABLE "LocalWorkflowTickler" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'barsh-matters-local',
    "status" TEXT NOT NULL DEFAULT 'open',
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "masterLawsuitId" TEXT,
    "matterId" INTEGER,
    "displayNumber" TEXT,
    "settlementRecordId" TEXT,
    "dueDate" TEXT,
    "completedAt" TIMESTAMP(3),
    "completedBy" TEXT,
    "completedNote" TEXT,
    "metadata" JSONB,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LocalWorkflowTickler_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourtCalendarEvent" (
    "id" TEXT NOT NULL,
    "masterLawsuitId" TEXT NOT NULL,
    "displayNumber" TEXT,
    "eventType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "court" TEXT,
    "venue" TEXT,
    "indexAaaNumber" TEXT,
    "calendarNumber" TEXT,
    "eventDate" TEXT NOT NULL,
    "eventTime" TEXT,
    "part" TEXT,
    "judgeOrArbitrator" TEXT,
    "appearanceType" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "adjournedFromEventId" TEXT,
    "adjournedToEventId" TEXT,
    "reminderDate" TEXT,
    "reminderTicklerId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'barsh-matters-local',
    "sourceType" TEXT,
    "sourcePage" TEXT,
    "sourceAction" TEXT,
    "metadata" JSONB,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourtCalendarEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SettlementContact" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "company" TEXT,
    "role" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SettlementContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentTemplate" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "defaultFilenameSuffix" TEXT,
    "generationEndpoint" TEXT,
    "outputFormat" TEXT NOT NULL DEFAULT 'docx',
    "sourceOfTruth" TEXT NOT NULL DEFAULT 'barsh-matters-local',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "editableInRepository" BOOLEAN NOT NULL DEFAULT true,
    "currentVersionId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentTemplateVersion" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "bodyFormat" TEXT NOT NULL DEFAULT 'docx-template',
    "storageKind" TEXT NOT NULL DEFAULT 'metadata-only',
    "contentText" TEXT,
    "contentJson" JSONB,
    "mergeFieldSet" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentTemplateVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentTemplateMergeField" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "source" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "exampleValue" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentTemplateMergeField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProviderClientInvoiceAudit" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "providerClientInfoId" TEXT,
    "referenceEntityId" TEXT,
    "providerDisplayName" TEXT,
    "eventType" TEXT NOT NULL,
    "eventSummary" TEXT,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderClientInvoiceAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT,
    "normalizedUsername" TEXT,
    "passwordHash" TEXT,
    "passwordSetAt" TIMESTAMP(3),
    "passwordChangeRequired" BOOLEAN NOT NULL DEFAULT false,
    "lastLoginAt" TIMESTAMP(3),
    "lastFailedLoginAt" TIMESTAMP(3),
    "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
    "twoFactorRequired" BOOLEAN NOT NULL DEFAULT false,
    "twoFactorMethod" TEXT,
    "twoFactorConfiguredAt" TIMESTAMP(3),
    "displayName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "bootstrapSafe" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "emailNormalized" TEXT,
    "usernameNormalized" TEXT,
    "phoneExtension" TEXT,
    "faxNumber" TEXT,
    "signatureBlockName" TEXT,
    "signerEligible" BOOLEAN NOT NULL DEFAULT true,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "inactive" BOOLEAN NOT NULL DEFAULT false,
    "failedLoginLockedAt" TIMESTAMP(3),
    "forcePasswordChange" BOOLEAN NOT NULL DEFAULT false,
    "passwordHistoryJson" TEXT,
    "twoFactorPhone" TEXT,
    "twoFactorPhoneMasked" TEXT,
    "twoFactorDisabled" BOOLEAN NOT NULL DEFAULT false,
    "twoFactorPendingSetup" BOOLEAN NOT NULL DEFAULT false,
    "twoFactorChallengeHash" TEXT,
    "twoFactorChallengeExpiresAt" TIMESTAMP(3),
    "twoFactorChallengeAttempts" INTEGER NOT NULL DEFAULT 0,
    "twoFactorChallengeLockedAt" TIMESTAMP(3),
    "lastSignOutAt" TIMESTAMP(3),
    "sessionInvalidatedAt" TIMESTAMP(3),

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminRole" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "systemRole" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminRolePermission" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "permissionKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminRolePermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminUserRole" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminUserRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminUserPermissionOverride" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "permissionKey" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminUserPermissionOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LawsuitSequenceCounter_year_month_key" ON "LawsuitSequenceCounter"("year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "MatterSequenceCounter_year_key" ON "MatterSequenceCounter"("year");

-- CreateIndex
CREATE UNIQUE INDEX "ImportMapping_name_key" ON "ImportMapping"("name");

-- CreateIndex
CREATE INDEX "ImportMapping_source_idx" ON "ImportMapping"("source");

-- CreateIndex
CREATE INDEX "ImportBatch_source_idx" ON "ImportBatch"("source");

-- CreateIndex
CREATE INDEX "ImportBatch_status_idx" ON "ImportBatch"("status");

-- CreateIndex
CREATE INDEX "ImportBatch_createdAt_idx" ON "ImportBatch"("createdAt");

-- CreateIndex
CREATE INDEX "ImportRow_batchId_idx" ON "ImportRow"("batchId");

-- CreateIndex
CREATE INDEX "ImportRow_matterId_idx" ON "ImportRow"("matterId");

-- CreateIndex
CREATE INDEX "ImportRow_outcome_idx" ON "ImportRow"("outcome");

-- CreateIndex
CREATE INDEX "ImportRow_holdReason_idx" ON "ImportRow"("holdReason");

-- CreateIndex
CREATE INDEX "ImportRow_reviewStatus_idx" ON "ImportRow"("reviewStatus");

-- CreateIndex
CREATE INDEX "Patient_normalizedName_idx" ON "Patient"("normalizedName");

-- CreateIndex
CREATE INDEX "Patient_name_idx" ON "Patient"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Lawsuit_masterLawsuitId_key" ON "Lawsuit"("masterLawsuitId");

-- CreateIndex
CREATE INDEX "Lawsuit_clioMasterMatterId_idx" ON "Lawsuit"("clioMasterMatterId");

-- CreateIndex
CREATE INDEX "Lawsuit_clioMasterDisplayNumber_idx" ON "Lawsuit"("clioMasterDisplayNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ClaimIndex_cic_number_key" ON "ClaimIndex"("cic_number");

-- CreateIndex
CREATE INDEX "ClaimIndex_case_type_idx" ON "ClaimIndex"("case_type");

-- CreateIndex
CREATE INDEX "ClaimIndex_fingerprint_idx" ON "ClaimIndex"("fingerprint");

-- CreateIndex
CREATE INDEX "ClaimIndex_patient_id_idx" ON "ClaimIndex"("patient_id");

-- CreateIndex
CREATE INDEX "ClaimIndex_claim_number_normalized_idx" ON "ClaimIndex"("claim_number_normalized");

-- CreateIndex
CREATE INDEX "ClaimIndex_patient_name_idx" ON "ClaimIndex"("patient_name");

-- CreateIndex
CREATE INDEX "ClaimIndex_provider_name_idx" ON "ClaimIndex"("provider_name");

-- CreateIndex
CREATE INDEX "ClaimIndex_insurer_name_idx" ON "ClaimIndex"("insurer_name");

-- CreateIndex
CREATE INDEX "ClaimIndex_patient_provider_idx" ON "ClaimIndex"("patient_provider");

-- CreateIndex
CREATE INDEX "ClaimIndex_patient_insurer_idx" ON "ClaimIndex"("patient_insurer");

-- CreateIndex
CREATE INDEX "ClaimIndex_master_lawsuit_id_idx" ON "ClaimIndex"("master_lawsuit_id");

-- CreateIndex
CREATE INDEX "ClaimIndex_index_aaa_number_idx" ON "ClaimIndex"("index_aaa_number");

-- CreateIndex
CREATE INDEX "ClaimIndex_close_reason_idx" ON "ClaimIndex"("close_reason");

-- CreateIndex
CREATE INDEX "ClaimIndex_final_status_idx" ON "ClaimIndex"("final_status");

-- CreateIndex
CREATE INDEX "ClaimIndex_matter_stage_name_idx" ON "ClaimIndex"("matter_stage_name");

-- CreateIndex
CREATE INDEX "ClaimIndex_status_idx" ON "ClaimIndex"("status");

-- CreateIndex
CREATE INDEX "ClaimIndex_denial_reason_idx" ON "ClaimIndex"("denial_reason");

-- CreateIndex
CREATE INDEX "ClaimIndex_service_type_idx" ON "ClaimIndex"("service_type");

-- CreateIndex
CREATE INDEX "ClaimIndex_treating_provider_idx" ON "ClaimIndex"("treating_provider");

-- CreateIndex
CREATE INDEX "ClaimClusterCache_updated_at_idx" ON "ClaimClusterCache"("updated_at");

-- CreateIndex
CREATE INDEX "DocumentFinalization_masterLawsuitId_idx" ON "DocumentFinalization"("masterLawsuitId");

-- CreateIndex
CREATE INDEX "DocumentFinalization_masterMatterId_idx" ON "DocumentFinalization"("masterMatterId");

-- CreateIndex
CREATE INDEX "DocumentFinalization_status_idx" ON "DocumentFinalization"("status");

-- CreateIndex
CREATE INDEX "DocumentFinalization_finalizedAt_idx" ON "DocumentFinalization"("finalizedAt");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentPrintQueueItem_uniqueQueueKey_key" ON "DocumentPrintQueueItem"("uniqueQueueKey");

-- CreateIndex
CREATE INDEX "DocumentPrintQueueItem_masterLawsuitId_idx" ON "DocumentPrintQueueItem"("masterLawsuitId");

-- CreateIndex
CREATE INDEX "DocumentPrintQueueItem_masterMatterId_idx" ON "DocumentPrintQueueItem"("masterMatterId");

-- CreateIndex
CREATE INDEX "DocumentPrintQueueItem_status_idx" ON "DocumentPrintQueueItem"("status");

-- CreateIndex
CREATE INDEX "DocumentPrintQueueItem_queuedAt_idx" ON "DocumentPrintQueueItem"("queuedAt");

-- CreateIndex
CREATE INDEX "DocumentPrintQueueItem_clioDocumentId_idx" ON "DocumentPrintQueueItem"("clioDocumentId");

-- CreateIndex
CREATE INDEX "SettlementWriteback_masterLawsuitId_idx" ON "SettlementWriteback"("masterLawsuitId");

-- CreateIndex
CREATE INDEX "SettlementWriteback_status_idx" ON "SettlementWriteback"("status");

-- CreateIndex
CREATE INDEX "SettlementWriteback_finalizedAt_idx" ON "SettlementWriteback"("finalizedAt");

-- CreateIndex
CREATE INDEX "LocalSettlementRecord_masterLawsuitId_idx" ON "LocalSettlementRecord"("masterLawsuitId");

-- CreateIndex
CREATE INDEX "LocalSettlementRecord_status_idx" ON "LocalSettlementRecord"("status");

-- CreateIndex
CREATE INDEX "LocalSettlementRecord_settlementDate_idx" ON "LocalSettlementRecord"("settlementDate");

-- CreateIndex
CREATE INDEX "LocalSettlementRecord_recordedAt_idx" ON "LocalSettlementRecord"("recordedAt");

-- CreateIndex
CREATE INDEX "LocalSettlementRecord_voided_idx" ON "LocalSettlementRecord"("voided");

-- CreateIndex
CREATE INDEX "LocalSettlementRow_settlementRecordId_idx" ON "LocalSettlementRow"("settlementRecordId");

-- CreateIndex
CREATE INDEX "LocalSettlementRow_masterLawsuitId_idx" ON "LocalSettlementRow"("masterLawsuitId");

-- CreateIndex
CREATE INDEX "LocalSettlementRow_matterId_idx" ON "LocalSettlementRow"("matterId");

-- CreateIndex
CREATE INDEX "LocalSettlementRow_displayNumber_idx" ON "LocalSettlementRow"("displayNumber");

-- CreateIndex
CREATE INDEX "LocalSettlementRow_settlementStatus_idx" ON "LocalSettlementRow"("settlementStatus");

-- CreateIndex
CREATE INDEX "MatterPaymentReceipt_matterId_idx" ON "MatterPaymentReceipt"("matterId");

-- CreateIndex
CREATE INDEX "MatterPaymentReceipt_displayNumber_idx" ON "MatterPaymentReceipt"("displayNumber");

-- CreateIndex
CREATE INDEX "MatterPaymentReceipt_paymentDate_idx" ON "MatterPaymentReceipt"("paymentDate");

-- CreateIndex
CREATE INDEX "MatterPaymentReceipt_transactionType_idx" ON "MatterPaymentReceipt"("transactionType");

-- CreateIndex
CREATE INDEX "MatterPaymentReceipt_transactionStatus_idx" ON "MatterPaymentReceipt"("transactionStatus");

-- CreateIndex
CREATE INDEX "MatterPaymentReceipt_invoiceId_idx" ON "MatterPaymentReceipt"("invoiceId");

-- CreateIndex
CREATE INDEX "MatterPaymentReceipt_voided_idx" ON "MatterPaymentReceipt"("voided");

-- CreateIndex
CREATE INDEX "MatterPaymentReceipt_createdAt_idx" ON "MatterPaymentReceipt"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderClientInvoice_invoiceNumber_key" ON "ProviderClientInvoice"("invoiceNumber");

-- CreateIndex
CREATE INDEX "ProviderClientInvoice_referenceEntityId_idx" ON "ProviderClientInvoice"("referenceEntityId");

-- CreateIndex
CREATE INDEX "ProviderClientInvoice_providerClientInfoId_idx" ON "ProviderClientInvoice"("providerClientInfoId");

-- CreateIndex
CREATE INDEX "ProviderClientInvoice_status_idx" ON "ProviderClientInvoice"("status");

-- CreateIndex
CREATE INDEX "ProviderClientInvoice_createdAt_idx" ON "ProviderClientInvoice"("createdAt");

-- CreateIndex
CREATE INDEX "ProviderClientInvoiceLine_invoiceId_idx" ON "ProviderClientInvoiceLine"("invoiceId");

-- CreateIndex
CREATE INDEX "ProviderClientInvoiceLine_lineType_idx" ON "ProviderClientInvoiceLine"("lineType");

-- CreateIndex
CREATE INDEX "ProviderClientInvoiceLine_sourceId_idx" ON "ProviderClientInvoiceLine"("sourceId");

-- CreateIndex
CREATE INDEX "ProviderClientInvoiceLine_matter_idx" ON "ProviderClientInvoiceLine"("matter");

-- CreateIndex
CREATE INDEX "ProviderClientInvoiceLine_lawsuit_idx" ON "ProviderClientInvoiceLine"("lawsuit");

-- CreateIndex
CREATE INDEX "ClaimIndexRebuildState_status_idx" ON "ClaimIndexRebuildState"("status");

-- CreateIndex
CREATE INDEX "ClaimIndexRebuildState_updatedAt_idx" ON "ClaimIndexRebuildState"("updatedAt");

-- CreateIndex
CREATE INDEX "AuditLog_matterId_idx" ON "AuditLog"("matterId");

-- CreateIndex
CREATE INDEX "AuditLog_matterDisplayNumber_idx" ON "AuditLog"("matterDisplayNumber");

-- CreateIndex
CREATE INDEX "AuditLog_masterMatterId_idx" ON "AuditLog"("masterMatterId");

-- CreateIndex
CREATE INDEX "AuditLog_masterMatterDisplayNumber_idx" ON "AuditLog"("masterMatterDisplayNumber");

-- CreateIndex
CREATE INDEX "AuditLog_masterLawsuitId_idx" ON "AuditLog"("masterLawsuitId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "MatterLocalField_matterId_idx" ON "MatterLocalField"("matterId");

-- CreateIndex
CREATE INDEX "MatterLocalField_matterDisplayNumber_idx" ON "MatterLocalField"("matterDisplayNumber");

-- CreateIndex
CREATE INDEX "MatterLocalField_fieldName_idx" ON "MatterLocalField"("fieldName");

-- CreateIndex
CREATE INDEX "MatterLocalField_fieldValue_idx" ON "MatterLocalField"("fieldValue");

-- CreateIndex
CREATE INDEX "MatterLocalField_fieldValueId_idx" ON "MatterLocalField"("fieldValueId");

-- CreateIndex
CREATE INDEX "MatterLocalField_updatedAt_idx" ON "MatterLocalField"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "MatterLocalField_matterId_fieldName_key" ON "MatterLocalField"("matterId", "fieldName");

-- CreateIndex
CREATE INDEX "ReferenceEntity_type_idx" ON "ReferenceEntity"("type");

-- CreateIndex
CREATE INDEX "ReferenceEntity_active_idx" ON "ReferenceEntity"("active");

-- CreateIndex
CREATE INDEX "ReferenceEntity_displayName_idx" ON "ReferenceEntity"("displayName");

-- CreateIndex
CREATE INDEX "ReferenceEntity_normalizedName_idx" ON "ReferenceEntity"("normalizedName");

-- CreateIndex
CREATE INDEX "ReferenceEntity_createdAt_idx" ON "ReferenceEntity"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReferenceEntity_type_normalizedName_key" ON "ReferenceEntity"("type", "normalizedName");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderClientInfo_referenceEntityId_key" ON "ProviderClientInfo"("referenceEntityId");

-- CreateIndex
CREATE INDEX "ProviderClientInfo_referenceEntityId_idx" ON "ProviderClientInfo"("referenceEntityId");

-- CreateIndex
CREATE INDEX "ProviderClientInfo_displayNameSnapshot_idx" ON "ProviderClientInfo"("displayNameSnapshot");

-- CreateIndex
CREATE INDEX "ProviderClientInfo_owner_idx" ON "ProviderClientInfo"("owner");

-- CreateIndex
CREATE INDEX "ProviderClientInfo_providerGroup_idx" ON "ProviderClientInfo"("providerGroup");

-- CreateIndex
CREATE INDEX "ProviderClientInfo_pullCosts_idx" ON "ProviderClientInfo"("pullCosts");

-- CreateIndex
CREATE INDEX "ProviderClientInfo_remit_idx" ON "ProviderClientInfo"("remit");

-- CreateIndex
CREATE INDEX "ProviderClientInfo_updatedAt_idx" ON "ProviderClientInfo"("updatedAt");

-- CreateIndex
CREATE INDEX "ReferenceAlias_entityId_idx" ON "ReferenceAlias"("entityId");

-- CreateIndex
CREATE INDEX "ReferenceAlias_normalizedAlias_idx" ON "ReferenceAlias"("normalizedAlias");

-- CreateIndex
CREATE UNIQUE INDEX "ReferenceAlias_entityId_normalizedAlias_key" ON "ReferenceAlias"("entityId", "normalizedAlias");

-- CreateIndex
CREATE UNIQUE INDEX "MaildropAddress_clioMaildropEmail_key" ON "MaildropAddress"("clioMaildropEmail");

-- CreateIndex
CREATE INDEX "MaildropAddress_active_idx" ON "MaildropAddress"("active");

-- CreateIndex
CREATE INDEX "MaildropAddress_matterId_idx" ON "MaildropAddress"("matterId");

-- CreateIndex
CREATE INDEX "MaildropAddress_matterDisplayNumber_idx" ON "MaildropAddress"("matterDisplayNumber");

-- CreateIndex
CREATE INDEX "MaildropAddress_masterLawsuitId_idx" ON "MaildropAddress"("masterLawsuitId");

-- CreateIndex
CREATE INDEX "MaildropAddress_clioMatterId_idx" ON "MaildropAddress"("clioMatterId");

-- CreateIndex
CREATE INDEX "MaildropAddress_clioDisplayNumber_idx" ON "MaildropAddress"("clioDisplayNumber");

-- CreateIndex
CREATE INDEX "MaildropAddress_lastResolvedAt_idx" ON "MaildropAddress"("lastResolvedAt");

-- CreateIndex
CREATE INDEX "EmailThread_provider_idx" ON "EmailThread"("provider");

-- CreateIndex
CREATE INDEX "EmailThread_conversationId_idx" ON "EmailThread"("conversationId");

-- CreateIndex
CREATE INDEX "EmailThread_internetMessageId_idx" ON "EmailThread"("internetMessageId");

-- CreateIndex
CREATE INDEX "EmailThread_matterId_idx" ON "EmailThread"("matterId");

-- CreateIndex
CREATE INDEX "EmailThread_matterDisplayNumber_idx" ON "EmailThread"("matterDisplayNumber");

-- CreateIndex
CREATE INDEX "EmailThread_masterLawsuitId_idx" ON "EmailThread"("masterLawsuitId");

-- CreateIndex
CREATE INDEX "EmailThread_clioMatterId_idx" ON "EmailThread"("clioMatterId");

-- CreateIndex
CREATE INDEX "EmailThread_clioDisplayNumber_idx" ON "EmailThread"("clioDisplayNumber");

-- CreateIndex
CREATE INDEX "EmailThread_latestMessageAt_idx" ON "EmailThread"("latestMessageAt");

-- CreateIndex
CREATE UNIQUE INDEX "EmailThread_provider_conversationId_mailboxUserPrincipalNam_key" ON "EmailThread"("provider", "conversationId", "mailboxUserPrincipalName");

-- CreateIndex
CREATE INDEX "EmailMessage_threadId_idx" ON "EmailMessage"("threadId");

-- CreateIndex
CREATE INDEX "EmailMessage_provider_idx" ON "EmailMessage"("provider");

-- CreateIndex
CREATE INDEX "EmailMessage_graphMessageId_idx" ON "EmailMessage"("graphMessageId");

-- CreateIndex
CREATE INDEX "EmailMessage_internetMessageId_idx" ON "EmailMessage"("internetMessageId");

-- CreateIndex
CREATE INDEX "EmailMessage_conversationId_idx" ON "EmailMessage"("conversationId");

-- CreateIndex
CREATE INDEX "EmailMessage_sentAt_idx" ON "EmailMessage"("sentAt");

-- CreateIndex
CREATE INDEX "EmailMessage_receivedAt_idx" ON "EmailMessage"("receivedAt");

-- CreateIndex
CREATE INDEX "EmailMessage_folderName_idx" ON "EmailMessage"("folderName");

-- CreateIndex
CREATE INDEX "EmailMessage_direction_idx" ON "EmailMessage"("direction");

-- CreateIndex
CREATE UNIQUE INDEX "EmailMessage_provider_graphMessageId_mailboxUserPrincipalNa_key" ON "EmailMessage"("provider", "graphMessageId", "mailboxUserPrincipalName");

-- CreateIndex
CREATE INDEX "EmailAttachment_messageId_idx" ON "EmailAttachment"("messageId");

-- CreateIndex
CREATE INDEX "EmailAttachment_graphAttachmentId_idx" ON "EmailAttachment"("graphAttachmentId");

-- CreateIndex
CREATE INDEX "EmailAttachment_clioDocumentId_idx" ON "EmailAttachment"("clioDocumentId");

-- CreateIndex
CREATE INDEX "EmailAttachment_storageStatus_idx" ON "EmailAttachment"("storageStatus");

-- CreateIndex
CREATE INDEX "EmailSyncState_provider_idx" ON "EmailSyncState"("provider");

-- CreateIndex
CREATE INDEX "EmailSyncState_mailboxUserPrincipalName_idx" ON "EmailSyncState"("mailboxUserPrincipalName");

-- CreateIndex
CREATE INDEX "EmailSyncState_folderName_idx" ON "EmailSyncState"("folderName");

-- CreateIndex
CREATE INDEX "EmailSyncState_status_idx" ON "EmailSyncState"("status");

-- CreateIndex
CREATE INDEX "EmailSyncState_lastSyncedAt_idx" ON "EmailSyncState"("lastSyncedAt");

-- CreateIndex
CREATE UNIQUE INDEX "EmailSyncState_provider_mailboxUserPrincipalName_folderName_key" ON "EmailSyncState"("provider", "mailboxUserPrincipalName", "folderName");

-- CreateIndex
CREATE INDEX "EmailMatterLink_threadId_idx" ON "EmailMatterLink"("threadId");

-- CreateIndex
CREATE INDEX "EmailMatterLink_messageId_idx" ON "EmailMatterLink"("messageId");

-- CreateIndex
CREATE INDEX "EmailMatterLink_matterId_idx" ON "EmailMatterLink"("matterId");

-- CreateIndex
CREATE INDEX "EmailMatterLink_matterDisplayNumber_idx" ON "EmailMatterLink"("matterDisplayNumber");

-- CreateIndex
CREATE INDEX "EmailMatterLink_masterLawsuitId_idx" ON "EmailMatterLink"("masterLawsuitId");

-- CreateIndex
CREATE INDEX "EmailMatterLink_clioMatterId_idx" ON "EmailMatterLink"("clioMatterId");

-- CreateIndex
CREATE INDEX "EmailMatterLink_clioDisplayNumber_idx" ON "EmailMatterLink"("clioDisplayNumber");

-- CreateIndex
CREATE INDEX "EmailFilingLog_threadId_idx" ON "EmailFilingLog"("threadId");

-- CreateIndex
CREATE INDEX "EmailFilingLog_messageId_idx" ON "EmailFilingLog"("messageId");

-- CreateIndex
CREATE INDEX "EmailFilingLog_targetSystem_idx" ON "EmailFilingLog"("targetSystem");

-- CreateIndex
CREATE INDEX "EmailFilingLog_targetType_idx" ON "EmailFilingLog"("targetType");

-- CreateIndex
CREATE INDEX "EmailFilingLog_targetId_idx" ON "EmailFilingLog"("targetId");

-- CreateIndex
CREATE INDEX "EmailFilingLog_action_idx" ON "EmailFilingLog"("action");

-- CreateIndex
CREATE INDEX "EmailFilingLog_status_idx" ON "EmailFilingLog"("status");

-- CreateIndex
CREATE INDEX "EmailFilingLog_createdAt_idx" ON "EmailFilingLog"("createdAt");

-- CreateIndex
CREATE INDEX "LocalWorkflowTickler_kind_idx" ON "LocalWorkflowTickler"("kind");

-- CreateIndex
CREATE INDEX "LocalWorkflowTickler_status_idx" ON "LocalWorkflowTickler"("status");

-- CreateIndex
CREATE INDEX "LocalWorkflowTickler_priority_idx" ON "LocalWorkflowTickler"("priority");

-- CreateIndex
CREATE INDEX "LocalWorkflowTickler_masterLawsuitId_idx" ON "LocalWorkflowTickler"("masterLawsuitId");

-- CreateIndex
CREATE INDEX "LocalWorkflowTickler_matterId_idx" ON "LocalWorkflowTickler"("matterId");

-- CreateIndex
CREATE INDEX "LocalWorkflowTickler_displayNumber_idx" ON "LocalWorkflowTickler"("displayNumber");

-- CreateIndex
CREATE INDEX "LocalWorkflowTickler_settlementRecordId_idx" ON "LocalWorkflowTickler"("settlementRecordId");

-- CreateIndex
CREATE INDEX "LocalWorkflowTickler_dueDate_idx" ON "LocalWorkflowTickler"("dueDate");

-- CreateIndex
CREATE INDEX "LocalWorkflowTickler_createdAt_idx" ON "LocalWorkflowTickler"("createdAt");

-- CreateIndex
CREATE INDEX "CourtCalendarEvent_masterLawsuitId_idx" ON "CourtCalendarEvent"("masterLawsuitId");

-- CreateIndex
CREATE INDEX "CourtCalendarEvent_displayNumber_idx" ON "CourtCalendarEvent"("displayNumber");

-- CreateIndex
CREATE INDEX "CourtCalendarEvent_eventType_idx" ON "CourtCalendarEvent"("eventType");

-- CreateIndex
CREATE INDEX "CourtCalendarEvent_status_idx" ON "CourtCalendarEvent"("status");

-- CreateIndex
CREATE INDEX "CourtCalendarEvent_eventDate_idx" ON "CourtCalendarEvent"("eventDate");

-- CreateIndex
CREATE INDEX "CourtCalendarEvent_calendarNumber_idx" ON "CourtCalendarEvent"("calendarNumber");

-- CreateIndex
CREATE INDEX "CourtCalendarEvent_reminderDate_idx" ON "CourtCalendarEvent"("reminderDate");

-- CreateIndex
CREATE INDEX "CourtCalendarEvent_reminderTicklerId_idx" ON "CourtCalendarEvent"("reminderTicklerId");

-- CreateIndex
CREATE INDEX "CourtCalendarEvent_createdAt_idx" ON "CourtCalendarEvent"("createdAt");

-- CreateIndex
CREATE INDEX "SettlementContact_isActive_idx" ON "SettlementContact"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "SettlementContact_name_email_key" ON "SettlementContact"("name", "email");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentTemplate_key_key" ON "DocumentTemplate"("key");

-- CreateIndex
CREATE INDEX "DocumentTemplate_category_idx" ON "DocumentTemplate"("category");

-- CreateIndex
CREATE INDEX "DocumentTemplate_enabled_idx" ON "DocumentTemplate"("enabled");

-- CreateIndex
CREATE INDEX "DocumentTemplateVersion_templateId_idx" ON "DocumentTemplateVersion"("templateId");

-- CreateIndex
CREATE INDEX "DocumentTemplateVersion_status_idx" ON "DocumentTemplateVersion"("status");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentTemplateVersion_templateId_versionNumber_key" ON "DocumentTemplateVersion"("templateId", "versionNumber");

-- CreateIndex
CREATE INDEX "DocumentTemplateMergeField_templateId_idx" ON "DocumentTemplateMergeField"("templateId");

-- CreateIndex
CREATE INDEX "DocumentTemplateMergeField_source_idx" ON "DocumentTemplateMergeField"("source");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentTemplateMergeField_templateId_key_key" ON "DocumentTemplateMergeField"("templateId", "key");

-- CreateIndex
CREATE INDEX "ProviderClientInvoiceAudit_invoiceId_idx" ON "ProviderClientInvoiceAudit"("invoiceId");

-- CreateIndex
CREATE INDEX "ProviderClientInvoiceAudit_providerClientInfoId_idx" ON "ProviderClientInvoiceAudit"("providerClientInfoId");

-- CreateIndex
CREATE INDEX "ProviderClientInvoiceAudit_referenceEntityId_idx" ON "ProviderClientInvoiceAudit"("referenceEntityId");

-- CreateIndex
CREATE INDEX "ProviderClientInvoiceAudit_eventType_idx" ON "ProviderClientInvoiceAudit"("eventType");

-- CreateIndex
CREATE INDEX "ProviderClientInvoiceAudit_createdAt_idx" ON "ProviderClientInvoiceAudit"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_email_key" ON "AdminUser"("email");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_normalizedUsername_key" ON "AdminUser"("normalizedUsername");

-- CreateIndex
CREATE INDEX "AdminUser_status_idx" ON "AdminUser"("status");

-- CreateIndex
CREATE INDEX "AdminUser_username_idx" ON "AdminUser"("username");

-- CreateIndex
CREATE INDEX "AdminUser_passwordChangeRequired_idx" ON "AdminUser"("passwordChangeRequired");

-- CreateIndex
CREATE INDEX "AdminUser_lastLoginAt_idx" ON "AdminUser"("lastLoginAt");

-- CreateIndex
CREATE UNIQUE INDEX "AdminRole_key_key" ON "AdminRole"("key");

-- CreateIndex
CREATE INDEX "AdminRole_status_idx" ON "AdminRole"("status");

-- CreateIndex
CREATE INDEX "AdminRolePermission_permissionKey_idx" ON "AdminRolePermission"("permissionKey");

-- CreateIndex
CREATE UNIQUE INDEX "AdminRolePermission_roleId_permissionKey_key" ON "AdminRolePermission"("roleId", "permissionKey");

-- CreateIndex
CREATE INDEX "AdminUserRole_roleId_idx" ON "AdminUserRole"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUserRole_userId_roleId_key" ON "AdminUserRole"("userId", "roleId");

-- CreateIndex
CREATE INDEX "AdminUserPermissionOverride_permissionKey_idx" ON "AdminUserPermissionOverride"("permissionKey");

-- CreateIndex
CREATE INDEX "AdminUserPermissionOverride_action_idx" ON "AdminUserPermissionOverride"("action");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUserPermissionOverride_userId_permissionKey_key" ON "AdminUserPermissionOverride"("userId", "permissionKey");

-- AddForeignKey
ALTER TABLE "ImportRow" ADD CONSTRAINT "ImportRow_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimIndex" ADD CONSTRAINT "ClaimIndex_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LocalSettlementRow" ADD CONSTRAINT "LocalSettlementRow_settlementRecordId_fkey" FOREIGN KEY ("settlementRecordId") REFERENCES "LocalSettlementRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderClientInvoiceLine" ADD CONSTRAINT "ProviderClientInvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "ProviderClientInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderClientInfo" ADD CONSTRAINT "ProviderClientInfo_referenceEntityId_fkey" FOREIGN KEY ("referenceEntityId") REFERENCES "ReferenceEntity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferenceAlias" ADD CONSTRAINT "ReferenceAlias_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "ReferenceEntity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailMessage" ADD CONSTRAINT "EmailMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "EmailThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailAttachment" ADD CONSTRAINT "EmailAttachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "EmailMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentTemplateVersion" ADD CONSTRAINT "DocumentTemplateVersion_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "DocumentTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentTemplateMergeField" ADD CONSTRAINT "DocumentTemplateMergeField_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "DocumentTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminRolePermission" ADD CONSTRAINT "AdminRolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "AdminRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminUserRole" ADD CONSTRAINT "AdminUserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminUserRole" ADD CONSTRAINT "AdminUserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "AdminRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminUserPermissionOverride" ADD CONSTRAINT "AdminUserPermissionOverride_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

