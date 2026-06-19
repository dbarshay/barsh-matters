# Clio Storage Refactor Phase 20 Live Single-Master Folder Create Smoke

## Purpose

Phase 20 performs the first controlled live Clio folder creation under the single master matter.

## Controlled target

- Master matter: `Barsh Matters Master Repository` / `1885821245`
- BM test matter: `2026.05.00001`
- Bucket folder: `bucket-002001-003000`
- Matter folder: `matter-2026.05.00001`

## Safety boundary

- Creates/finds only the controlled bucket folder and matter folder. The bucket folder is created under the Clio root/container folder exposed by the master matter inventory, falling back to the single visible folder row when Clio does not expose an empty parent field.
- Uses find-before-create to avoid duplicate folders on rerun.
- Does not upload documents.
- Does not mutate the database.
- Does not rewire finalization.
- Does not stage env/secrets.

## Required live-write flags

- `CLIO_SINGLE_MASTER_LIVE_WRITE_COMMAND=RUN_CLIO_SINGLE_MASTER_FOLDER_CREATE`
- `CLIO_SINGLE_MASTER_CREATE_FOLDERS_ENABLED=1`
- `CLIO_SINGLE_MASTER_LIVE_WRITE_ENABLED=1`

- Clio child-folder creates require `parent: { id, type: "Folder" }`.
