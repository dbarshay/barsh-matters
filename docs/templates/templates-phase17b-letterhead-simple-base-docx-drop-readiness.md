# Templates Phase 17B — Letterhead Simple Base DOCX Drop-Readiness

## Scope

This phase is limited to the **letterhead simple** base layout asset.

It does not add production templates in bulk, wire generation, upload files, call Clio/storage, mutate matters, or mutate templates through app/API routes.

## Purpose

This phase prepares the local drop-readiness contract for the letterhead simple base DOCX asset before any generated document uses it.

The target base asset is:

- role: `letterhead`
- assetKey: `barsh-letterhead-standard`
- local drop path: `templates/docx/base/letterhead-simple.docx`

## Required merge codes

The letterhead simple base asset must have registry-backed merge codes for:

- `signer.name`
- `signer.email`
- `signer.extension`
- `signer.fax`
- `addressee.name`
- `letter.reLine`

## Safety constraints

- No generation wiring.
- No upload.
- No Clio/storage call.
- No matter/template mutation through app/API.
- One base layout asset only.
