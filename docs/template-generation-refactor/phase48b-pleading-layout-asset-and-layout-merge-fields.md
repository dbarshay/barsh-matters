# Phase 48B — Pleading Paper Layout Asset and Layout Merge-Field Inventory

## Status

Guarded production import for the `pleading-paper` DOCX layout asset and layout-level merge-field inventory.

## Decisions

- Layout label: `Pleading Paper`
- Layout key: `pleading-paper`
- Layout kind: non-generation layout asset
- Category/storage bucket: `general`
- User-facing layout family: `pleading_paper`
- Format: DOCX-based, available to Mac and Windows users
- Normal generation selection: disabled; this is not a user-selectable document template
- Import method: guarded script
- Template/layout creation permission: owner-admin only
- Field mapping: not performed in this phase
- Merge-field inventory: captured only
- Mapping status: mapping pending user review

## Layout Asset Rule

`pleading-paper` is a layout asset. It must not appear in Generate Documents as a selectable normal template.

Generation templates may later declare:

- `layoutFamily: pleading_paper`
- `layoutAssetKey: pleading-paper`

## Pleading Placeholder Inventory

The imported pleading DOCX uses legacy `<<...>>` placeholders. Phase 48B extracts those placeholders and records them as layout merge-field inventory only.

The legacy placeholders remain unmapped until Dave approves the mappings.

## Letterhead Merge-Field Inventory

Phase 48B also records mergeable layout fields for `letterhead-simple`, including:

- `todayLong`
- `userName`
- `firmName`
- `firmAddressLine1`
- `firmAddressLine2`
- `firmPhone`
- `firmFax`
- `firmEmail`

These are inventory fields only. The field mappings remain pending.

## Safety

The import script writes only Barsh Matters local template repository rows:

- `DocumentTemplate`
- `DocumentTemplateVersion`
- `DocumentTemplateMergeField`

It stores the uploaded DOCX file as `db-docx-base64` in the current `DocumentTemplateVersion`.

The import does not upload to Clio, create Graph/OneDrive working documents, finalize documents, send email, create drafts, print, create print queue items, perform field mapping, or touch matter/lawsuit/file-number data.


## Comprehensive Barsh Matters Merge-Field Scope

Phase 48B only imports the pleading-paper layout asset and captures layout merge-field inventory.

The full Barsh Matters merge-field catalog must later include:

- all visible UI fields in Barsh Matters
- all non-viewable fields in the database tables already created
- hidden/internal fields needed for document generation, reporting, audit, and workflow logic
- layout-level merge fields for letterhead and pleading paper
- template-specific fields from uploaded DOCX placeholders

This phase does not perform that full catalog build and does not map fields. A later phase must inventory Prisma schema fields, API payload fields, UI display fields, and hidden/internal table fields before final template mapping.
