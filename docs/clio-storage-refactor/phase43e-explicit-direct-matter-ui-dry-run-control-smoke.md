# Phase 43E — Explicit Direct Matter UI Dry-Run Control Smoke

Phase 43E adds an explicit guarded direct matter UI dry-run control path.

This phase still does not expose live direct upload behavior. The control is present as a gated render helper and is disabled by default through `directMatterSingleMasterDryRunControlEnabled = false`.

Safety contract:

- the visible control is guarded off by default;
- the control calls `handleDirectMatterSingleMasterDryRunControl`;
- the handler calls `runDirectMatterSingleMasterFinalizeDryRunFromUi`;
- the handler forces `confirmUpload: false`;
- the handler forces `singleMasterDryRun: true`;
- the handler forces `singleMasterResolveFolders: true`;
- the control path does not include `masterLawsuitId`;
- the control path does not call `/api/documents/working-docx`;
- the control path does not call any Clio upload helper directly;
- the smoke is static/no-server/no-upload.

This creates a concrete UI-originated dry-run control path that can later be attached to the appropriate direct document workflow after final user approval.
