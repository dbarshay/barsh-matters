# Phase 46B — Requested Document-Key Mismatch Guard

## Status

Behavior safety patch. This phase prevents silent document substitution during working-DOCX creation.

## Problem

Phase 46A documented that `/api/documents/working-docx` selected a requested document key if available, but otherwise fell back to the first available generation-ready planned document.

That fallback is safe when no specific document key is requested. It is unsafe when a specific key is requested and unavailable because the user may believe one document was selected while the system actually selected another.

This was exposed when direct proof requested `summons-complaint`, but the direct planned-document list did not include that key. Because a `general` stored DB DOCX template was available, the workflow selected `harmless-stored-docx-test-template`.

## Phase 46B rule

When `documentKeys` are supplied:

1. `/api/documents/working-docx` must select one of those requested keys from `plannedDocuments`.
2. If none of the requested keys are available in the matter/template context, the route must return HTTP 422.
3. The response must include:
   - `requestedKeys`
   - `availableDocumentKeys`
   - `plannedDocumentCount`
   - `selectionPolicy.allowsFallbackWhenRequestedKeyMissing: false`
   - `selectionPolicy.fallbackOnlyWhenNoRequestedKeys: true`

When no `documentKeys` are supplied, the prior fallback to the first available generation-ready document remains available.

## Safety

This phase does not create templates, replace templates, finalize documents, upload to Clio, create Graph working documents, create print queue items, send email, or mutate database records.
