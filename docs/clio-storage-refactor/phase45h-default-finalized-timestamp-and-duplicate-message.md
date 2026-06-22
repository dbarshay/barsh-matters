# Phase 45H Default Finalized Timestamp and Duplicate Message

Date: Mon Jun 22 15:25:27 EDT 2026

## Scope

- Every finalized PDF filename now receives a finalization timestamp suffix by default.
- Direct/individual filenames still start with `BRL_YYYYNNNNN`.
- Lawsuit/master filenames still start with `YYYY.MM.NNNNN`.
- Non-original labels such as `Revised`, `Corrected`, `Supplemental`, or `Amended` remain supported.

## Filename behavior

- Original/default finalization:
  - `BRL_202600001 - ... - Document Label - Finalized 2026-06-22T19-15-13Z.pdf`
- Non-original finalization:
  - `BRL_202600001 - ... - Document Label - Revised - Finalized 2026-06-22T19-15-13Z.pdf`

## Duplicate behavior

- Duplicate prevention remains enabled.
- A true duplicate means the exact finalized filename already exists in the resolved Clio target folder.
- When a true duplicate is skipped, the exact user-facing message is:
  - `This Document has Previously Been Uploaded. It Will Not Be Uploaded Again`
- False duplicate risk is reduced because normal finalizations now get unique timestamped filenames.

## Safety

- No production env variables were changed.
- No deployment was performed.
- No Clio upload was performed.
- The direct live finalize kill switch/admin gate verifier passed.
