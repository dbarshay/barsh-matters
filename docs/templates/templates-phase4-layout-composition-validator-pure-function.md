# Templates Phase 4 — Pure Layout Composition Validator

## Status

Implementation lock for a pure validator function and fixture-backed verifier.

This phase intentionally remains isolated. It is not wired into production generation, document assembly, UI flows, DOCX handling, PDF conversion, upload, or external document-storage interaction. This is a no external document-storage interaction guardrail.

## Scope

Phase 4 implements the first validator slice described by Templates Phase 3:

- canonical layout role validation;
- rejected alias detection;
- shape validation for `none`, `single`, and `composed` modes;
- registry lookup for selected layout assets;
- inactive asset blocking except archived validation mode;
- role/asset mismatch blocking;
- duplicate role and duplicate asset key blocking;
- composition allow-list validation;
- deterministic output-order normalization;
- dependency validation against declared merge-field definitions.

## Source file

The pure validator lives at:

`src/lib/templates/layout-composition-validator.mjs`

It exports:

- `CANONICAL_LAYOUT_ROLES`
- `REJECTED_LAYOUT_ROLE_ALIASES`
- `DEFAULT_LAYOUT_OUTPUT_ORDER`
- `validateTemplateLayoutComposition`

## Fixture file

The behavior fixture lives at:

`test/fixtures/templates/layout-composition-validator-fixtures.json`

The fixture covers:

- a valid three-asset composition;
- rejected `simpleCoverPage` alias usage;
- inactive, unresolved, and duplicate asset problems;
- missing pleading dependency detection.

## Verifier

The focused verifier lives at:

`scripts/verify-templates-phase4-layout-composition-validator-pure-function.mjs`

It checks both static guardrails and executable fixture behavior.

## Guardrails

This phase does not:

- import the validator into runtime document generation;
- alter template selection UI;
- alter document-generation dialogs;
- inspect or mutate DOCX files;
- produce PDFs;
- upload files;
- call external document-storage services;
- change existing production routes.

A later wiring phase may use this validator after the pure function behavior is independently locked.
