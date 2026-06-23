# Phase 48D — Comprehensive Barsh Matters Merge-Field Catalog Inspection

## Status

Read-only inspection only. This phase does not map fields into templates.

## Scope Locked

The comprehensive Barsh Matters merge-field catalog must include:

- all visible UI fields in Barsh Matters
- all non-viewable fields in database tables already created
- hidden/internal fields needed for document generation, reporting, audit, and workflow logic
- layout-level merge fields for letterhead and pleading paper
- signer, addressee-source, and Re fields
- template-specific fields from uploaded DOCX placeholders

## Inspection Sources

- Prisma schema: `prisma/schema.prisma`
- Source files scanned for UI labels and field labels: 252
- Prisma models found: 38
- Prisma fields found: 666
- UI label candidates found: 819

## Workflow Buckets

- `lawsuit`
- `pre_suit`
- `direct_matter`
- `settlement`
- `letterhead`
- `pleading_paper`
- `invoice_remittance_reference`
- `signer_profile`
- `addressee`
- `hidden_internal`
- `template_repository`

## Layout Fields Already Identified

### Letterhead

- `{{todayLong}}`
- `{{signerName}}`
- `{{signerTitle}}`
- `{{signerPhoneExtension}}`
- `{{signerFax}}`
- `{{signerEmail}}`
- `{{firmAddressLine1}}`
- `{{firmAddressLine2}}`
- `{{addresseeSourceType}}`
- `{{addresseeRole}}`
- `{{addresseeName}}`
- `{{addresseeCompany}}`
- `{{addresseeAttentionLine}}`
- `{{addresseeAddressLine1}}`
- `{{addresseeAddressLine2}}`
- `{{addresseeAddressLine3}}`
- `{{addresseeEmail}}`
- `{{addresseeFax}}`
- `{{reLine1}}`
- `{{reLine2}}`
- `{{reMatterNumber}}`
- `{{rePatientName}}`
- `{{reProviderName}}`
- `{{reInsurerName}}`
- `{{reClaimNumber}}`
- `{{reIndexNumber}}`
- `{{reDateOfLoss}}`

### Pleading Paper

- `{{courtName}}`
- `{{courtVenue}}`
- `{{courtAddressLine1}}`
- `{{courtAddressCityStateZip}}`
- `{{plaintiffName}}`
- `{{defendantName}}`
- `{{indexNumber}}`
- `{{pleadingTitle}}`
- `{{matterNumber}}`
- `{{attorneyName}}`
- `{{todayLong}}`

## Model Summary

- `LawsuitSequenceCounter`: 6 fields; workflow tags: lawsuit, pleading_layout; visible/document-relevant: 1; hidden/internal: 3
- `Lawsuit`: 22 fields; workflow tags: lawsuit, pleading_layout; visible/document-relevant: 11; hidden/internal: 5
- `ClioToken`: 7 fields; workflow tags: general; visible/document-relevant: 1; hidden/internal: 6
- `ClaimIndex`: 43 fields; workflow tags: pre_suit, direct_matter; visible/document-relevant: 25; hidden/internal: 12
- `ClaimClusterCache`: 3 fields; workflow tags: pre_suit, direct_matter; visible/document-relevant: 2; hidden/internal: 1
- `DocumentFinalization`: 17 fields; workflow tags: general; visible/document-relevant: 2; hidden/internal: 9
- `DocumentPrintQueueItem`: 21 fields; workflow tags: general; visible/document-relevant: 4; hidden/internal: 13
- `SettlementWriteback`: 17 fields; workflow tags: settlement; visible/document-relevant: 2; hidden/internal: 9
- `LocalSettlementRecord`: 36 fields; workflow tags: settlement; visible/document-relevant: 8; hidden/internal: 16
- `LocalSettlementRow`: 28 fields; workflow tags: settlement; visible/document-relevant: 12; hidden/internal: 12
- `MatterPaymentReceipt`: 33 fields; workflow tags: pre_suit, direct_matter; visible/document-relevant: 10; hidden/internal: 13
- `ProviderClientInvoice`: 34 fields; workflow tags: payment, invoice_remittance_reference; visible/document-relevant: 14; hidden/internal: 16
- `ProviderClientInvoiceLine`: 30 fields; workflow tags: payment, invoice_remittance_reference; visible/document-relevant: 11; hidden/internal: 9
- `ClaimIndexRebuildState`: 7 fields; workflow tags: pre_suit, direct_matter; visible/document-relevant: 3; hidden/internal: 3
- `AuditLog`: 20 fields; workflow tags: hidden_internal, workflow; visible/document-relevant: 6; hidden/internal: 7
- `MatterLocalField`: 10 fields; workflow tags: pre_suit, direct_matter; visible/document-relevant: 3; hidden/internal: 5
- `ReferenceEntity`: 12 fields; workflow tags: reference_data, addressee; visible/document-relevant: 4; hidden/internal: 4
- `ProviderClientInfo`: 19 fields; workflow tags: payment, invoice_remittance_reference; visible/document-relevant: 4; hidden/internal: 6
- `ReferenceAlias`: 7 fields; workflow tags: reference_data, addressee; visible/document-relevant: 1; hidden/internal: 4
- `MaildropAddress`: 14 fields; workflow tags: general; visible/document-relevant: 4; hidden/internal: 7
- `EmailThread`: 24 fields; workflow tags: general; visible/document-relevant: 6; hidden/internal: 12
- `EmailMessage`: 34 fields; workflow tags: general; visible/document-relevant: 5; hidden/internal: 11
- `EmailAttachment`: 17 fields; workflow tags: general; visible/document-relevant: 4; hidden/internal: 11
- `EmailSyncState`: 16 fields; workflow tags: general; visible/document-relevant: 4; hidden/internal: 8
- `EmailMatterLink`: 13 fields; workflow tags: pre_suit, direct_matter; visible/document-relevant: 2; hidden/internal: 9
- `EmailFilingLog`: 17 fields; workflow tags: hidden_internal, workflow; visible/document-relevant: 2; hidden/internal: 9
- `LocalWorkflowTickler`: 19 fields; workflow tags: hidden_internal, workflow; visible/document-relevant: 4; hidden/internal: 8
- `CourtCalendarEvent`: 29 fields; workflow tags: lawsuit, pleading_layout; visible/document-relevant: 10; hidden/internal: 9
- `SettlementContact`: 11 fields; workflow tags: settlement; visible/document-relevant: 4; hidden/internal: 4
- `DocumentTemplate`: 17 fields; workflow tags: template_repository; visible/document-relevant: 2; hidden/internal: 6
- `DocumentTemplateVersion`: 12 fields; workflow tags: template_repository; visible/document-relevant: 2; hidden/internal: 6
- `DocumentTemplateMergeField`: 12 fields; workflow tags: template_repository; visible/document-relevant: 1; hidden/internal: 6
- `ProviderClientInvoiceAudit`: 9 fields; workflow tags: payment, invoice_remittance_reference; visible/document-relevant: 2; hidden/internal: 6
- `AdminUser`: 21 fields; workflow tags: signer_profile, admin; visible/document-relevant: 5; hidden/internal: 9
- `AdminRole`: 10 fields; workflow tags: signer_profile, admin; visible/document-relevant: 1; hidden/internal: 5
- `AdminRolePermission`: 5 fields; workflow tags: signer_profile, admin; visible/document-relevant: 0; hidden/internal: 4
- `AdminUserRole`: 6 fields; workflow tags: signer_profile, admin; visible/document-relevant: 0; hidden/internal: 4
- `AdminUserPermissionOverride`: 8 fields; workflow tags: signer_profile, admin; visible/document-relevant: 1; hidden/internal: 5

## High-Value Schema Field Candidates

- `LawsuitSequenceCounter.id` → `{{lawsuitSequenceCounterId}}` [lawsuit, pleading_layout; hidden_internal]
- `LawsuitSequenceCounter.year` → `{{lawsuitSequenceCounterYear}}` [lawsuit, pleading_layout; needs_review]
- `LawsuitSequenceCounter.month` → `{{lawsuitSequenceCounterMonth}}` [lawsuit, pleading_layout; needs_review]
- `LawsuitSequenceCounter.lastSequence` → `{{lawsuitSequenceCounterLastSequence}}` [lawsuit, pleading_layout; needs_review]
- `LawsuitSequenceCounter.createdAt` → `{{lawsuitSequenceCounterCreatedAt}}` [lawsuit, pleading_layout; hidden_internal]
- `LawsuitSequenceCounter.updatedAt` → `{{lawsuitSequenceCounterUpdatedAt}}` [lawsuit, pleading_layout; hidden_internal, visible_or_document_relevant]
- `Lawsuit.id` → `{{lawsuitId}}` [lawsuit, pleading_layout; hidden_internal]
- `Lawsuit.masterLawsuitId` → `{{lawsuitMasterLawsuitId}}` [lawsuit, pleading_layout; hidden_internal, re_line_candidate]
- `Lawsuit.claimNumber` → `{{lawsuitClaimNumber}}` [lawsuit, pleading_layout; visible_or_document_relevant, re_line_candidate]
- `Lawsuit.lawsuitMatters` → `{{lawsuitLawsuitMatters}}` [lawsuit, pleading_layout; re_line_candidate]
- `Lawsuit.sharedFolderPath` → `{{lawsuitSharedFolderPath}}` [lawsuit, pleading_layout; needs_review]
- `Lawsuit.venue` → `{{lawsuitVenue}}` [lawsuit, pleading_layout; visible_or_document_relevant]
- `Lawsuit.venueSelection` → `{{lawsuitVenueSelection}}` [lawsuit, pleading_layout; visible_or_document_relevant]
- `Lawsuit.venueOther` → `{{lawsuitVenueOther}}` [lawsuit, pleading_layout; visible_or_document_relevant]
- `Lawsuit.indexAaaNumber` → `{{lawsuitIndexAaaNumber}}` [lawsuit, pleading_layout; visible_or_document_relevant, re_line_candidate]
- `Lawsuit.lawsuitNotes` → `{{lawsuitLawsuitNotes}}` [lawsuit, pleading_layout; re_line_candidate]
- `Lawsuit.lawsuitOptions` → `{{lawsuitLawsuitOptions}}` [lawsuit, pleading_layout; re_line_candidate]
- `Lawsuit.amountSoughtMode` → `{{lawsuitAmountSoughtMode}}` [lawsuit, pleading_layout; visible_or_document_relevant]
- `Lawsuit.amountSought` → `{{lawsuitAmountSought}}` [lawsuit, pleading_layout; visible_or_document_relevant]
- `Lawsuit.customAmountSought` → `{{lawsuitCustomAmountSought}}` [lawsuit, pleading_layout; visible_or_document_relevant]
- `Lawsuit.amountSoughtBreakdown` → `{{lawsuitAmountSoughtBreakdown}}` [lawsuit, pleading_layout; visible_or_document_relevant]
- `Lawsuit.clioMasterMatterId` → `{{lawsuitClioMasterMatterId}}` [lawsuit, pleading_layout; hidden_internal, re_line_candidate]
- `Lawsuit.clioMasterDisplayNumber` → `{{lawsuitClioMasterDisplayNumber}}` [lawsuit, pleading_layout; visible_or_document_relevant]
- `Lawsuit.clioMasterMatterDescription` → `{{lawsuitClioMasterMatterDescription}}` [lawsuit, pleading_layout; re_line_candidate]
- `Lawsuit.clioMasterMappedAt` → `{{lawsuitClioMasterMappedAt}}` [lawsuit, pleading_layout; needs_review]
- `Lawsuit.clioMasterMappingSource` → `{{lawsuitClioMasterMappingSource}}` [lawsuit, pleading_layout; needs_review]
- `Lawsuit.createdAt` → `{{lawsuitCreatedAt}}` [lawsuit, pleading_layout; hidden_internal]
- `Lawsuit.updatedAt` → `{{lawsuitUpdatedAt}}` [lawsuit, pleading_layout; hidden_internal, visible_or_document_relevant]
- `ClaimIndex.matter_id` → `{{claimIndexMatterId}}` [pre_suit, direct_matter; hidden_internal, re_line_candidate]
- `ClaimIndex.display_number` → `{{claimIndexDisplayNumber}}` [pre_suit, direct_matter; visible_or_document_relevant]
- `ClaimIndex.description` → `{{claimIndexDescription}}` [pre_suit, direct_matter; needs_review]
- `ClaimIndex.claim_number_raw` → `{{claimIndexClaimNumberRaw}}` [pre_suit, direct_matter; hidden_internal, visible_or_document_relevant, re_line_candidate]
- `ClaimIndex.claim_number_normalized` → `{{claimIndexClaimNumberNormalized}}` [pre_suit, direct_matter; visible_or_document_relevant, re_line_candidate]
- `ClaimIndex.patient_name` → `{{claimIndexPatientName}}` [pre_suit, direct_matter; visible_or_document_relevant, re_line_candidate]
- `ClaimIndex.client_name` → `{{claimIndexClientName}}` [pre_suit, direct_matter; visible_or_document_relevant]
- `ClaimIndex.insurer_name` → `{{claimIndexInsurerName}}` [pre_suit, direct_matter; visible_or_document_relevant, addressee_candidate, re_line_candidate]
- `ClaimIndex.claim_amount` → `{{claimIndexClaimAmount}}` [pre_suit, direct_matter; visible_or_document_relevant, re_line_candidate]
- `ClaimIndex.settled_amount` → `{{claimIndexSettledAmount}}` [pre_suit, direct_matter; visible_or_document_relevant, addressee_candidate]
- `ClaimIndex.settled_with` → `{{claimIndexSettledWith}}` [pre_suit, direct_matter; addressee_candidate]
- `ClaimIndex.allocated_settlement` → `{{claimIndexAllocatedSettlement}}` [pre_suit, direct_matter; needs_review]
- `ClaimIndex.interest_amount` → `{{claimIndexInterestAmount}}` [pre_suit, direct_matter; visible_or_document_relevant]
- `ClaimIndex.principal_fee` → `{{claimIndexPrincipalFee}}` [pre_suit, direct_matter; needs_review]
- `ClaimIndex.interest_fee` → `{{claimIndexInterestFee}}` [pre_suit, direct_matter; needs_review]
- `ClaimIndex.total_fee` → `{{claimIndexTotalFee}}` [pre_suit, direct_matter; needs_review]
- `ClaimIndex.provider_net` → `{{claimIndexProviderNet}}` [pre_suit, direct_matter; hidden_internal, visible_or_document_relevant, re_line_candidate]
- `ClaimIndex.provider_principal_net` → `{{claimIndexProviderPrincipalNet}}` [pre_suit, direct_matter; hidden_internal, visible_or_document_relevant, re_line_candidate]
- `ClaimIndex.provider_interest_net` → `{{claimIndexProviderInterestNet}}` [pre_suit, direct_matter; hidden_internal, visible_or_document_relevant, re_line_candidate]
- `ClaimIndex.overdue_days` → `{{claimIndexOverdueDays}}` [pre_suit, direct_matter; needs_review]
- `ClaimIndex.payment_amount` → `{{claimIndexPaymentAmount}}` [pre_suit, direct_matter; visible_or_document_relevant]
- `ClaimIndex.balance_amount` → `{{claimIndexBalanceAmount}}` [pre_suit, direct_matter; visible_or_document_relevant]
- `ClaimIndex.bill_number` → `{{claimIndexBillNumber}}` [pre_suit, direct_matter; visible_or_document_relevant]
- `ClaimIndex.dos_start` → `{{claimIndexDosStart}}` [pre_suit, direct_matter; re_line_candidate]
- `ClaimIndex.dos_end` → `{{claimIndexDosEnd}}` [pre_suit, direct_matter; re_line_candidate]
- `ClaimIndex.denial_reason` → `{{claimIndexDenialReason}}` [pre_suit, direct_matter; needs_review]
- `ClaimIndex.service_type` → `{{claimIndexServiceType}}` [pre_suit, direct_matter; needs_review]
- `ClaimIndex.policy_number` → `{{claimIndexPolicyNumber}}` [pre_suit, direct_matter; visible_or_document_relevant]
- `ClaimIndex.date_of_loss` → `{{claimIndexDateOfLoss}}` [pre_suit, direct_matter; visible_or_document_relevant]
- `ClaimIndex.payment_voluntary` → `{{claimIndexPaymentVoluntary}}` [pre_suit, direct_matter; needs_review]
- `ClaimIndex.balance_presuit` → `{{claimIndexBalancePresuit}}` [pre_suit, direct_matter; visible_or_document_relevant]
- `ClaimIndex.master_lawsuit_id` → `{{claimIndexMasterLawsuitId}}` [pre_suit, direct_matter; hidden_internal, re_line_candidate]
- `ClaimIndex.status` → `{{claimIndexStatus}}` [pre_suit, direct_matter; hidden_internal]
- `ClaimIndex.close_reason` → `{{claimIndexCloseReason}}` [pre_suit, direct_matter; needs_review]
- `ClaimIndex.final_status` → `{{claimIndexFinalStatus}}` [pre_suit, direct_matter; hidden_internal]
- `ClaimIndex.raw_json` → `{{claimIndexRawJson}}` [pre_suit, direct_matter; hidden_internal]
- `ClaimIndex.indexed_at` → `{{claimIndexIndexedAt}}` [pre_suit, direct_matter; visible_or_document_relevant, re_line_candidate]
- `ClaimIndex.matter_stage_name` → `{{claimIndexMatterStageName}}` [pre_suit, direct_matter; visible_or_document_relevant, re_line_candidate]
- `ClaimIndex.index_aaa_number` → `{{claimIndexIndexAaaNumber}}` [pre_suit, direct_matter; visible_or_document_relevant, re_line_candidate]
- `ClaimIndex.patient_insurer` → `{{claimIndexPatientInsurer}}` [pre_suit, direct_matter; visible_or_document_relevant, addressee_candidate, re_line_candidate]
- `ClaimIndex.patient_provider` → `{{claimIndexPatientProvider}}` [pre_suit, direct_matter; hidden_internal, visible_or_document_relevant, re_line_candidate]
- `ClaimIndex.provider_name` → `{{claimIndexProviderName}}` [pre_suit, direct_matter; hidden_internal, visible_or_document_relevant, re_line_candidate]
- `ClaimIndex.treating_provider` → `{{claimIndexTreatingProvider}}` [pre_suit, direct_matter; hidden_internal, visible_or_document_relevant, re_line_candidate]
- `ClaimClusterCache.claim_number_normalized` → `{{claimClusterCacheClaimNumberNormalized}}` [pre_suit, direct_matter; visible_or_document_relevant, re_line_candidate]
- `ClaimClusterCache.matter_ids` → `{{claimClusterCacheMatterIds}}` [pre_suit, direct_matter; hidden_internal, re_line_candidate]
- `ClaimClusterCache.updated_at` → `{{claimClusterCacheUpdatedAt}}` [pre_suit, direct_matter; visible_or_document_relevant]
- `SettlementWriteback.id` → `{{settlementWritebackId}}` [settlement; hidden_internal]
- `SettlementWriteback.masterLawsuitId` → `{{settlementWritebackMasterLawsuitId}}` [settlement; hidden_internal, re_line_candidate]
- `SettlementWriteback.status` → `{{settlementWritebackStatus}}` [settlement; hidden_internal]
- `SettlementWriteback.grossSettlement` → `{{settlementWritebackGrossSettlement}}` [settlement; needs_review]
- `SettlementWriteback.settledWith` → `{{settlementWritebackSettledWith}}` [settlement; addressee_candidate]
- `SettlementWriteback.settlementDate` → `{{settlementWritebackSettlementDate}}` [settlement; visible_or_document_relevant]
- `SettlementWriteback.allocationMode` → `{{settlementWritebackAllocationMode}}` [settlement; needs_review]
- `SettlementWriteback.childMatterIds` → `{{settlementWritebackChildMatterIds}}` [settlement; hidden_internal, re_line_candidate]
- `SettlementWriteback.previewSnapshot` → `{{settlementWritebackPreviewSnapshot}}` [settlement; hidden_internal]
- `SettlementWriteback.readinessSnapshot` → `{{settlementWritebackReadinessSnapshot}}` [settlement; hidden_internal]
- `SettlementWriteback.writeResults` → `{{settlementWritebackWriteResults}}` [settlement; needs_review]
- `SettlementWriteback.safetySnapshot` → `{{settlementWritebackSafetySnapshot}}` [settlement; hidden_internal]
- `SettlementWriteback.error` → `{{settlementWritebackError}}` [settlement; needs_review]
- `SettlementWriteback.noWritePerformed` → `{{settlementWritebackNoWritePerformed}}` [settlement; needs_review]
- `SettlementWriteback.finalizedAt` → `{{settlementWritebackFinalizedAt}}` [settlement; needs_review]
- `SettlementWriteback.createdAt` → `{{settlementWritebackCreatedAt}}` [settlement; hidden_internal]
- `SettlementWriteback.updatedAt` → `{{settlementWritebackUpdatedAt}}` [settlement; hidden_internal, visible_or_document_relevant]
- `LocalSettlementRecord.id` → `{{localSettlementRecordId}}` [settlement; hidden_internal]
- `LocalSettlementRecord.masterLawsuitId` → `{{localSettlementRecordMasterLawsuitId}}` [settlement; hidden_internal, re_line_candidate]
- `LocalSettlementRecord.status` → `{{localSettlementRecordStatus}}` [settlement; hidden_internal]
- `LocalSettlementRecord.source` → `{{localSettlementRecordSource}}` [settlement; needs_review]
- `LocalSettlementRecord.payloadKind` → `{{localSettlementRecordPayloadKind}}` [settlement; needs_review]
- `LocalSettlementRecord.recordIntent` → `{{localSettlementRecordRecordIntent}}` [settlement; needs_review]
- `LocalSettlementRecord.settledWith` → `{{localSettlementRecordSettledWith}}` [settlement; addressee_candidate]
- `LocalSettlementRecord.settlementDate` → `{{localSettlementRecordSettlementDate}}` [settlement; visible_or_document_relevant]
- `LocalSettlementRecord.paymentExpectedDate` → `{{localSettlementRecordPaymentExpectedDate}}` [settlement; visible_or_document_relevant]
- `LocalSettlementRecord.notes` → `{{localSettlementRecordNotes}}` [settlement; needs_review]
- `LocalSettlementRecord.allocationMode` → `{{localSettlementRecordAllocationMode}}` [settlement; needs_review]
- `LocalSettlementRecord.grossSettlementAmount` → `{{localSettlementRecordGrossSettlementAmount}}` [settlement; visible_or_document_relevant]
- `LocalSettlementRecord.interestAmountTotal` → `{{localSettlementRecordInterestAmountTotal}}` [settlement; visible_or_document_relevant]
- `LocalSettlementRecord.principalFeePercent` → `{{localSettlementRecordPrincipalFeePercent}}` [settlement; needs_review]
- `LocalSettlementRecord.interestFeePercent` → `{{localSettlementRecordInterestFeePercent}}` [settlement; needs_review]
- `LocalSettlementRecord.allocatedSettlementTotal` → `{{localSettlementRecordAllocatedSettlementTotal}}` [settlement; needs_review]
- `LocalSettlementRecord.principalFeeTotal` → `{{localSettlementRecordPrincipalFeeTotal}}` [settlement; needs_review]
- `LocalSettlementRecord.interestFeeTotal` → `{{localSettlementRecordInterestFeeTotal}}` [settlement; needs_review]
- `LocalSettlementRecord.totalFee` → `{{localSettlementRecordTotalFee}}` [settlement; needs_review]
- `LocalSettlementRecord.providerPrincipalNetTotal` → `{{localSettlementRecordProviderPrincipalNetTotal}}` [settlement; hidden_internal, visible_or_document_relevant, re_line_candidate]
- `LocalSettlementRecord.providerInterestNetTotal` → `{{localSettlementRecordProviderInterestNetTotal}}` [settlement; hidden_internal, visible_or_document_relevant, re_line_candidate]
- `LocalSettlementRecord.providerNetTotal` → `{{localSettlementRecordProviderNetTotal}}` [settlement; hidden_internal, visible_or_document_relevant, re_line_candidate]
- `LocalSettlementRecord.rowCount` → `{{localSettlementRecordRowCount}}` [settlement; needs_review]
- `LocalSettlementRecord.previewSnapshot` → `{{localSettlementRecordPreviewSnapshot}}` [settlement; hidden_internal]
- `LocalSettlementRecord.roundingAdjustmentsSnapshot` → `{{localSettlementRecordRoundingAdjustmentsSnapshot}}` [settlement; hidden_internal]
- `LocalSettlementRecord.safetySnapshot` → `{{localSettlementRecordSafetySnapshot}}` [settlement; hidden_internal]
- `LocalSettlementRecord.recordedBy` → `{{localSettlementRecordRecordedBy}}` [settlement; needs_review]
- `LocalSettlementRecord.recordedAt` → `{{localSettlementRecordRecordedAt}}` [settlement; needs_review]
- `LocalSettlementRecord.voided` → `{{localSettlementRecordVoided}}` [settlement; hidden_internal]
- `LocalSettlementRecord.voidedAt` → `{{localSettlementRecordVoidedAt}}` [settlement; hidden_internal]
- `LocalSettlementRecord.voidedBy` → `{{localSettlementRecordVoidedBy}}` [settlement; hidden_internal]
- `LocalSettlementRecord.voidReason` → `{{localSettlementRecordVoidReason}}` [settlement; hidden_internal]
- `LocalSettlementRecord.voidSnapshot` → `{{localSettlementRecordVoidSnapshot}}` [settlement; hidden_internal]
- `LocalSettlementRecord.createdAt` → `{{localSettlementRecordCreatedAt}}` [settlement; hidden_internal]
- `LocalSettlementRecord.updatedAt` → `{{localSettlementRecordUpdatedAt}}` [settlement; hidden_internal, visible_or_document_relevant]
- `LocalSettlementRow.id` → `{{localSettlementRowId}}` [settlement; hidden_internal]
- `LocalSettlementRow.settlementRecordId` → `{{localSettlementRowSettlementRecordId}}` [settlement; hidden_internal]
- `LocalSettlementRow.masterLawsuitId` → `{{localSettlementRowMasterLawsuitId}}` [settlement; hidden_internal, re_line_candidate]
- `LocalSettlementRow.matterId` → `{{localSettlementRowMatterId}}` [settlement; hidden_internal, re_line_candidate]
- `LocalSettlementRow.displayNumber` → `{{localSettlementRowDisplayNumber}}` [settlement; visible_or_document_relevant]
- `LocalSettlementRow.provider` → `{{localSettlementRowProvider}}` [settlement; hidden_internal, visible_or_document_relevant, re_line_candidate]
- `LocalSettlementRow.patient` → `{{localSettlementRowPatient}}` [settlement; visible_or_document_relevant, re_line_candidate]
- `LocalSettlementRow.insurer` → `{{localSettlementRowInsurer}}` [settlement; visible_or_document_relevant, addressee_candidate, re_line_candidate]
- `LocalSettlementRow.claimNumber` → `{{localSettlementRowClaimNumber}}` [settlement; visible_or_document_relevant, re_line_candidate]
- `LocalSettlementRow.billNumber` → `{{localSettlementRowBillNumber}}` [settlement; visible_or_document_relevant]
- `LocalSettlementRow.dosStart` → `{{localSettlementRowDosStart}}` [settlement; re_line_candidate]
- `LocalSettlementRow.dosEnd` → `{{localSettlementRowDosEnd}}` [settlement; re_line_candidate]
- `LocalSettlementRow.denialReason` → `{{localSettlementRowDenialReason}}` [settlement; needs_review]
- `LocalSettlementRow.claimAmount` → `{{localSettlementRowClaimAmount}}` [settlement; visible_or_document_relevant, re_line_candidate]
- `LocalSettlementRow.principalBasis` → `{{localSettlementRowPrincipalBasis}}` [settlement; needs_review]
- `LocalSettlementRow.allocatedSettlement` → `{{localSettlementRowAllocatedSettlement}}` [settlement; needs_review]
- `LocalSettlementRow.interestAmount` → `{{localSettlementRowInterestAmount}}` [settlement; visible_or_document_relevant]
- `LocalSettlementRow.principalFee` → `{{localSettlementRowPrincipalFee}}` [settlement; needs_review]
- `LocalSettlementRow.interestFee` → `{{localSettlementRowInterestFee}}` [settlement; needs_review]
- `LocalSettlementRow.totalFee` → `{{localSettlementRowTotalFee}}` [settlement; needs_review]
- `LocalSettlementRow.providerPrincipalNet` → `{{localSettlementRowProviderPrincipalNet}}` [settlement; hidden_internal, visible_or_document_relevant, re_line_candidate]
- `LocalSettlementRow.providerInterestNet` → `{{localSettlementRowProviderInterestNet}}` [settlement; hidden_internal, visible_or_document_relevant, re_line_candidate]
- `LocalSettlementRow.providerNet` → `{{localSettlementRowProviderNet}}` [settlement; hidden_internal, visible_or_document_relevant, re_line_candidate]
- `LocalSettlementRow.settlementStatus` → `{{localSettlementRowSettlementStatus}}` [settlement; hidden_internal]
- `LocalSettlementRow.rowSnapshot` → `{{localSettlementRowRowSnapshot}}` [settlement; hidden_internal]
- `LocalSettlementRow.createdAt` → `{{localSettlementRowCreatedAt}}` [settlement; hidden_internal]
- `LocalSettlementRow.updatedAt` → `{{localSettlementRowUpdatedAt}}` [settlement; hidden_internal, visible_or_document_relevant]
- `MatterPaymentReceipt.id` → `{{matterPaymentReceiptId}}` [pre_suit, direct_matter; hidden_internal]
- `MatterPaymentReceipt.matterId` → `{{matterPaymentReceiptMatterId}}` [pre_suit, direct_matter; hidden_internal, re_line_candidate]
- `MatterPaymentReceipt.displayNumber` → `{{matterPaymentReceiptDisplayNumber}}` [pre_suit, direct_matter; visible_or_document_relevant]
- `MatterPaymentReceipt.paymentDate` → `{{matterPaymentReceiptPaymentDate}}` [pre_suit, direct_matter; visible_or_document_relevant]
- `MatterPaymentReceipt.paymentAmount` → `{{matterPaymentReceiptPaymentAmount}}` [pre_suit, direct_matter; visible_or_document_relevant]
- `MatterPaymentReceipt.transactionType` → `{{matterPaymentReceiptTransactionType}}` [pre_suit, direct_matter; needs_review]
- `MatterPaymentReceipt.transactionStatus` → `{{matterPaymentReceiptTransactionStatus}}` [pre_suit, direct_matter; hidden_internal]

## UI Label Candidates

- `Date` → `{{date}}` from `app/admin/audit-history/page.tsx`
- `Action` → `{{action}}` from `app/admin/audit-history/page.tsx`
- `Matter` → `{{matter}}` from `app/admin/audit-history/page.tsx`
- `User` → `{{user}}` from `app/admin/audit-history/page.tsx`
- `Details` → `{{details}}` from `app/admin/audit-history/page.tsx`
- `ARCHIVE ERROR LOG` → `{{archiveErrorLog}}` from `app/admin/backup-restore/page.tsx`
- `Backup to preview` → `{{backupToPreview}}` from `app/admin/backup-restore/page.tsx`
- `Baseline backup` → `{{baselineBackup}}` from `app/admin/backup-restore/page.tsx`
- `Comparison backup` → `{{comparisonBackup}}` from `app/admin/backup-restore/page.tsx`
- `Restore-plan field` → `{{restorePlanField}}` from `app/admin/backup-restore/page.tsx`
- `Value` → `{{value}}` from `app/admin/backup-restore/page.tsx`
- `Field` → `{{field}}` from `app/admin/backup-restore/page.tsx`
- `Baseline` → `{{baseline}}` from `app/admin/backup-restore/page.tsx`
- `Comparison` → `{{comparison}}` from `app/admin/backup-restore/page.tsx`
- `Differs` → `{{differs}}` from `app/admin/backup-restore/page.tsx`
- `Backup` → `{{backup}}` from `app/admin/backup-restore/page.tsx`
- `Created` → `{{created}}` from `app/admin/backup-restore/page.tsx`
- `Git` → `{{git}}` from `app/admin/backup-restore/page.tsx`
- `Tables` → `{{tables}}` from `app/admin/backup-restore/page.tsx`
- `Indexes` → `{{indexes}}` from `app/admin/backup-restore/page.tsx`
- `Archive entries` → `{{archiveEntries}}` from `app/admin/backup-restore/page.tsx`
- `Manifest` → `{{manifest}}` from `app/admin/backup-restore/page.tsx`
- `Dump` → `{{dump}}` from `app/admin/backup-restore/page.tsx`
- `Schema` → `{{schema}}` from `app/admin/backup-restore/page.tsx`
- `Archive list` → `{{archiveList}}` from `app/admin/backup-restore/page.tsx`
- `Health flags` → `{{healthFlags}}` from `app/admin/backup-restore/page.tsx`
- `Path` → `{{path}}` from `app/admin/backup-restore/page.tsx`
- `Files` → `{{files}}` from `app/admin/backup-restore/page.tsx`
- `Details` → `{{details}}` from `app/admin/backup-restore/page.tsx`
- `Read-only backup manifest detail` → `{{readOnlyBackupManifestDetail}}` from `app/admin/backup-restore/page.tsx`
- `Value` → `{{value}}` from `app/admin/claim-index/audit/page.tsx`
- `Count` → `{{count}}` from `app/admin/claim-index/audit/page.tsx`
- `Matter ID` → `{{matterId}}` from `app/admin/claim-index/audit/page.tsx`
- `Display #` → `{{display}}` from `app/admin/claim-index/audit/page.tsx`
- `Patient` → `{{patient}}` from `app/admin/claim-index/audit/page.tsx`
- `Provider / Client` → `{{providerClient}}` from `app/admin/claim-index/audit/page.tsx`
- `Insurer` → `{{insurer}}` from `app/admin/claim-index/audit/page.tsx`
- `Claim #` → `{{claim}}` from `app/admin/claim-index/audit/page.tsx`
- `Final Status` → `{{finalStatus}}` from `app/admin/claim-index/audit/page.tsx`
- `Closed Reason` → `{{closedReason}}` from `app/admin/claim-index/audit/page.tsx`
- `Master Lawsuit` → `{{masterLawsuit}}` from `app/admin/claim-index/audit/page.tsx`
- `Claim` → `{{claim}}` from `app/admin/claim-index/audit/page.tsx`
- `Payment` → `{{payment}}` from `app/admin/claim-index/audit/page.tsx`
- `Balance` → `{{balance}}` from `app/admin/claim-index/audit/page.tsx`
- `Detail` → `{{detail}}` from `app/admin/claim-index/audit/page.tsx`
- `BRL, matter ID, patient, provider, claim...` → `{{brlMatterIdPatientProviderClaim}}` from `app/admin/claim-index/page.tsx`
- `BRL_202600001` → `{{brl202600001}}` from `app/admin/claim-index/page.tsx`
- `1876895480` → `{{1876895480}}` from `app/admin/claim-index/page.tsx`
- `Open / Closed` → `{{openClosed}}` from `app/admin/claim-index/page.tsx`
- `2026.05.00001` → `{{20260500001}}` from `app/admin/claim-index/page.tsx`
- `Claim Amount` → `{{claimAmount}}` from `app/admin/claim-index/page.tsx`
- `Payment` → `{{payment}}` from `app/admin/claim-index/page.tsx`
- `Balance` → `{{balance}}` from `app/admin/claim-index/page.tsx`
- `DOS` → `{{dos}}` from `app/admin/claim-index/page.tsx`
- `Denial Reason` → `{{denialReason}}` from `app/admin/claim-index/page.tsx`
- `Service Type` → `{{serviceType}}` from `app/admin/claim-index/page.tsx`
- `Description` → `{{description}}` from `app/admin/claim-index/page.tsx`
- `Kind` → `{{kind}}` from `app/admin/clients/[id]/invoice/client-costs-ledger/page.tsx`
- `Date Incurred` → `{{dateIncurred}}` from `app/admin/clients/[id]/invoice/client-costs-ledger/page.tsx`
- `Posted Date` → `{{postedDate}}` from `app/admin/clients/[id]/invoice/client-costs-ledger/page.tsx`
- `Cost Type` → `{{costType}}` from `app/admin/clients/[id]/invoice/client-costs-ledger/page.tsx`
- `Matter / Lawsuit` → `{{matterLawsuit}}` from `app/admin/clients/[id]/invoice/client-costs-ledger/page.tsx`
- `Amount` → `{{amount}}` from `app/admin/clients/[id]/invoice/client-costs-ledger/page.tsx`
- `Voided` → `{{voided}}` from `app/admin/clients/[id]/invoice/client-costs-ledger/page.tsx`
- `Invoice Status` → `{{invoiceStatus}}` from `app/admin/clients/[id]/invoice/client-costs-ledger/page.tsx`
- `Eligible` → `{{eligible}}` from `app/admin/clients/[id]/invoice/client-costs-ledger/page.tsx`
- `Invoice Number` → `{{invoiceNumber}}` from `app/admin/clients/[id]/invoice/history/page.tsx`
- `Status` → `{{status}}` from `app/admin/clients/[id]/invoice/history/page.tsx`
- `Created` → `{{created}}` from `app/admin/clients/[id]/invoice/history/page.tsx`
- `Finalized` → `{{finalized}}` from `app/admin/clients/[id]/invoice/history/page.tsx`
- `Voided` → `{{voided}}` from `app/admin/clients/[id]/invoice/history/page.tsx`
- `Lines` → `{{lines}}` from `app/admin/clients/[id]/invoice/history/page.tsx`
- `Principal / Interest` → `{{principalInterest}}` from `app/admin/clients/[id]/invoice/history/page.tsx`
- `Retainer Fee` → `{{retainerFee}}` from `app/admin/clients/[id]/invoice/history/page.tsx`
- `Net Before Costs` → `{{netBeforeCosts}}` from `app/admin/clients/[id]/invoice/history/page.tsx`
- `Costs Received` → `{{costsReceived}}` from `app/admin/clients/[id]/invoice/history/page.tsx`
- `Costs Expended` → `{{costsExpended}}` from `app/admin/clients/[id]/invoice/history/page.tsx`
- `Cost Balance` → `{{costBalance}}` from `app/admin/clients/[id]/invoice/history/page.tsx`
- `Cost Ledger` → `{{costLedger}}` from `app/admin/clients/[id]/invoice/history/page.tsx`
- `Final Net Remit` → `{{finalNetRemit}}` from `app/admin/clients/[id]/invoice/history/page.tsx`
- `Actions` → `{{actions}}` from `app/admin/clients/[id]/invoice/history/page.tsx`
- `Address` → `{{address}}` from `app/admin/clients/[id]/invoice/page.tsx`
- `Owner` → `{{owner}}` from `app/admin/clients/[id]/invoice/page.tsx`
- `Provider Group` → `{{providerGroup}}` from `app/admin/clients/[id]/invoice/page.tsx`
- `Status` → `{{status}}` from `app/admin/clients/[id]/invoice/page.tsx`
- `NF Principal` → `{{nfPrincipal}}` from `app/admin/clients/[id]/invoice/page.tsx`
- `NF Interest` → `{{nfInterest}}` from `app/admin/clients/[id]/invoice/page.tsx`
- `WC Principal` → `{{wcPrincipal}}` from `app/admin/clients/[id]/invoice/page.tsx`
- `WC Interest` → `{{wcInterest}}` from `app/admin/clients/[id]/invoice/page.tsx`
- `Liens Principal` → `{{liensPrincipal}}` from `app/admin/clients/[id]/invoice/page.tsx`
- `Liens Interest` → `{{liensInterest}}` from `app/admin/clients/[id]/invoice/page.tsx`
- `Pull Costs` → `{{pullCosts}}` from `app/admin/clients/[id]/invoice/page.tsx`
- `Remit` → `{{remit}}` from `app/admin/clients/[id]/invoice/page.tsx`
- `Cost Balance` → `{{costBalance}}` from `app/admin/clients/[id]/invoice/page.tsx`
- `Invoice History` → `{{invoiceHistory}}` from `app/admin/clients/[id]/invoice/page.tsx`
- `Matter` → `{{matter}}` from `app/admin/clients/[id]/invoice/page.tsx`
- `Patient` → `{{patient}}` from `app/admin/clients/[id]/invoice/page.tsx`
- `Date of Loss` → `{{dateOfLoss}}` from `app/admin/clients/[id]/invoice/page.tsx`
- `Date of Service` → `{{dateOfService}}` from `app/admin/clients/[id]/invoice/page.tsx`
- `Insurer` → `{{insurer}}` from `app/admin/clients/[id]/invoice/page.tsx`
- `Case Type` → `{{caseType}}` from `app/admin/clients/[id]/invoice/page.tsx`
- `Type` → `{{type}}` from `app/admin/clients/[id]/invoice/page.tsx`
- `Date Posted` → `{{datePosted}}` from `app/admin/clients/[id]/invoice/page.tsx`
- `Check Date` → `{{checkDate}}` from `app/admin/clients/[id]/invoice/page.tsx`
- `Check Number` → `{{checkNumber}}` from `app/admin/clients/[id]/invoice/page.tsx`
- `Amt. Billed` → `{{amtBilled}}` from `app/admin/clients/[id]/invoice/page.tsx`
- `Amt. Received` → `{{amtReceived}}` from `app/admin/clients/[id]/invoice/page.tsx`
- `Retainer Fee` → `{{retainerFee}}` from `app/admin/clients/[id]/invoice/page.tsx`
- `Remit to Provider` → `{{remitToProvider}}` from `app/admin/clients/[id]/invoice/page.tsx`
- `DOL` → `{{dol}}` from `app/admin/clients/[id]/invoice/page.tsx`
- `DOS` → `{{dos}}` from `app/admin/clients/[id]/invoice/page.tsx`
- `Case` → `{{case}}` from `app/admin/clients/[id]/invoice/page.tsx`
- `Posted` → `{{posted}}` from `app/admin/clients/[id]/invoice/page.tsx`
- `Check #` → `{{check}}` from `app/admin/clients/[id]/invoice/page.tsx`
- `Net Remit` → `{{netRemit}}` from `app/admin/clients/[id]/invoice/page.tsx`
- `Direct Paid` → `{{directPaid}}` from `app/admin/clients/[id]/invoice/page.tsx`
- `Net Remit Impact` → `{{netRemitImpact}}` from `app/admin/clients/[id]/invoice/page.tsx`
- `Date Incurred` → `{{dateIncurred}}` from `app/admin/clients/[id]/invoice/page.tsx`
- `Amount` → `{{amount}}` from `app/admin/clients/[id]/invoice/page.tsx`
- `Kind` → `{{kind}}` from `app/admin/clients/[id]/invoice/page.tsx`

## Mapping Policy

Ask Dave before mapping any ambiguous field, duplicate source, legacy placeholder, hidden/internal field, addressee source, signer source, or Re field.

## Next Recommended Phase

Phase 48E should turn this inspection into a reviewed canonical merge-field catalog proposal. It should group fields by workflow and identify uncertain mappings for Dave before any DB write, DOCX conversion, or template mapping.

## Safety

This phase performs no database mutation, no Clio action, no Graph/OneDrive action, no document finalization, no template conversion, and no field mapping.
