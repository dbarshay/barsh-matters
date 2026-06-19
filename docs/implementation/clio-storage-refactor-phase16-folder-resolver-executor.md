# Clio Storage Refactor Phase 16 Guarded Folder Resolver Executor

## Purpose

Phase 16 adds a guarded resolver executor that can later create the computed bucket folder and matter folder through the Phase 15 guarded executor.

## Safety boundary

- The resolver is not wired into document finalization.
- The resolver is not wired into preview routes.
- This phase does not run live folder creation.
- The Phase 15 executor remains the only new Clio folder POST primitive.
- Existing BM matters remain test data and are not preserved or migrated.

## Acceptance criteria

- `lib/clioFolderResolverExecutor.ts` exists.
- The resolver uses `buildClioStorageFolderResolutionPreview`.
- The resolver uses `createClioFolderWithGuard`.
- No route imports or calls the resolver.
- Finalization remains unrevised.
- No env/secrets are staged.
