# Phase 45G Intentional Second Generation Filename Proof

Date: Mon Jun 22 15:15:16 EDT 2026

## Scope

- Production direct/individual finalize was tested using a non-original generation label.
- Test direct matter: `1881278195` / `BRL_202600001`.
- Generation label: `Revised`.
- Expected folder id: `22062401000`.

## Required behavior

- Duplicate prevention remains enabled.
- The intentional second generation must not be treated as a duplicate of the Original file.
- The finalized PDF filename must start with `BRL_202600001 - `.
- The finalized PDF filename must include `- Revised - Generated <timestamp>`.
- Exactly one new PDF must upload to the existing direct folder.
- Finalization audit metadata must be recorded.

## Safety

- Admin authorization remains required.
- Upload target parent type remains `Folder`.
- No duplicate direct folder branch may be reported.
- No OneDrive or SharePoint folders are created.
