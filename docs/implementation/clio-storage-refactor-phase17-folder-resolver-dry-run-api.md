# Clio Storage Refactor Phase 17 Guarded Folder Resolver Dry-Run API

## Purpose

Phase 17 adds a GET-only dry-run API endpoint for the future guarded folder resolver.

## Safety boundary

- The endpoint does not call `resolveClioMatterFolderWithGuard`.
- The endpoint does not call Clio.
- The endpoint does not create folders.
- The endpoint does not upload documents.
- The endpoint does not mutate the database.
- Existing upload/list/open/finalize routes are not rewired.

## Acceptance criteria

- The dry-run route exists.
- The route uses the Phase 13 dry-run planner.
- The route does not call the Phase 16 resolver executor.
- The route is GET-only.
- Finalization remains unrevised.
- No env/secrets are staged.
