# Phase 41L — Armed Direct/Individual Upload Blocked by Missing Working DOCX No-Upload Route Smoke

Phase 41L locks an actual local route smoke proving that, even when the local test environment enables the direct target-input guard and the single-master upload/folder/live flags, direct/individual finalize upload stops before Graph conversion, Clio upload, and DB mutation when no saved working DOCX drive item is supplied.

This is not a live upload. The request is armed only to reach the route's working-DOCX requirement.

The smoke uses `confirmUpload: true`, `singleMasterDryRun: false`, `singleMasterResolveFolders: true`, and direct target `BRL_202600001`. The local-only env enables `CLIO_DIRECT_INDIVIDUAL_FINALIZE_TARGET_INPUT_ENABLED=1`, `CLIO_SINGLE_MASTER_UPLOAD_REWIRE_ENABLED=1`, `CLIO_SINGLE_MASTER_CREATE_FOLDERS_ENABLED=1`, and `CLIO_SINGLE_MASTER_LIVE_WRITE_ENABLED=1` so the route can get past the earlier upload guard.

Expected result: the route blocks before Graph conversion and before upload because no `workingDocumentDriveItemId` is supplied. Required response properties include `ok: false`, a saved working Word document / Edit Document requirement, no uploaded Clio document id, no document version UUID, no database records changed, and no completed finalization record.

This phase must not upload documents, create Clio folders, delete Clio folders, mutate the database, call Microsoft Graph conversion, or change production environment variables.


The expected route guard text includes: `Finalize Document now requires a saved working Word document so the final PDF reflects the latest edits.`

This phase specifically verifies the missing working DOCX guard before any Graph conversion, Clio upload, or database mutation.
