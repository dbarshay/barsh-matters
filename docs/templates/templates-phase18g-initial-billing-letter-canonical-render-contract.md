# Templates Phase 18G — Initial Billing Letter Canonical Render Contract

## Scope

This phase proves local render-readiness for the committed Initial Billing Letter DOCX after Phase 18F canonical-token migration.

The phase remains local-only. It does not wire production document generation, does not mutate matters through app/API routes, and does not upload anything to Clio or storage.

## Source DOCX

`templates/docx/letters/initial-billing-letter.docx`

## Test matter

`BRL_202600003`

## Contract

The verifier confirms:

1. The source DOCX contains all required canonical `{{...}}` tokens for the Initial Billing Letter.
2. The source DOCX contains no visible legacy `<<...>>` tokens.
3. A local transformed DOCX can be generated under ignored local output.
4. The transformed output contains the exact expected resolved values for `BRL_202600003`.
5. The transformed output contains no remaining canonical `{{...}}` tokens.
6. The transformed output contains no legacy `<<...>>` tokens.

## Local output

Generated proof output is written under:

`.tmp-phase18g-output/`

That directory is intentionally local proof output and is not committed.

## Locked behavior

Canonical merge tokens are the committed-template target. Legacy-token compatibility is not part of this contract.
