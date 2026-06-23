# Templates Phase 17A — Letterhead Simple Base Merge-Code Readiness

## Scope

This phase is limited to the **letterhead simple** base layout asset.

It does not add production DOCX templates in bulk, wire document generation, upload files, call Clio/storage, mutate matters, or mutate templates through app/API routes.

## Purpose

Before wiring any letter-style generated document, the base letterhead asset must expose the merge-code categories that later letter templates will depend on.

The target is not document generation. The target is readiness validation for the base document metadata and expected merge-field surface.

## Required merge-code categories for letterhead simple

The letterhead simple base asset must support:

- signer identity fields;
- signer extension/fax/email fields;
- firm/letterhead contact fields as applicable;
- addressee fields;
- mergeable Re: fields;
- matter/case reference fields needed by Re: lines;
- template-file metadata sufficient to report file availability without generating documents.

## Safety constraints

- One base asset only.
- No bulk DOCX import.
- No generation wiring.
- No Clio/storage calls.
- No matter/template mutation through app/API.
- Existing template suite must continue to pass.
