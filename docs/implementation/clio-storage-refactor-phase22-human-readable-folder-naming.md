# Clio Storage Refactor Phase 22 Human-Readable Folder Naming Contract

## Purpose

Phase 22 replaces internal bucket folder naming with human-readable, privacy-safe Clio folder names before upload-route rewiring.

## Final naming convention

Pattern: `YYYY-MM Matters` bucket folder containing `YYYY.MM.NNNNN` matter folders.

For BM matter `2026.05.00001`:

- Bucket folder: `2026-05 Matters`
- Matter folder: `2026.05.00001`

## Rationale

- Users can tell where a matter belongs without understanding internal bucket math.
- Names remain privacy-safe because they do not include patient, provider, insurer, or claim data.
- Date buckets keep folder counts manageable.
- The matter folder exactly matches the BM matter number.

## Existing test folders

The earlier live test folders `bucket-002001-003000` and `matter-2026.05.00001` are test artifacts and should not be used as the production naming convention.

## Safety boundary

- No Clio API calls are made.
- No Clio folders are created, renamed, or deleted.
- No documents are uploaded.
- No database rows are mutated.
- Finalization remains unrevised.
