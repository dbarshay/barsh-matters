# Templates Phase 17C — Letterhead Simple Base DOCX Import Gate

## Scope

This phase is limited to the **letterhead simple** base layout asset.

It does not create, import, upload, or generate a DOCX file. It creates only the local drop contract and verifier for one base asset.

## Approved local drop path

`templates/docx/base/letterhead-simple.docx`

## Gate behavior

- If the DOCX is absent, the verifier reports the base asset as pending and passes.
- If the DOCX is present, the verifier opens the DOCX as a zip container, reads Word XML text, and requires the expected merge-code tokens.
- The gate does not wire generation.
- The gate does not call Clio/storage.
- The gate does not mutate app/API routes, matters, or templates.

## Required merge-code tokens when the DOCX is present

- `signer.email`
- `signer.extension`
- `addressee.name`
- `letter.reLine`

## Forbidden stale token

- `re.line`
