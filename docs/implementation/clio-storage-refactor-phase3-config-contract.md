# Clio Storage Refactor Phase 3 Config Contract

## Purpose

Phase 3 adds the typed runtime configuration contract for the Clio single-master storage refactor.

This phase is intentionally non-operational. It does not change document upload, document listing, document opening, folder creation, Clio matter creation, Clio folder creation, migrations, or existing data.

## Runtime contract

The configuration module is `lib/clioStorageConfig.ts`.

It reads these environment variables:

- `CLIO_STORAGE_MODE`
- `CLIO_MASTER_MATTER_ID`
- `CLIO_MASTER_MATTER_NAME`
- `CLIO_BUCKET_SIZE`

Required single-master values:

```env
CLIO_STORAGE_MODE=single_master_matter
CLIO_MASTER_MATTER_ID=1885821245
CLIO_MASTER_MATTER_NAME="Barsh Matters Master Repository"
CLIO_BUCKET_SIZE=1000
```

## Safety boundary

- No Clio API calls are made by this module.
- No folders are created.
- No documents are uploaded.
- No existing routes are rewired.
- No database migrations are added.
- Existing BM matters remain test data and are not preserved or migrated.

## Acceptance criteria

- `lib/clioStorageConfig.ts` exists.
- The config contract recognizes `single_master_matter`.
- The config contract requires master matter ID and name only in single-master mode.
- The config contract defaults `CLIO_BUCKET_SIZE` to `1000` if omitted.
- The Phase 2 verifier still passes.
- The Phase 3 verifier passes.
