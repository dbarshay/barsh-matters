# Phase 44L — Direct Live Server Kill-Switch Response Marker

## Purpose

Phase 44L gives the server-side direct-matter live finalize kill switch a distinct `403` JSON response marker.

Before Phase 44L, the closed server kill switch reused `adminUnauthorizedJson(403)`, which made it difficult to distinguish a valid-admin request blocked by the server kill switch from a request rejected by the admin authorization guard.

## Contract

For a direct-matter live finalize request where:

- `isDirectMatterLiveFinalizeRequest` is true;
- `BARSH_DIRECT_MATTER_CLIO_LIVE_FINALIZE_ENABLED` is not `1`;

the route returns status `403` with:

- `ok: false`
- `action: "direct-live-server-kill-switch"`
- `authorized: true`
- `serverLiveFinalizeEnabled: false`

The existing Phase 44C admin authorization guard remains required after the server kill switch. This phase does not enable the UI, does not set env values, and does not upload a document.

## Safety

Phase 44L does not set any environment variable.

Phase 44L does not expose a live UI button.

Phase 44L does not run a live smoke.

Phase 44L does not upload a document.

The direct/individual matter payload remains separate from lawsuit/master document finalize payloads and must not include `masterLawsuitId`.
