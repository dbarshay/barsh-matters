# Clio Storage Refactor Phase 2 Setup

## Purpose

Phase 2 prepares Barsh Matters for single-master Clio storage by confirming the manually created Clio master matter and configuring local runtime environment variables.

This phase does not migrate, reset, delete, or preserve existing BM test matters.

## Manual Clio setup

- Clio master matter/file name: `Barsh Matters Master Repository`
- Clio master matter ID: `1885821245`
- BM creates bucket folders under that master matter.
- BM creates one flat folder per BM matter.
- Templates remain in BM only.
- Clio stores generated documents, scans, uploaded emails, attachments, and other matter documents only.
- Existing BM matters are test data and do not need to be preserved.

## Required environment variables

```env
CLIO_STORAGE_MODE=single_master_matter
CLIO_MASTER_MATTER_ID=1885821245
CLIO_MASTER_MATTER_NAME="Barsh Matters Master Repository"
CLIO_BUCKET_SIZE=1000
```

## Local configuration status

The local home-machine `.env.local` was configured on 2026-06-19 and validated. `.env.local` is ignored by git and must not be committed.

## Non-goals

- Do not create one Clio matter per BM matter.
- Do not move templates into Clio.
- Do not migrate existing BM matters.
- Do not reset or delete existing BM test data.
- Do not run a full build unless a later implementation phase requires it.

## Acceptance criteria

- The manually created Clio master matter exists.
- The master matter/file name is exactly `Barsh Matters Master Repository`.
- The master matter ID is exactly `1885821245`.
- Local runtime configuration contains all four Phase 2 variables.
- `.env.local` is ignored by git.
- No secret env file is staged or committed.
- No data migration or destructive operation occurred.
