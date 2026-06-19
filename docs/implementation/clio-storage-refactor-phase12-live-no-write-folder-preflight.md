# Clio Storage Refactor Phase 12 Live No-Write Folder-Create Preflight

## Purpose

Phase 12 verifies that future Clio folder creation is blocked by default and remains double-gated before any operational folder-create phase.

This phase does not call Clio, create folders, upload documents, rewire finalization, or mutate the database.

## Guard requirements

Folder creation may not proceed unless both flags are explicitly enabled:

- `CLIO_SINGLE_MASTER_CREATE_FOLDERS_ENABLED=1`
- `CLIO_SINGLE_MASTER_LIVE_WRITE_ENABLED=1`

Upload rewiring remains separately gated by:

- `CLIO_SINGLE_MASTER_UPLOAD_REWIRE_ENABLED=1`

## Safety boundary

- No Clio API calls are made.
- No Clio folders are created.
- No Clio documents are uploaded, moved, or deleted.
- Existing upload/list/open/finalize routes are not rewired.
- No database migrations are added.
- Existing BM matters remain test data and are not preserved or migrated.

## Acceptance criteria

- The Phase 12 verifier exists.
- The verifier confirms default folder creation is blocked.
- The verifier confirms one write flag alone is insufficient.
- The verifier confirms both folder-write flags are required.
- The verifier confirms upload rewiring remains separately gated.
- Phase 8 through Phase 12 verifiers pass.
