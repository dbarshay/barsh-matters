# Clio Storage Refactor Phase 8 Upload-Target Preview Contract

## Purpose

Phase 8 adds a non-operational preview contract for how future document upload routes will target the single Clio master matter folder structure.

## Scope

`lib/clioSingleMasterUploadTargetPreview.ts` translates a BM matter input into the intended future upload target:

- master matter ID
- master matter name
- bucket folder name
- matter folder name
- matter folder path
- future upload target object

## Safety boundary

- Existing upload/list/open routes are not rewired.
- No Clio API calls are made.
- No folders are created.
- No documents are uploaded.
- No database rows are written or migrated.
- Existing BM matters remain test data and are not preserved or migrated.

## Acceptance criteria

- The preview helper uses the Phase 5 folder-resolution preview.
- The preview explicitly reports `uploadRewired: false`.
- The preview explicitly reports no Clio calls, no folder creation, no document uploads, and no database mutation.
- Phase 2 through Phase 8 verifiers pass.
