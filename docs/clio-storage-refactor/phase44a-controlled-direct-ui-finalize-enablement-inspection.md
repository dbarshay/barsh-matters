# Phase 44A — Controlled Direct UI Finalize Enablement Inspection

Phase 44A is the first controlled enablement phase after Phase 43M.

This phase is intentionally conservative. It does not turn on live upload and does not call Clio. It inspects the current UI/auth surface and locks the exact requirements for a safe owner/admin-only direct UI finalize enablement.

Controlled enablement requirements:

- direct UI finalize must remain disabled unless an explicit environment flag is set;
- live upload must remain disabled unless `confirmUpload: true` is explicitly supplied by a future owner/admin-only control;
- direct UI dry-run prerequisites remain required:
  - `selectedDocumentKey`;
  - `workingDocumentDriveItemId`;
  - `workingDocumentKey`;
- duplicate prevention remains required through `allowDuplicateUploads: false`;
- direct flow must use `uploadTargetMode: "direct-matter"`;
- direct flow must use `directMatterId` and `directMatterDisplayNumber`;
- direct flow must not include `masterLawsuitId`;
- lawsuit/master flow remains separate and uses `uploadTargetMode: "master-lawsuit"` and `masterLawsuitId`;
- no live upload is enabled in this phase;
- no document is uploaded in this phase.

Phase 44A is the safety bridge before a later live UI control is exposed.
