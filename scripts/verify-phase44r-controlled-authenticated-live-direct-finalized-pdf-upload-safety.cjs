const fs = require("fs");

const scriptPath = "scripts/smoke-phase44r-controlled-authenticated-live-direct-finalized-pdf-upload.cjs";
const script = fs.readFileSync(scriptPath, "utf8");

let failed = false;
function pass(msg) { console.log("PASS: " + msg); }
function fail(msg) { failed = true; console.error("FAIL: " + msg); }

for (const token of [
  "phase44rAuthorizeAdmin",
  "/api/admin/authorize",
  "phase44rConfiguredAdminPassword",
  "BARSH_ADMIN_PASSWORD",
  "BARSH_PHASE44R_ADMIN_PASSWORD",
  "loadEnvConfig(process.cwd())",
  "phase44rAdminCookieHeader",
  "phase44rCaptureSetCookies",
  "phase44rMergeCookieHeader",
  "phase44rFetch",
  "confirmUpload: true",
  "singleMasterDryRun: false",
  "singleMasterResolveFolders: true",
  "EXPECTED_FOLDER_ID = 22062401000",
  "workingDocumentDriveItemId: working.driveItemId",
  "FINALIZE_JSON_REDACTED",
  "liveUploadSuccess",
  "idempotentDuplicateSkipSuccess",
  "already-uploaded-to-clio",
  "existingClioDocuments",
  "finalize either uploads one PDF or idempotently skips an existing fully uploaded PDF",
  "idempotent skipped item includes existing Clio document id",
  "idempotent skipped item reports existing fully uploaded PDF",
  "finalization audit metadata recorded",
]) {
  script.includes(token) ? pass("Phase 44R smoke contains " + token) : fail("Phase 44R smoke missing " + token);
}

if (script.includes("barsh-admin-dev")) fail("Phase 44R smoke must not contain dev fallback password token");
else pass("Phase 44R smoke has no dev fallback password token");

if (script.includes("masterLawsuitId")) fail("Phase 44R direct smoke should not introduce masterLawsuitId");
else pass("Phase 44R direct smoke does not introduce masterLawsuitId token");

script.includes("Duplicate child folders named") ? pass("Phase 44R smoke checks duplicate folder protection") : fail("Phase 44R smoke missing duplicate folder protection check");
script.includes('"created":true') ? pass("Phase 44R smoke checks no new Clio folder creation") : fail("Phase 44R smoke missing no-new-folder check");

if (failed) {
  console.error("RESULT: Phase 44R authenticated idempotent direct finalize verifier failed");
  process.exit(1);
}
console.log("RESULT: Phase 44R authenticated idempotent direct finalize verifier passed");
