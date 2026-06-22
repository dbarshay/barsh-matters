# Phase 44Q Direct Live Open Admin-Gate and Closed Kill-Switch Proof

Date: Mon Jun 22 13:59:27 EDT 2026

## Scope

- No live upload was attempted.
- No document payload or working document id was sent.
- Proof target: direct matter `1881278195`, file number `BRL_202600001`.

## Open-state proof from production

- Production direct-live env flags were temporarily set to `1` and production was redeployed.
- Request used `uploadTargetMode: "direct-matter"`, `confirmUpload: true`, and `singleMasterDryRun: false`.
- Observed response: HTTP `403` with `action: "admin-proxy"` and `authorized: false`.
- Interpretation: the server direct-live kill switch was open, and the request advanced to the required admin authorization gate.
- This proves the intended order: server kill switch first, then admin authorization, then preview/document handling.
- No Clio upload occurred.

## Closed-state proof from production

- Both production direct-live env flags were removed again and production was redeployed.
- Closed proof returned HTTP `403` with `action: "direct-live-server-kill-switch"` and `serverLiveFinalizeEnabled: false`.

## Final production state

- Production direct-live env flags absent:
  - `BARSH_DIRECT_MATTER_CLIO_LIVE_FINALIZE_ENABLED`
  - `NEXT_PUBLIC_BARSH_DIRECT_MATTER_CLIO_LIVE_FINALIZE_ENABLED`
- Production direct-live kill switch closed.

## Preserved invariants

- Clio is storage only.
- Barsh Matters owns and assigns file numbers and lawsuit numbers.
- Direct/individual matters use `BRL_YYYYNNNNN`.
- Lawsuits use `YYYY.MM.NNNNN`.
- Direct documents remain in Individual Matters and are not automatically moved if later aggregated into a lawsuit.
- No patient/provider/insurer/claim/denial facts belong in Clio folder names.
- Direct payload remains separate from master/lawsuit payload and must not include `masterLawsuitId`.
- Duplicate uploads remain disabled.
