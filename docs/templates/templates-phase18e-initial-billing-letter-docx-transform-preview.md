# Templates Phase 18E — Initial Billing Letter DOCX Transform Preview

## Scope

This phase creates a local-only transformed DOCX preview for the committed Initial Billing Letter template using the test individual matter `BRL_202600003`.

## Source DOCX

`templates/docx/letters/initial-billing-letter.docx`

## Local-only output

The transformed proof DOCX is written under `.tmp-phase18e-output/`. Generated output is ignored and must not be committed.

## Verification contract

The verifier replaces the legacy chevron tokens with the locked Phase 18C values for `BRL_202600003`, then inspects normalized visible Word text from the transformed DOCX.

Because Word XML escapes literal chevrons, the transform verifier handles both literal token text and XML-escaped token text such as `&lt;&lt;TOKEN&gt;&gt;`.

The verifier confirms:

- no visible legacy `<<...>>` tokens remain;
- expected values corresponding to visible source DOCX tokens are present;
- the transformed DOCX remains local-only.

## Committed DOCX observation

The committed Initial Billing Letter DOCX currently contains visible tokens for insurer city, state, and ZIP, but does not contain visible tokens for insurer name or insurer street address. Phase 18E does not mutate the DOCX. The verifier records those absent values as a source-template content gap while still proving that the actual committed DOCX can be transformed locally without leaving legacy visible chevron tokens.

## Non-goals

This phase does not wire app/API generation, does not upload to Clio/storage, and does not mutate matters or production templates.
