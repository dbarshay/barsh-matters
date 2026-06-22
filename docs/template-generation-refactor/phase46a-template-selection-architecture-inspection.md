# Phase 46A — Template Selection Architecture Inspection

## Status

Inspection lock only. This phase documents the current template-selection and document-generation architecture after the Clio single-master storage refactor. It does not change template behavior, create templates, upload documents, finalize documents, call Clio, call Graph, or mutate production data.

## Starting point

Locked head before this inspection:

- `ea8f774e573f2fc3d326824f96d87dd2407e34ac`
- tag: `production-direct-live-proof-ledger-repair-20260622-173811`

## Current architecture findings

### 1. Local Barsh Matters template repository is database-first

`/api/documents/templates` reads enabled `DocumentTemplate` rows from the local Barsh Matters database first. If no rows exist for the requested category, the endpoint falls back to seeded code-registry templates for that category.

Important consequence: `category=all` can return database templates even when `category=lawsuit` or `category=direct_matter` returns no category-specific database templates.

### 2. Stored DB DOCX versions are the current editable-template path

Stored DOCX template payloads are represented as `DocumentTemplateVersion` records with:

- `storageKind: "db-docx-base64"`
- base64 DOCX content in the version body/content field
- current version metadata exposed through the repository APIs
- download/generation source through `/api/documents/templates/stored-docx?versionId=...`

The stored-DOCX route is read-only and decodes the stored DOCX by version id.

### 3. Master/lawsuit finalize-preview combines stored DB templates and placeholders

`/api/documents/finalize-preview` builds master/lawsuit planned documents by combining:

1. stored DB DOCX templates, then
2. hardcoded placeholder documents:
   - `bill-schedule`
   - `packet-summary`
   - `summons-complaint`

Stored DB templates are intentionally ordered before placeholders.

### 4. Direct finalize-preview currently has a narrower document plan

`/api/documents/direct-finalize-preview` currently builds direct/individual planned documents only from stored DB DOCX templates whose categories are:

- `direct_matter`
- `general`

It does not append master/lawsuit placeholder documents such as `summons-complaint`.

### 5. Why direct requested `summons-complaint` but selected `harmless-stored-docx-test-template`

The reusable direct proof initially requested `summons-complaint`, but direct planned documents did not include that key. The working-DOCX route selection logic is:

1. select a planned document whose key is included in requested `documentKeys`; otherwise
2. select the first planned document that is generation-ready and available.

Because the harmless stored DOCX test template is an enabled `general` template, it is eligible in the direct preview plan. When `summons-complaint` is unavailable in direct planned documents, the fallback selection can choose `harmless-stored-docx-test-template`.

### 6. `generate-preview` is not the direct selector path

`/api/documents/generate-preview` is currently a GET-style preview endpoint for master/lawsuit preview. POST probes return 405. It is not currently the canonical direct document-key selection test path.

## Design implications before template expansion

Before production template creation/generation expansion, the next behavior phase should decide and enforce:

1. Whether direct matters should ever see `general` stored templates by default.
2. Whether direct matters need their own production template category keys instead of relying on `general`.
3. Whether requested document-key mismatch should hard-fail instead of falling back silently.
4. Whether `summons-complaint` should remain master/lawsuit-only.
5. Whether test templates should be hidden from normal production document-generation dropdowns.
6. Whether direct and master generation should share one normalized planned-document selector contract.

## Safety

This inspection phase documents existing behavior only. It does not arm live finalization, create or replace templates, upload to Clio, create Graph working documents, create print queue items, or mutate the database.
