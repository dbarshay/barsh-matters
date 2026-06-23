# Templates Phase 18I — Initial Billing Letter Manual Word Canonical Token Reinsertion

## Scope

This phase locks the manually edited Microsoft Word DOCX after Phase 18H restored a Word-openable baseline.

The template remains local/template-only. This phase does not wire production document generation, does not call app/API generation, does not upload to Clio, and does not write to storage.

## Source DOCX

`templates/docx/letters/initial-billing-letter.docx`

## Manual Word edit

The canonical tokens were inserted manually in Microsoft Word to avoid corrupting the DOCX package through raw ZIP/XML rewriting.

## Verification rule

The verifier checks visible Word text by concatenating Word text nodes, rather than requiring each token to appear contiguously in raw XML. This is necessary because Word may split a visible token across multiple internal runs while still displaying the correct token in the document.

## Required visible canonical tokens

- `{{letter.date}}`
- `{{insurer.name}}`
- `{{insurer.mailingAddress.line1}}`
- `{{insurer.mailingAddress.city}}`
- `{{insurer.mailingAddress.state}}`
- `{{insurer.mailingAddress.zip}}`
- `{{provider.name}}`
- `{{patient.name}}`
- `{{claim.number}}`
- `{{claim.amount}}`
- `{{claim.dosRange}}`
- `{{matter.fileNumber}}`

## Locked non-goals

Generation remains unwired. Clio and storage calls remain prohibited.
