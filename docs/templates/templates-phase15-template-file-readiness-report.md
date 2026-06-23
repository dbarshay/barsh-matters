# Templates Phase 15 — Template File Readiness Report Builder

## Scope

Phase 15 adds a pure template-file readiness report builder. It converts registry template-file metadata into a summary object that can be reused by later admin-readiness or production-readiness surfaces.

## Boundary

The builder is pure. It accepts a caller-supplied `physicalFileExists` function and does not itself read from storage, write files, create DOCX files, generate documents, upload documents, finalize documents, or mutate matters.

## Report fields

The report summarizes:

- template count;
- available file count;
- missing file count;
- required missing file count;
- unapproved path count;
- generation-readiness boolean;
- per-template readiness records;
- missing paths;
- required missing paths;
- unapproved paths.

## Current expected state

Because real DOCX files have not yet been added, the current filesystem-readiness state remains `existing=0` and `missing=4`. Phase 15 preserves that as report data only. Generation remains unwired.

## Terminology

Use “simple cover/fax page.” Letterhead, pleading paper, and simple cover/fax page remain composable non-generation layout assets.
