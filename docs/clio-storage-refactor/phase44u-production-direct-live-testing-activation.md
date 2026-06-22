# Phase 44U Production Direct-Live Testing Activation

Date: Mon Jun 22 14:37:30 EDT 2026

## Activation

- Production direct/individual live finalize testing is enabled.
- Production env flags set to `1`:
  - `BARSH_DIRECT_MATTER_CLIO_LIVE_FINALIZE_ENABLED`
  - `NEXT_PUBLIC_BARSH_DIRECT_MATTER_CLIO_LIVE_FINALIZE_ENABLED`
- Production was redeployed after env activation.
- Local production-ready validation completed before deployment: `npx tsc --noEmit` and `npm run build`.

## No-upload safety proof

- A no-document production request used `uploadTargetMode: "direct-matter"`, `confirmUpload: true`, and `singleMasterDryRun: false`.
- The request did not return `direct-live-server-kill-switch`, proving the server gate is open.
- The request returned `admin-proxy` / `authorized: false`, proving admin authorization remains required before upload-capable handling.
- No upload was performed by this proof.

## Current production posture

- Direct live finalize is enabled for testing.
- UI control should be visible because `NEXT_PUBLIC_BARSH_DIRECT_MATTER_CLIO_LIVE_FINALIZE_ENABLED=1` is set.
- Server live finalize is open because `BARSH_DIRECT_MATTER_CLIO_LIVE_FINALIZE_ENABLED=1` is set.
- Admin authorization remains required.
- Duplicate upload prevention remains active.

## Rollback

- Remove both production env flags:
  - `BARSH_DIRECT_MATTER_CLIO_LIVE_FINALIZE_ENABLED`
  - `NEXT_PUBLIC_BARSH_DIRECT_MATTER_CLIO_LIVE_FINALIZE_ENABLED`
- Redeploy production.
- Confirm `/api/documents/finalize` returns HTTP `403` with `action: "direct-live-server-kill-switch"` for direct live finalize requests.

## Preserved invariants

- Clio is storage only.
- Barsh Matters owns and assigns file numbers and lawsuit numbers.
- Direct/individual matters use `BRL_YYYYNNNNN`.
- Lawsuits use `YYYY.MM.NNNNN`.
- Direct documents remain in Individual Matters and are not automatically moved if later aggregated into a lawsuit.
- Direct payload remains separate from master/lawsuit payload and must not include `masterLawsuitId`.
- Duplicate uploads remain disabled.
