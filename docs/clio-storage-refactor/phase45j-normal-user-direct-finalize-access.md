# Phase 45J Normal User Direct Finalize Access

Date: Mon Jun 22 15:34:57 EDT 2026

## Scope

- Direct/individual live Clio finalize is no longer limited to the separate administrator password gate.
- The server kill switch remains required: `BARSH_DIRECT_MATTER_CLIO_LIVE_FINALIZE_ENABLED=1`.
- Production UI visibility remains controlled by `NEXT_PUBLIC_BARSH_DIRECT_MATTER_CLIO_LIVE_FINALIZE_ENABLED=1`.
- Normal Barsh Matters app/user access controls are expected to govern who can use the workflow.

## Preserved safety

- Duplicate prevention remains enabled.
- Default finalized timestamp filenames remain enabled.
- Exact duplicate skip message remains:
  - `This Document has Previously Been Uploaded. It Will Not Be Uploaded Again`
- Storage-identity filename conventions remain:
  - Direct: `BRL_YYYYNNNNN`
  - Lawsuit: `YYYY.MM.NNNNN`

## Verifier update

- The old Phase 44O verifier expected a direct-live admin-only gate.
- Phase 45J intentionally replaces that route-level admin-only gate with normal app/user access expectations while preserving the server kill switch.
- The verifier no longer uses the request-parsing occurrence of `workingDocumentDriveItemId` as a route-order proxy.
