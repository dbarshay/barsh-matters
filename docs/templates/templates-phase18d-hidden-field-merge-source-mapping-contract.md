# Templates Phase 18D - Hidden Field Merge-Source Mapping Contract

## Scope

This phase formalizes the rule that hidden/import fields from relevant source tables are valid template merge sources.

This is a contract/readiness phase only.

## Non-goals

- No document generation wiring.
- No Clio calls.
- No storage calls.
- No database mutation.
- No template import.
- No broad document-template rollout.

## Core rule

All hidden fields from all relevant data-source tables must be discoverable and mappable as template merge sources.

Hidden fields are not excluded from template resolution merely because they are stored under JSON import payloads or hidden UI columns.

## Canonical path syntax

Hidden field paths use table-column-JSON-path provenance:

```text
Table.column.path.to.field
```

Example:

```text
ReferenceEntity.details._hiddenImportFields.hidden_street
```

## Initial Billing Letter continuity

Phase 18C proved that `BRL_202600003` resolves `insurer.mailingAddress` for Allstate Indemnity Company from:

- `ReferenceEntity.details._hiddenImportFields.hidden_street`
- `ReferenceEntity.details._hiddenImportFields.hidden_city`
- `ReferenceEntity.details._hiddenImportFields.hidden_state`
- `ReferenceEntity.details._hiddenImportFields.hidden_zipcode`

The composed value is:

```text
3100 Sanders Road, Suite 201
Northbrook, Illinois 60062
```

## Required readiness behavior

- Hidden/import JSON fields must be discoverable.
- Hidden/import JSON fields must preserve source-path provenance.
- Hidden/import JSON fields must be selectable or referenceable by merge-field mapping.
- Composite merge codes may be built from multiple hidden source paths.
- Required hidden fields must fail readiness if missing.
- Dry-run/template verification must remain read-only.

## Known source family

`ReferenceEntity.details._hiddenImportFields` currently contains insurer-company hidden import fields such as street, city, state, zipcode, website, domicile, group name, and NAIC number.


## Known hidden insurer-company fields

The current known insurer-company hidden field paths include:

- `ReferenceEntity.details._hiddenImportFields.hidden_street`
- `ReferenceEntity.details._hiddenImportFields.hidden_city`
- `ReferenceEntity.details._hiddenImportFields.hidden_state`
- `ReferenceEntity.details._hiddenImportFields.hidden_zipcode`
- `ReferenceEntity.details._hiddenImportFields.hidden_website`
- `ReferenceEntity.details._hiddenImportFields.hidden_domicile`
- `ReferenceEntity.details._hiddenImportFields.hidden_group_name`
- `ReferenceEntity.details._hiddenImportFields.hidden_naic_number`

