# Clio Storage Refactor Phase 4 Storage Target Planner

## Purpose

Phase 4 adds the non-operational read model that computes where a BM matter should live inside the manually created Clio master matter.

## Target structure

- Clio master matter/file: `Barsh Matters Master Repository`
- Clio master matter ID: `1885821245`
- Bucket folders are grouped by `CLIO_BUCKET_SIZE`.
- Default bucket size is `1000`.
- Each BM matter receives one flat matter folder inside its computed bucket.

Example bucket folder names:

- `YYYY-MM Matters`
- `bucket-001001-002000`
- `2026-05 Matters`

## Safety boundary

- No Clio API calls are made.
- No Clio folders are created.
- No Clio documents are uploaded or moved.
- Existing upload/list/open routes are not rewired.
- No database migrations are added.
- Existing BM matters remain test data and are not preserved or migrated.

## Acceptance criteria

- `lib/clioStoragePlan.ts` exists.
- The planner uses the Phase 3 config contract.
- The planner computes deterministic bucket ranges from a positive matter ordinal.
- The planner produces one matter folder path under a bucket folder.
- The Phase 2, Phase 3, and Phase 4 verifiers pass.
