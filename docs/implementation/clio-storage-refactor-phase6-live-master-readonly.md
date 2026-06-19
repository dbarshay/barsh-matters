# Clio Storage Refactor Phase 6 Read-Only Live Master Matter Verification

## Purpose

Phase 6 performs the first guarded read-only live Clio verification for the manually created single master matter.

## Master matter

- Name: `Barsh Matters Master Repository`
- ID: `1885821245`

## Live check scope

The Phase 6 verifier may perform GET-only Clio API requests to verify that the configured integration account can read the master matter.

## Safety boundary

- GET/read-only Clio calls only.
- No POST, PATCH, PUT, or DELETE calls.
- No Clio folders are created.
- No Clio documents are uploaded, moved, or deleted.
- Existing upload/list/open routes are not rewired.
- No database migrations are added.
- Existing BM matters remain test data and are not preserved or migrated.

## Acceptance criteria

- The Phase 6 verifier exists.
- The verifier is explicitly live-gated by `CLIO_PHASE6_LIVE=1`.
- The verifier confirms `CLIO_MASTER_MATTER_ID=1885821245`.
- The verifier confirms `CLIO_MASTER_MATTER_NAME=Barsh Matters Master Repository`.
- The verifier performs only read-only Clio requests.
- Phase 2, Phase 3, Phase 4, Phase 5, and Phase 6 verifiers pass.
