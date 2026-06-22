# Production Single-Master Live Proof Artifact Ledger

Last updated: 2026-06-22T21:38:00Z

## Cleanup decision

Do not delete production smoke/live proof artifacts yet. These artifacts are currently retained as audit evidence until the Clio single-master storage refactor is fully accepted and the UI manual workflow proof is completed on a later day.

## Locked architecture

- Barsh Matters owns file numbers, lawsuit numbers, aggregation, metadata, and workflow state.
- Clio is storage only.
- Clio master repository matter: `Barsh Matters Master Repository`
- Clio master matter ID: `1885821245`
- Root/container folder ID: `22053807035`

## Master/lawsuit live proof artifacts

### Prior terminal proof

- Master lawsuit: `2026.06.00015`
- Resolved path: `Lawsuits / 2026-06 / 2026.06.00015`
- Clio folder ID: `22077085715`
- Final PDF Clio document ID: `22077633350`
- Finalization record ID: `113`
- Result: `uploadRewired=true`, `fullyUploaded=true`

### Reusable gated script proof

- Master lawsuit: `2026.06.00015`
- Resolved path: `Lawsuits / 2026-06 / 2026.06.00015`
- Clio folder ID: `22077085715`
- Final PDF Clio document ID: `22077654860`
- Finalization record ID: `114`
- Result: `uploadRewired=true`, `fullyUploaded=true`

## Direct/individual live proof artifacts

### Prior direct proof

- Direct matter: `BRL_202600003`
- Resolved path: `Individual Matters / BRL-202600001-BRL-202600999 / BRL_202600003`
- Clio folder ID: `22077086525`
- Final PDF Clio document ID: `22077166835`
- Finalization record ID: `112`
- Result: `uploadRewired=true`, `fullyUploaded=true`

### Reusable gated direct script proof

- Direct matter: `BRL_202600003`
- Selected document key: `harmless-stored-docx-test-template`
- Clio folder ID: `22077086525`
- Working DOCX drive item ID: `01YOF3GE7OCYYZ4R6BWZEZ3JWUYHU5RYGL`
- Final PDF Clio document ID: `22077706940`
- Finalization record ID: `115`
- Final PDF filename: `BRL_202600003 - ATLANTIC MEDICAL - DIAGNOSTIC, P.C. aao David Barshay v Allstate Indemnity Company - Claim 1111 - Example Production Template - Finalized 2026-06-22T21-37-49Z.pdf`
- Result: `uploadRewired=true`, `fullyUploaded=true`

## Reusable proof commands

- `npm run verify:single-master-production-readiness-suite`
- `CONFIRM_LIVE_TERMINAL_FINALIZE=YES npm run smoke:production-live-master-finalize-single-master-gated`
- `CONFIRM_LIVE_TERMINAL_FINALIZE=YES npm run smoke:production-live-direct-finalize-single-master-gated`

## Deferred UI proof

Manual UI workflow proof is deferred:

- Generate Documents
- Edit Document
- Finalize Document
- Delivery
