# Templates Phase 14 — Template File Readiness Inventory

## Scope

Phase 14 adds a readiness-only inventory for the physical DOCX template files referenced by the real template registry. It does not create fake DOCX files, wire generation, upload documents, finalize documents, mutate matters, or call external document-storage services.

## Contract

The registry remains the source of truth for template metadata. Every template record must keep a `templateFile` contract with:

- `kind`;
- `path`;
- `required`;
- approved in-repo path prefix.

Phase 14 separately reports whether the physical DOCX file currently exists at that path. Physical file presence is readiness information only in this phase. Missing files are expected until real production DOCX templates are intentionally added.

## Initial readiness state

The current registry references four DOCX template paths under `templates/docx/`. Phase 14 expects those files to be missing at this point because production DOCX files have not yet been added. This preserves the boundary between metadata validation and document generation.

## Safety boundary

This phase is limited to local registry inspection, fixtures, documentation, and verification. It must not add placeholder DOCX files or call any generation, upload, finalization, matter mutation, or external storage code.

## Terminology

Use “simple cover/fax page.” Letterhead, pleading paper, and simple cover/fax page remain composable non-generation layout assets.
