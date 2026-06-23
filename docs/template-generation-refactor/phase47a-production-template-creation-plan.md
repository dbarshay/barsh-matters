# Phase 47A — Production Template Creation Plan and Decision Checkpoint

## Status

Planning/decision checkpoint only. This phase does not create templates, import DOCX files, generate documents, create Graph working documents, finalize documents, upload to Clio, send email, create print queue items, or mutate database rows.

## Current locked baseline

Phase 46C deleted all stored database test templates and verified the following tables are empty:

- `DocumentTemplate`
- `DocumentTemplateVersion`
- `DocumentTemplateMergeField`

Phase 46D then hid code-registry fallback templates by default so normal template repository responses do not show old fallback/test templates when the database is empty.

## Current repository rules

1. Barsh Matters local DB remains the source of truth for production templates.
2. Clio remains storage only for finalized/generated artifacts.
3. Template rows should be created in `DocumentTemplate`.
4. DOCX file versions should be stored in `DocumentTemplateVersion` using `storageKind: "db-docx-base64"`.
5. Merge-field definitions should be tracked in `DocumentTemplateMergeField`.
6. Direct/individual generation must not silently substitute a different template when a requested `documentKey` is unavailable.
7. Code-registry fallback templates are hidden by default and are not the production-template source.

## Proposed production template taxonomy

### Lawsuit templates

Category: `lawsuit`

Use for master/lawsuit document generation. These may use lawsuit-level data, aggregated child-matter data, index/court/adversary attorney data, and claim/bill schedule data.

Recommended first keys:

- `lawsuit-summons-complaint`
- `lawsuit-bill-schedule`
- `lawsuit-packet-summary`

### Direct matter templates

Category: `direct_matter`

Use for individual/direct matter generation before aggregation into a lawsuit.

Recommended first keys:

- `direct-demand-letter`
- `direct-arbitration-demand`
- `direct-claim-cover-letter`

### Settlement templates

Category: `settlement`

Use only for settlement workflows and settlement finalization paths.

Recommended first keys:

- `settlement-confirmation-letter`
- `settlement-release-cover-letter`
- `settlement-summary`

### Payment/remittance templates

Category: `payment`

Use only for provider-client invoice/remittance/reporting document generation.

Recommended first keys:

- `provider-remittance-statement`
- `provider-invoice-summary`
- `attorney-fee-report`

### General templates

Category: `general`

Decision required. Because `general` templates can be eligible across contexts, normal production generation should probably avoid using `general` unless there is a specific cross-context template need. The safer default is:

- allow `general` only for administrative/reference templates, or
- require explicit workflow opt-in before a `general` template appears in direct/master generation.

## Naming convention proposal

Template keys should be stable, lowercase, hyphenated, and workflow-prefixed:

- `lawsuit-summons-complaint`
- `direct-demand-letter`
- `settlement-confirmation-letter`
- `provider-remittance-statement`

Labels should be user-facing:

- `Summons and Complaint`
- `Direct Demand Letter`
- `Settlement Confirmation Letter`
- `Provider Remittance Statement`

Filename suffixes should be short and user-facing:

- `Summons and Complaint`
- `Direct Demand Letter`
- `Settlement Confirmation`
- `Provider Remittance Statement`

Generated filenames should continue to use Barsh Matters file/lawsuit numbers and safe matter identity data.

## Merge-field convention proposal

Use `{{camelCaseFieldName}}` placeholders inside DOCX templates.

Recommended namespaces:

- Matter identity:
  - `{{matterNumber}}`
  - `{{lawsuitNumber}}`
  - `{{directMatterNumber}}`
- Parties:
  - `{{providerName}}`
  - `{{patientName}}`
  - `{{insurerName}}`
  - `{{claimNumber}}`
- Dates:
  - `{{dateOfLoss}}`
  - `{{dosStart}}`
  - `{{dosEnd}}`
  - `{{todayLong}}`
- Lawsuit fields:
  - `{{courtName}}`
  - `{{indexNumber}}`
  - `{{adversaryAttorneyName}}`
  - `{{dateFiled}}`
- Financial fields:
  - `{{claimAmount}}`
  - `{{balanceAmount}}`
  - `{{amountSought}}`
  - `{{interestAmount}}`
- Firm fields:
  - `{{firmName}}`
  - `{{firmAddress}}`
  - `{{firmPhone}}`
  - `{{firmEmail}}`

Merge fields should be classified as:

- `visible_ui`: user can see/edit or verify directly in the UI.
- `hidden_internal`: sourced from reference data, calculated data, or non-editable system data.
- `computed`: calculated during generation.
- `system`: firm/system constants.

## Import workflow proposal

The first production import should use an existing DOCX and the template detail replacement/storage pathway, not code-registry fallback.

Recommended flow:

1. Create metadata row in `DocumentTemplate`.
2. Store DOCX as version 1 in `DocumentTemplateVersion`.
3. Store merge-field definitions in `DocumentTemplateMergeField`.
4. Confirm `/api/documents/templates?category=<category>` shows only the new DB template.
5. Confirm the relevant workflow shows only eligible category templates.
6. Create a working DOCX only in a safe no-finalize path.
7. Do not finalize/upload to Clio until separately gated.

## Required decisions before Phase 47B

1. First production template to build:
   - lawsuit summons/complaint
   - direct demand letter
   - settlement confirmation
   - provider remittance/invoice
   - other

2. Exact user-facing name for the first template.

3. Exact stable template key.

4. Template category:
   - `lawsuit`
   - `direct_matter`
   - `settlement`
   - `payment`
   - `general`

5. Whether `general` templates should ever appear in normal direct/master generation.

6. Whether first template content will be:
   - uploaded as an existing DOCX,
   - drafted/generated from scratch,
   - imported from an existing document in the repo,
   - copied from another source.

7. Whether merge fields should use:
   - `{{camelCase}}`
   - `[[UPPER_SNAKE_CASE]]`
   - another convention.

8. Whether the first import should be local/dev only before production deploy.

9. Whether admin template import should allow direct metadata creation from the UI or only through a guarded script until the workflow is polished.

10. Whether template creation should be owner-admin only.

## Recommended next phase

Phase 47B should be a decision implementation phase that creates one real production template metadata row and DOCX version in the DB after the above decisions are answered. It should include a local backup and a rollback script before any DB write.

## Safety

Phase 47A is documentation and verifier only. It performs no database write and no external document action.
