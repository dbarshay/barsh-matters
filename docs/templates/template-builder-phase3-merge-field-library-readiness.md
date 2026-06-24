# Template Builder Phase 3 — Merge-Field Library and Custom Placeholder Readiness

## Scope

Phase 3 makes the Build Template readiness surface more concrete. It adds a shared merge-field library contract for canonical fields, signature/header fields, categories, format modifiers, and custom manual placeholders.

This phase does not implement production DOCX upload, DOCX replacement, token mutation inside DOCX files, category persistence, custom-placeholder persistence, or matter-side Generate Documents.

## Starting categories

Default top-level categories:

- Matter
- People
- General

Default subcategory:

- People → Signature/Header

General is fixed, cannot be renamed, and cannot be deleted. If a category or subcategory containing fields is deleted in a later persistence phase, those fields must move automatically to General.

## Field display and search

The Build Template table uses these columns:

- Category
- Field Label
- Merge Field
- Example Output
- Copy

Search covers category, subcategory, field label, merge token, example output, field type, kind, and developer-defined aliases.

Canonical field labels and categories are UI-display metadata only. Editing labels/categories later must not change the underlying canonical token.

## Example output

Canonical field examples come from the selected example matter.

Signature/header fields show usage notes instead of sample-matter values.

Custom manual placeholders show the admin-defined example value.

## Supported modifiers

Supported modifiers:

- upper
- lower
- title
- date:MM/DD/YYYY
- date:Month D, YYYY
- currency
- bold
- italic
- underline

The UI presents As Stored as the default copy mode. Later production logic must hide incompatible modifiers, normalize modifier order, and prevent conflicting modifiers.

## Signature/header readiness

The library includes:

- {{signature.phoneLine}}
- {{signature.faxNumber}}
- {{signature.email}}
- {{signature.image}}
- {{signature.name}}
- {{signature.block}}

{{signature.block}} is not marked Recommended. Spacing is controlled by the Word template.

## Custom manual placeholder readiness

Custom manual placeholders are global/reusable and admin-controlled. They are not arbitrary mapped fields to BM database/source paths.

Required fields:

- Category
- Field Label
- Merge Field Token
- Prompt shown during document generation
- Example value
- Required
- Field Type

Allowed field types:

- Text
- Date
- Amount
- Number

Tokens use {{custom...}}. Duplicate custom tokens must be blocked against canonical tokens and existing custom tokens.

## Later deletion/edit rules preserved

Delete/archive/deactivate of a custom placeholder is blocked if used in any Active template. If used only in Inactive or Archived templates, deletion may proceed.

If a custom token changes later, the admin must choose one of:

- Update token in all affected templates automatically
- Do not update templates; I will update DOCX files manually
- Cancel

Automatic token updates must apply to Active, Inactive, and Archived templates; preserve formatted variants and modifiers; update Last Edited/By for successfully changed templates; report successes and failures separately; and run the normal token scan after update.

## Phase 3 lock criteria

This phase is locked when the shared merge-field library, Build Template readiness page, focused verifier, Phase 1 verifier, Phase 2 verifier, and TypeScript validation all pass.
