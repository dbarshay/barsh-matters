# Clio Storage Refactor Phase 15 Guarded Folder-Create Executor Contract

## Purpose

Phase 15 adds a guarded folder-create executor module for a later operational phase.

## Safety boundary

- The executor is not wired into document finalization.
- The executor is not wired into preview routes.
- This phase does not run live folder creation.
- Folder creation is blocked unless the Phase 11 write guard allows it.
- Existing BM matters remain test data and are not preserved or migrated.

## Acceptance criteria

- `lib/clioFolderCreateExecutor.ts` exists.
- The executor requires `assertClioStorageFolderWriteAllowed`.
- The executor contains the only new Clio folder POST primitive.
- No route imports or calls the executor.
- Finalization remains unrevised.
- No env/secrets are staged.
