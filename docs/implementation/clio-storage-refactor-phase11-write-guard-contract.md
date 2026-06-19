# Clio Storage Refactor Phase 11 Guarded Folder-Write Feature-Flag Contract

## Purpose

Phase 11 adds the non-operational write-guard contract required before any future Clio folder creation phase.

This phase does not call Clio, create folders, upload documents, rewire finalization, or mutate the database.

## Feature flags

- `CLIO_SINGLE_MASTER_CREATE_FOLDERS_ENABLED=1` permits a future folder-creation phase to pass the folder-create guard.
- `CLIO_SINGLE_MASTER_LIVE_WRITE_ENABLED=1` is a second explicit live-write guard.
- `CLIO_SINGLE_MASTER_UPLOAD_REWIRE_ENABLED=1` is reserved for a later upload-route rewiring phase.

## Current behavior

`lib/clioStorageWriteGuard.ts` only reads environment flags and returns a guard decision.

The guard itself performs no IO.

## Safety boundary

- No Clio API calls are made.
- No Clio folders are created.
- No Clio documents are uploaded, moved, or deleted.
- No Clio matters are created, edited, or deleted.
- Existing upload/list/open/finalize routes are not rewired.
- No database migrations are added.
- Existing BM matters remain test data and are not preserved or migrated.

## Acceptance criteria

- The write guard exists.
- The guard requires both `CLIO_SINGLE_MASTER_CREATE_FOLDERS_ENABLED=1` and `CLIO_SINGLE_MASTER_LIVE_WRITE_ENABLED=1` before folder writes can be allowed.
- Upload rewiring remains separately gated by `CLIO_SINGLE_MASTER_UPLOAD_REWIRE_ENABLED=1`.
- The guard performs no IO.
- Phase 8, Phase 9, Phase 10, and Phase 11 verifiers pass.
