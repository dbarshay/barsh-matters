# Template Builder Phase 5 — Template Creation Readiness Gate

## Scope

Phase 5 is the final readiness gate before actual template creation. It prepares the contract for creating a new template but still does not create templates, upload DOCX files, write BM cloud objects, create Prisma records, activate templates, mutate DOCX tokens, or wire matter-side Generate Documents.

## Creation inputs

Actual template creation must require:

- BM display name
- local DOCX file picker
- default signature mode

Default signature mode options:

- Firm
- User Selects

New templates default to Inactive.

## Storage rules

Templates are stored only in BM cloud storage and never in Clio.

New template creation stores the DOCX under:

- templates/inactive/

The UI must show only the BM display name. Routine admin UI must not show the stored DOCX filename, storage key, cloud path, raw blob, or internal object path.

## Filename uniqueness

The uploaded local DOCX filename must be checked across all template folders:

- templates/active/
- templates/inactive/
- templates/archived/
- templates/deleted/

A new template upload is blocked if the filename already exists anywhere in the repository.

Editing or replacing an existing template may reuse the same filename for that same template, or may use a different filename if that filename is not already used by another template.

## DOCX validation

Creation accepts DOCX only. It rejects non-DOCX file types.

Creation must run the token scan before save. Phase 4 scan rules govern warning-only and blocking outcomes.

## Last Edited and audit

Creating a template updates Last Edited and Last Edited By.

Template creation must be audit logged with safe details only:

- template created/seeded
- DOCX stored in BM cloud template repository
- initial token scan completed

Audit displays must not expose DOCX contents, raw blobs, internal storage paths, or cloud object keys.

## Admin permission

Creation is admin-only and uses:

- templates.manage

## Ready-for-template-creation definition

After this phase, the app is ready for an implementation phase that wires:

- Create Template form submit
- DOCX-only file handling
- BM cloud object write to templates/inactive/
- duplicate filename check across all template prefixes
- token scan before save
- Prisma DocumentTemplate and DocumentTemplateVersion creation
- Last Edited / Last Edited By update
- audit log entry

It is still not ready for matter-side Generate Documents until template creation, replacement, activation, and generation scans are implemented separately.
