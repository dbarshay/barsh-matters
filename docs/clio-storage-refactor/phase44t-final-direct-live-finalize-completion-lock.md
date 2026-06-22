# Phase 44T Final Direct Live Finalize Completion Lock

Date: Mon Jun 22 14:30:18 EDT 2026

## Final locked state

- Latest base commit before this lock: `1c11838494836fbeb47ec9884de080cc26715563`.
- Latest base tag before this lock: `clio-storage-refactor-phase44s-phase44r-idempotent-smoke-verifier-repair-20260622`.
- Production direct-live env flags are absent:
  - `BARSH_DIRECT_MATTER_CLIO_LIVE_FINALIZE_ENABLED`
  - `NEXT_PUBLIC_BARSH_DIRECT_MATTER_CLIO_LIVE_FINALIZE_ENABLED`
- Production direct-live kill switch is closed and returns HTTP `403` with `action: "direct-live-server-kill-switch"`.

## Completed proof chain

- Phase 44L/44M proved the production server kill switch marker and production closed convergence.
- Phase 44O repaired the direct-live predicate so the server kill switch does not depend on `useDirectFinalizePreview`.
- Phase 44Q proved open-state ordering reaches admin authorization and closed-state returns the kill-switch marker.
- Phase 44R proved the authenticated direct finalize path against test direct matter `1881278195` / `BRL_202600001`.
- Phase 44R authenticated finalize returned HTTP `200` with `ok: true` and resolved existing Clio folder `22062401000`.
- Phase 44R found existing Clio document id `22070801495` with version id `22151994365`, `fullyUploaded: true`.
- Phase 44R recorded finalization audit record id `105`.
- Phase 44S repaired the smoke/verifier so future reruns accept either one fresh upload or authenticated idempotent duplicate-skip success.

## Final production behavior

- Production UI direct live finalize control remains hidden unless `NEXT_PUBLIC_BARSH_DIRECT_MATTER_CLIO_LIVE_FINALIZE_ENABLED=1`.
- Production server direct live finalize remains blocked unless `BARSH_DIRECT_MATTER_CLIO_LIVE_FINALIZE_ENABLED=1`.
- Admin authorization is required after the server kill switch opens.
- Duplicate uploads remain disabled and exact-filename duplicate prevention was proven active.

## Activation runbook for later production UI enablement

1. Confirm the intended direct matter and file number are test-safe or production-approved.
2. Set production env flags to `1`:
   - `BARSH_DIRECT_MATTER_CLIO_LIVE_FINALIZE_ENABLED=1`
   - `NEXT_PUBLIC_BARSH_DIRECT_MATTER_CLIO_LIVE_FINALIZE_ENABLED=1`
3. Redeploy production.
4. Confirm the direct live UI control is visible only to an authenticated admin path.
5. Confirm unauthenticated direct live finalize returns `admin-proxy` after the server gate is open.
6. Run only one controlled finalize/upload action.
7. Immediately remove both production env flags and redeploy to re-close the server kill switch unless sustained production activation has been separately approved.
8. Prove closed state again with the `direct-live-server-kill-switch` marker.

## Rollback

- Remove `BARSH_DIRECT_MATTER_CLIO_LIVE_FINALIZE_ENABLED` and `NEXT_PUBLIC_BARSH_DIRECT_MATTER_CLIO_LIVE_FINALIZE_ENABLED` from production.
- Redeploy production.
- Confirm direct-live finalization returns HTTP `403` with `action: "direct-live-server-kill-switch"`.

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

## Security follow-up

- Earlier terminal output exposed local secrets in chat/log output. Rotate exposed local admin/session/database/Graph/Clio credentials after this lock is confirmed stable.
