# Clio Storage Refactor Phase 6 Read-Only Live Master Matter Verification

## Purpose

Phase 6 performs the first guarded read-only live Clio verification for the manually created single master matter.

## Master matter

- Name: `Barsh Matters Master Repository`
- ID: `1885821245`

## Live check scope

The Phase 6 verifier may perform GET-only Clio data API requests to verify that the configured integration account can read the master matter.

If the configured access token is expired, the verifier may perform an OAuth token refresh using the configured refresh token. The refreshed token is used in memory only and is not written back to disk.

## Safety boundary

- Clio data API requests are GET/read-only only.
- OAuth token refresh is allowed only to recover from an expired access token.
- No Clio folders are created.
- No Clio documents are uploaded, moved, or deleted.
- No Clio matters are created, edited, or deleted.
- Existing upload/list/open routes are not rewired.
- No database migrations are added.
- Existing BM matters remain test data and are not preserved or migrated.

## Acceptance criteria

- The Phase 6 verifier exists.
- The verifier is explicitly live-gated by `CLIO_PHASE6_LIVE=1`.
- The verifier confirms `CLIO_MASTER_MATTER_ID=1885821245`.
- The verifier confirms `CLIO_MASTER_MATTER_NAME=Barsh Matters Master Repository`.
- The verifier performs only read-only Clio data API requests.
- If needed, OAuth refresh is memory-only and does not stage or write secrets.
- Phase 2, Phase 3, Phase 4, Phase 5, and Phase 6 verifiers pass.
