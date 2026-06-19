const fs = require("fs");
const path = require("path");

let failed = false;
const pass = (message) => console.log("PASS: " + message);
const fail = (message) => {
  failed = true;
  console.error("FAIL: " + message);
};

const read = (relativePath) => fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
const pkg = JSON.parse(read("package.json"));
const smoke = read("scripts/smoke-phase34j-finalize-live-folder-resolution-no-upload.cjs");
const finalize = read("app/api/documents/finalize/route.ts");

const verifierScript = "verify:phase34j-finalize-live-folder-resolution-no-upload-safety";
const smokeScript = "smoke:phase34j-finalize-live-folder-resolution-no-upload";

if (pkg.scripts && pkg.scripts[verifierScript] === "node scripts/verify-phase34j-finalize-live-folder-resolution-no-upload-safety.cjs") {
  pass("package verifier script registered");
} else {
  fail("package verifier script missing");
}

if (pkg.scripts && pkg.scripts[smokeScript] === "node scripts/smoke-phase34j-finalize-live-folder-resolution-no-upload.cjs") {
  pass("package smoke script registered");
} else {
  fail("package smoke script missing");
}

for (const token of [
  "loadLocalEnvWithoutPrintingSecrets",
  "CLIO_CLIENT_ID",
  "LIVE_SMOKE_BLOCKED_REASON=missing_required_local_clio_env",
  "without printing secret values",
  "no Clio folder was created",
  "no document upload was performed",
  "no database mutation was performed"
]) {
  if (smoke.includes(token)) pass("preflight smoke contains " + token);
  else fail("preflight smoke missing " + token);
}

for (const token of [
  "uploadRewired: false",
  "databaseMutation: false",
  "noUploadPerformed: true",
  "generationSkipped: true",
  "resolveClioMatterFolderWithGuard(singleMasterTargetInput)"
]) {
  if (finalize.includes(token)) pass("finalize contains " + token);
  else fail("finalize missing " + token);
}

for (const forbidden of [
  "http.request",
  "fetch(",
  "CLIO_SINGLE_MASTER_CREATE_FOLDERS_ENABLED: \"1\"",
  "CLIO_SINGLE_MASTER_LIVE_WRITE_ENABLED: \"1\"",
  "CLIO_SINGLE_MASTER_LIVE_WRITE_COMMAND: \"RUN_CLIO_SINGLE_MASTER_FOLDER_CREATE\"",
  "confirmUpload: true",
  "uploadRewired: true",
  "databaseMutation: true"
]) {
  if (!smoke.includes(forbidden)) pass("preflight smoke does not include live/write token: " + forbidden);
  else fail("preflight smoke unexpectedly includes live/write token: " + forbidden);
}

console.log("RESULT: Phase 34J live folder resolution local-env preflight safety verifier");
if (failed) process.exit(1);
