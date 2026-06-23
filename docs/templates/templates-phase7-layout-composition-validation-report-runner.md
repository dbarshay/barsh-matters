# Templates Phase 7 — Layout Composition Validation Report Runner

## Status

Implementation lock for an isolated file-input validation report runner.

This phase is intentionally isolated. It is not wired into production generation, document assembly, UI flows, DOCX handling, PDF conversion, upload, or external document-storage interaction.

## Scope

Phase 7 adds a developer/admin utility that reads a JSON validation input file and renders the Phase 6 report builder output.

The runner supports:

- `--input <path>`;
- `--format markdown`;
- `--format json`;
- optional `--output <path>`; and
- deterministic exit codes.

Exit-code rules:

- `0` when the report passes;
- `1` when validation completes but the report fails;
- `2` when CLI arguments are invalid.

## Source file

The runner lives at:

`scripts/run-template-layout-composition-validation-report.mjs`

It uses the Phase 6 report builder and does not reimplement validation logic.

## Fixture file

The behavior fixture lives at:

`test/fixtures/templates/layout-composition-validation-report-runner-fixtures.json`

The fixture verifies both Markdown and JSON output modes against the locked Phase 5 batch fixture.

## Verifier

The focused verifier lives at:

`scripts/verify-templates-phase7-layout-composition-validation-report-runner.mjs`

It checks static guardrails, CLI argument handling, Markdown output, JSON output, and deterministic failure exit behavior.

## Guardrails

This phase does not:

- import the runner into runtime document generation;
- alter template selection UI;
- alter document-generation dialogs;
- inspect or mutate DOCX files;
- produce PDFs;
- upload files;
- call external document-storage services;
- change existing production routes.

A later admin-readiness phase may decide whether to expose the report output in an internal admin page.
