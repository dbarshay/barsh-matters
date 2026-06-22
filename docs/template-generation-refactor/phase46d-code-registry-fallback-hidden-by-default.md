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

## Phase 46D repair

The first Phase 46D attempt wrote the intended documentation and verifier but did not patch `/api/documents/templates/route.ts` because the patch anchor did not match the current route text. The repair applied the actual route change and updated the older repository-foundation verifier so it no longer expects fallback templates to appear by default when the DB is empty.

Normal `/api/documents/templates` responses now return database rows only by default. Code-registry fallback templates require explicit opt-in through `includeFallbackRegistry=1` or `BARSH_DOCUMENT_TEMPLATE_ALLOW_CODE_REGISTRY_FALLBACK=1`.

