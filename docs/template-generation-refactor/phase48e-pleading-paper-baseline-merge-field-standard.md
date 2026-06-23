# Phase 48E — Pleading Paper Baseline Merge-Field Standard

## Status

Decision lock for baseline pleading-paper merge fields before field mapping and DOCX conversion.

This phase defines the baseline field vocabulary only. It does not map fields to final data sources.

## Source Layout

The `pleading-paper` layout asset remains a DOCX-based non-generation layout asset.

The pleading-paper layout must not appear in Generate Documents as a selectable normal template. Future pleading generation templates may declare:

- `layoutFamily: pleading_paper`
- `layoutAssetKey: pleading-paper`

## Baseline Field Groups

### Court / Caption Fields

- `{{courtName}}`
- `{{courtVenue}}`
- `{{courtAddressLine1}}`
- `{{courtAddressLine2}}`
- `{{courtCity}}`
- `{{courtState}}`
- `{{courtZip}}`
- `{{courtAddressCityStateZip}}`
- `{{plaintiffName}}`
- `{{defendantName}}`
- `{{captionPlaintiffLine}}`
- `{{captionDefendantLine}}`
- `{{indexNumber}}`

Source candidates:

- lawsuit court/venue fields
- court reference data
- ClaimIndex/lawsuit party fields
- adversary/debt-collector/insurer fields where applicable

### Pleading Identity Fields

- `{{pleadingTitle}}`
- `{{pleadingType}}`
- `{{matterNumber}}`
- `{{lawsuitNumber}}`
- `{{filingDate}}`
- `{{todayLong}}`

Source candidates:

- selected pleading template
- lawsuit number
- Barsh Matters matter/lawsuit identifiers
- computed generation date
- filing/court metadata where applicable

### Attorney / Signature Fields

- `{{signerName}}`
- `{{signerTitle}}`
- `{{signerEmail}}`
- `{{signerPhoneExtension}}`
- `{{signerFax}}`
- `{{firmName}}`
- `{{firmAddressLine1}}`
- `{{firmAddressLine2}}`
- `{{attorneyFor}}`

Source candidates:

- selected signer profile
- logged-in Barsh Matters user default signer
- firm settings
- pleading template context

### Backer / Certification / Admission Fields

- `{{backerTitle}}`
- `{{certificationText}}`
- `{{serviceAdmissionText}}`
- `{{attorneyForAdmission}}`
- `{{admissionDate}}`
- `{{admissionAttorneyName}}`

Source candidates:

- selected pleading template
- New York certification text standard
- user-selected pleading/backer options
- manual override fields where needed

## Legacy Placeholder Relationship

The imported `pleading.docx` currently contains legacy placeholders such as:

- `Matter.Client.Name`
- `Matter.CustomField.DebtCollector.Name`
- `Matter.CustomField.DocketNumber`
- `Matter.Number`
- `Matter.CustomField.Court.Address.City`
- `Matter.CustomField.Court.PrimaryHomeAddress.State`
- `Matter.CustomField.Court.PrimaryHomeAddress.Street`

Those legacy placeholders are inventory only. They must later be mapped to canonical `{{camelCase}}` fields only after Dave reviews any uncertain mapping.

## Comprehensive Merge-Field Scope

This pleading-paper baseline is part of the larger Barsh Matters merge-field catalog. The full catalog must include:

- all visible UI fields in Barsh Matters
- all non-viewable/internal DB fields in tables already created
- hidden/internal workflow fields needed for document generation, reporting, audit, and workflow logic
- layout-level fields for letterhead and pleading paper
- signer fields
- addressee source fields
- Re fields
- template-specific fields from uploaded DOCX placeholders

## Mapping Policy

Ask Dave before mapping any ambiguous field, duplicate source, legacy placeholder, hidden/internal field, signer field, addressee source, or pleading/backer field.

## Non-Goals

This phase does not perform field mapping, does not modify the `pleading-paper` DOCX, does not create a generated pleading, does not create a Graph/OneDrive working document, does not upload to Clio, does not finalize a document, does not change the print queue, and does not write database template records.

## Next Recommended Phase

Phase 48F should inspect signer/addressee/court/reference data sources and propose source resolution rules for signer, addressee, court, caption, and Re fields before mapping any template.
