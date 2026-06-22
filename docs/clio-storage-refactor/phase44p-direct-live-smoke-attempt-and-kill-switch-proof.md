# Phase 44P Direct Live Smoke Attempt and Kill-Switch Proof

Date: Mon Jun 22 13:54:12 EDT 2026

## Locked state

- Base safety lock: Phase 44L/44M.
- Phase 44O commit: `3246da4af65388d9042cd07a243429eae37fa74d`.
- Phase 44O tag: `clio-storage-refactor-phase44o-direct-live-kill-switch-condition-20260622`.

## User-approved live-smoke attempt

- User selected option C: set production direct-live flags and attempt one controlled live direct finalize upload smoke to test direct matter `1881278195` / `BRL_202600001`.
- Target existing Clio folder: `22062401000`.
- Controlled smoke script: `smoke:phase42b-controlled-live-direct-finalized-pdf-upload`.
- The controlled smoke did not upload to Clio. The finalize response reported `uploaded: []` / uploaded count `0` during failed attempts.
- One Graph working DOCX was created during the smoke attempts, but Clio upload did not occur.

## Repair outcome

- Phase 44O repaired the direct-live kill-switch predicate so it does not depend on `useDirectFinalizePreview`.
- Direct live finalize is now classified by `uploadTargetMode === "direct-matter"`, `confirmUpload === true`, and `singleMasterDryRun !== true`.
- Server direct-live kill switch remains before admin authorization, preview/document handling, and the working-document requirement.

## Final production state

- Production direct-live env flags are absent:
  - `BARSH_DIRECT_MATTER_CLIO_LIVE_FINALIZE_ENABLED`
  - `NEXT_PUBLIC_BARSH_DIRECT_MATTER_CLIO_LIVE_FINALIZE_ENABLED`
- Production was redeployed from the locked Phase 44O commit.
- Closed-state proof returned HTTP `403` with `action: "direct-live-server-kill-switch"` and `serverLiveFinalizeEnabled: false`.
- The proof request intentionally had no document payload and performed no upload.

## Preserved invariants

- Clio is storage only.
- Barsh Matters owns and assigns file numbers and lawsuit numbers.
- Direct/individual matters use `BRL_YYYYNNNNN`.
- Lawsuits use `YYYY.MM.NNNNN`.
- Direct documents remain in Individual Matters and are not automatically moved if later aggregated into a lawsuit.
- No patient/provider/insurer/claim/denial facts belong in Clio folder names.
- Lawsuit/master document flow remains separate using `masterLawsuitId` and `uploadTargetMode: "master-lawsuit"`.
- Direct payload remains separate from master/lawsuit payload and must not include `masterLawsuitId`.
- Duplicate uploads remain disabled.
