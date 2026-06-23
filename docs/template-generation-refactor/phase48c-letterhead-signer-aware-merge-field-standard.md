# Phase 48C — Letterhead Signer-Aware, Addressee Source, and Re Merge-Field Standard

## Status

Decision lock for letterhead merge-field behavior before field mapping and template conversion.

## Source Layout

The `letterhead-simple` layout asset remains a DOCX-based non-generation layout asset.

The BRL logo and firm address block are in the DOCX header. The logo should always be present and should not be user-selectable.

## Signer Rule

Letterhead documents are signer-aware.

- The signer defaults to the logged-in Barsh Matters user generating the document.
- Other users must be selectable from the document generation dialog.
- Signer-specific contact fields come from the selected signer profile.

## Dynamic Header / Contact Fields

The firm address remains a header-based layout element.

Dynamic signer-specific header/contact fields:

- `{{signerPhoneExtension}}`
- `{{signerFax}}`
- `{{signerEmail}}`

Recommended shared signer/letterhead fields:

- `{{todayLong}}`
- `{{signerName}}`
- `{{signerTitle}}`
- `{{signerPhoneExtension}}`
- `{{signerFax}}`
- `{{signerEmail}}`
- `{{firmAddressLine1}}`
- `{{firmAddressLine2}}`

## Addressee Source Rule

Letter templates must support mergeable addressee fields and must not assume a single addressee source.

The addressee may come from:

- `adversary_attorney`
- `insurer`
- `court`
- `settled_with_contact`
- `manual`

The default addressee source should be inferred from the selected template/workflow, but the document generation dialog must allow the user to select or override the addressee source.

Recommended addressee fields:

- `{{addresseeSourceType}}`
- `{{addresseeRole}}`
- `{{addresseeName}}`
- `{{addresseeCompany}}`
- `{{addresseeAttentionLine}}`
- `{{addresseeAddressLine1}}`
- `{{addresseeAddressLine2}}`
- `{{addresseeAddressLine3}}`
- `{{addresseeEmail}}`
- `{{addresseeFax}}`

Source-specific behavior:

- `adversary_attorney`: resolve from lawsuit adversary attorney data.
- `insurer`: resolve from insurer/contact data.
- `court`: resolve from court/venue data.
- `settled_with_contact`: resolve from settlement contact or settled-with contact.
- `manual`: user enters the addressee fields.

## Re Line Fields

Letter templates must support a mergeable `Re:` section.

Recommended Re fields:

- `{{reLine1}}`
- `{{reLine2}}`
- `{{reMatterNumber}}`
- `{{rePatientName}}`
- `{{reProviderName}}`
- `{{reInsurerName}}`
- `{{reClaimNumber}}`
- `{{reIndexNumber}}`
- `{{reDateOfLoss}}`

The exact displayed Re line can vary by template, but it must be mergeable rather than static-only.

## Date and Closing Alignment

The date is dynamic and tabbed once to the right.

The closing is:

`Very truly yours,`

The closing uses the same tabbed alignment as the date. The signer name appears under blank signature space.

## Body Formatting

Letter template body text must use:

- Times New Roman
- 12 pt

## Non-Goals

This phase does not convert the DOCX, replace placeholders, generate a working document, create a Graph/OneDrive file, upload to Clio, finalize a document, alter print queue records, or map fields into final templates.

## Later Required Work

A later phase must create or extend the signer profile source so each selectable signer has:

- name
- title
- phone extension
- fax number
- email address

A later phase must update the Generate Documents dialog so the selected signer defaults to the current user but can be changed.

A later phase must update the Generate Documents dialog so addressee source defaults from the selected template/workflow but can be changed.

A later phase must build the comprehensive Barsh Matters merge-field catalog covering visible UI fields, non-viewable/internal DB fields, layout fields, signer fields, addressee source fields, Re fields, and template-specific fields.
