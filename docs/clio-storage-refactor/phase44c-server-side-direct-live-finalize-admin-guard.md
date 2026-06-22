# Phase 44C — Server-Side Direct Live Finalize Admin Guard

Phase 44C adds the server-side safety guard required before any live-capable direct UI finalize control can be exposed.

This phase does not expose a live UI button, does not run a live upload smoke, and does not upload any document.

Guard contract:

- direct-matter live finalize means:
  - `uploadTargetMode === "direct-matter"`;
  - `confirmUpload === true`;
  - `singleMasterDryRun !== true`;
- direct-matter live finalize must require a valid admin session on the server;
- dry-run direct finalize remains allowed for the existing local no-upload smoke;
- lawsuit/master finalize behavior remains separate;
- direct flow must not include `masterLawsuitId`;
- duplicate prevention remains required through `allowDuplicateUploads: false`;
- no live UI control is exposed in this phase;
- no document is uploaded in this phase.

This is the server-side prerequisite before a later owner/admin live UI control phase.
