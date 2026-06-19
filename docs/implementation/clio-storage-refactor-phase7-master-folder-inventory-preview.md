# Clio Storage Refactor Phase 7 Read-Only Master Folder Inventory Preview

## Purpose

Phase 7 performs a guarded read-only inventory preview of documents/folders currently visible under the manually created Clio master matter.

## Master matter

- Name: `Barsh Matters Master Repository`
- ID: `1885821245`

## Live check scope

The Phase 7 verifier may perform GET-only Clio data API requests to inspect the configured master matter and list currently visible document/folder metadata.

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

- The Phase 7 verifier exists.
- The verifier is explicitly live-gated by `CLIO_PHASE7_LIVE=1`.
- The verifier confirms `CLIO_MASTER_MATTER_ID=1885821245`.
- The verifier performs only read-only Clio data API requests.
- The verifier prints a bounded, non-secret inventory summary.
- Phase 2 through Phase 7 verifiers pass.
