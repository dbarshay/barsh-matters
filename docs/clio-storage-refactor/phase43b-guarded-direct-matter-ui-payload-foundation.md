# Phase 43B — Guarded Direct Matter UI Payload Foundation

Phase 43B adds the guarded UI payload foundation for direct/individual single-master document finalization.

This phase does not change the live button behavior and does not upload anything. It adds reusable matters-page payload builders for the proven backend route shape:

- working DOCX route payload:
  - `confirmCreate: true`;
  - `uploadTargetMode: "direct-matter"`;
  - `directMatterId`;
  - `directMatterDisplayNumber`;
  - `useSingleMasterClioStorage: true`;
  - `singleMasterDirectStorage: true`.

- finalize route payload:
  - `uploadTargetMode: "direct-matter"`;
  - `directMatterId`;
  - `directMatterDisplayNumber`;
  - `useSingleMasterClioStorage: true`;
  - `workingDocumentDriveItemId`;
  - `workingDocumentKey`;
  - `allowDuplicateUploads: false`;
  - dry-run by default unless explicitly armed later.

Safety contract:

- no live upload is performed by this phase;
- the helper must not include `masterLawsuitId`;
- duplicate prevention remains on by default;
- broad production direct upload is not enabled;
- existing direct documents are not moved when a direct matter is later aggregated into a lawsuit.

The next phase should wire these helpers into the actual direct matter document button flow and smoke the UI-originated route shape in no-upload/dry-run mode before any further UI-originated live upload.
