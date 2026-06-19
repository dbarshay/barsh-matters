# Clio Storage Refactor Phase 13 Dry-Run Folder Create Request Planner

## Purpose

Phase 13 adds a dry-run-only request planner for future Clio folder creation under the single master matter.

This phase does not call Clio, create folders, upload documents, rewire finalization, or mutate the database.

## Planned future requests

The planner builds two dry-run request descriptions:

1. Bucket folder request under the master matter.
2. Matter folder request under the computed bucket folder.

## Safety boundary

- Request descriptions are data only.
- No Clio API calls are made.
- No Clio folders are created.
- No Clio documents are uploaded, moved, or deleted.
- Existing upload/list/open/finalize routes are not rewired.
- No database migrations are added.
- Existing BM matters remain test data and are not preserved or migrated.

## Acceptance criteria

- The dry-run planner exists.
- The planner uses the Phase 5 folder-resolution preview.
- The planner uses the Phase 11 write guard.
- The planner explicitly reports `dryRunOnly: true` and `blockedByDefault: true`.
- The planner performs no IO.
- Phase 8 through Phase 13 verifiers pass.
