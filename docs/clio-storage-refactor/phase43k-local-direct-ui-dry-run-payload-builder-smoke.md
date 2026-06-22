# Phase 43K — Local Direct UI Dry-Run Payload Builder Smoke

Phase 43K adds a controlled local smoke for the direct UI dry-run payload builder shape.

This phase does not start a server, does not open a browser, does not call `/api/documents/finalize`, and does not upload anything. It statically verifies that representative selected-document and working-DOCX values can satisfy the Phase 43I prerequisite gate and produce the expected no-upload payload shape.

Safety contract:

- smoke is static/local/no-server/no-upload;
- representative values include `directMatterId`, `directMatterDisplayNumber`, `selectedDocumentKey`, `workingDocumentDriveItemId`, and `workingDocumentKey`;
- payload shape preserves `uploadTargetMode: "direct-matter"`;
- payload shape preserves `useSingleMasterClioStorage: true`;
- payload shape preserves `confirmUpload: false`;
- payload shape preserves `singleMasterDryRun: true`;
- payload shape preserves `singleMasterResolveFolders: true`;
- payload shape preserves `allowDuplicateUploads: false`;
- no `masterLawsuitId` is included;
- no live upload is enabled;
- no document is uploaded.
