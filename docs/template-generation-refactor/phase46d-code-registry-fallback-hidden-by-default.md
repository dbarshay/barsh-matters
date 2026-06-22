# Phase 46D — Hide Code-Registry Template Fallback by Default

## Status

Behavior cleanup after Phase 46C. Phase 46C deleted all stored database document templates because they were test templates. Phase 46D prevents those old seed/code-registry fallback templates from reappearing in the normal template repository response when the database is empty.

## Rule

`/api/documents/templates` remains database-first.

When the configured database has no enabled template rows for the requested category:

- normal behavior returns an empty template list;
- code-registry fallback templates are hidden by default;
- fallback can be shown only by explicit opt-in:
  - request query `includeFallbackRegistry=1`, or
  - environment flag `BARSH_DOCUMENT_TEMPLATE_ALLOW_CODE_REGISTRY_FALLBACK=1`.

## Reason

After all test templates were deleted from the database, showing fallback registry entries by default would make it look as if templates still exist. That is misleading during production template creation.

## Safety

This phase does not:

- create or delete database template rows;
- create or replace DOCX versions;
- upload to Clio;
- create Graph/OneDrive working documents;
- finalize documents;
- send email;
- create print queue items.

## Next step

The next phase should define and create the first real production template metadata/DOCX import path without relying on fallback registry entries.
