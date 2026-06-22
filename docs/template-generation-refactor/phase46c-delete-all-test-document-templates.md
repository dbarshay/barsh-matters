# Phase 46C — Delete All Test Document Templates

## Status

Database cleanup lock. All stored database document templates were test templates and were removed from the configured Barsh Matters database after a local JSON backup was written to the Desktop.

## Scope

Deleted from the configured Prisma database:

- all `DocumentTemplateMergeField` rows
- all `DocumentTemplateVersion` rows
- all `DocumentTemplate` rows

## Safety

This phase did not:

- upload to Clio
- create or reuse Clio folders
- create Graph/OneDrive working documents
- finalize documents
- send email
- create print queue items
- alter matter/lawsuit/file-number data

## Important note

This phase deletes stored database template records. It does not remove hardcoded master/lawsuit placeholder document generators such as `bill-schedule`, `packet-summary`, or `summons-complaint`.

It also does not yet remove the old code-registry fallback definitions used by the admin template repository endpoint when the database has no rows. If those fallback definitions appear in the admin page after this cleanup, the next phase should remove or disable fallback display for normal production/admin use.

## Phase 46C repair

The first Phase 46C attempt documented the intended cleanup but used raw `new PrismaClient()`, which is invalid under the repo's Prisma 7 adapter configuration. The repair reran the cleanup using the established `adapter-pg` / `pg.Pool` construction pattern already used elsewhere in the repository.

The repair wrote a Desktop backup before deletion and then verified that these configured database tables are empty:

- `DocumentTemplate`
- `DocumentTemplateVersion`
- `DocumentTemplateMergeField`

The repair remains limited to the Barsh Matters template repository database rows. It did not upload to Clio, create Graph working documents, finalize documents, send email, create print queue items, or alter matter/lawsuit/file-number data.

