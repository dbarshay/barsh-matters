# Clio Storage Refactor Phase 21 Live Folder Idempotency Proof

## Purpose

Phase 21 proves the Phase 20 live folder-create smoke is idempotent after live folder creation.

## Observed result

- Existing bucket folder found; not recreated.
- Existing matter folder found; not recreated.
- No document upload occurred.
- No database mutation occurred.
- Finalization remained unrevised.

## Locked folder IDs

- Bucket folder `2026-05 Matters`: `22059823835`
- Matter folder `2026.05.00001`: `22059823955`

## Root/container detection repair

Clio folder inventory may show the matter root/container row with a parent ID outside the returned inventory. Phase 21 treats that row as the root/container for child folder operations.

## Safety boundary

- Uses find-before-create.
- Rerun must report `BUCKET_FOLDER_CREATED=false`.
- Rerun must report `MATTER_FOLDER_CREATED=false`.
- No env/secrets are staged.
