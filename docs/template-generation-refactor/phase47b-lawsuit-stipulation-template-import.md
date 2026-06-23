# Phase 47B — Lawsuit Stipulation of Settlement DOCX Template Import

## Status

Guarded production template import for the first real DOCX-based template.

## Decisions

- Template label: `Stipulation of Settlement`
- Template key: `lawsuit-stipulation-of-settlement`
- Internal category: `lawsuit`
- Verifier token: category: lawsuit
- User-facing workflow: Lawsuit
- Format: DOCX-based, available to both Mac and Windows users
- Import method: guarded script
- Template creation permission: owner-admin only
- Placeholder handling: imported as-is with legacy `<<PLACEHOLDER>>` syntax
- Future placeholder convention: `{{camelCase}}`
- Field mapping: not performed in this phase; uncertain mappings will be presented to Dave before conversion.

## Safety

The import script writes only Barsh Matters local template repository rows:

- `DocumentTemplate`
- `DocumentTemplateVersion`
- `DocumentTemplateMergeField`

It stores the uploaded DOCX file as `db-docx-base64` in the current `DocumentTemplateVersion`.

The import does not upload to Clio, create Graph/OneDrive working documents, finalize documents, send email, create drafts, print, create print queue items, or touch matter/lawsuit/file-number data.

## Rollback

The import writes a local Desktop backup and a rollback script before/with the import proof. The rollback script deletes only the `lawsuit-stipulation-of-settlement` template, its versions, and its merge fields.
