# Clio Storage Refactor Phase 14 Dry-Run Folder Create API Preview

## Purpose

Phase 14 exposes the Phase 13 folder-create dry-run plan through a GET-only API preview route.

This phase does not call Clio, create folders, upload documents, rewire finalization, or mutate the database.

## Route

`GET /api/documents/clio-folder-create-dry-run-plan`

Accepted query parameters include:

- `bmMatterId`
- `matterId`
- `directMatterId`
- `displayNumber`
- `directMatterDisplayNumber`
- `lawsuitId`
- `masterLawsuitId`
- `label`

## Safety boundary

- GET-only preview route.
- Dry-run data only.
- No Clio API calls are made.
- No Clio folders are created.
- No Clio documents are uploaded, moved, or deleted.
- Existing upload/list/open/finalize routes are not rewired.
- No database migrations are added.
- Existing BM matters remain test data and are not preserved or migrated.

## Acceptance criteria

- The dry-run API route exists.
- The route uses the Phase 13 dry-run planner.
- The route is GET-only.
- The route explicitly reports no Clio calls, no folder creation, no document uploads, no database mutation, and no finalize-route rewiring.
- Phase 8 through Phase 14 verifiers pass.
