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
const smoke = read("scripts/smoke-phase34m-finalize-live-folder-resolution-no-upload.cjs");
const finalize = read("app/api/documents/finalize/route.ts");
const resolver = read("lib/clioFolderResolverExecutor.ts");

const verifierScript = "verify:phase34m-live-folder-resolution-no-upload-safety";
const smokeScript = "smoke:phase34m-finalize-live-folder-resolution-no-upload";

if (pkg.scripts && pkg.scripts[verifierScript] === "node scripts/verify-phase34m-live-folder-resolution-no-upload-safety.cjs") {
  pass("package verifier script registered");
} else {
  fail("package verifier script missing");
}

if (pkg.scripts && pkg.scripts[smokeScript] === "node scripts/smoke-phase34m-finalize-live-folder-resolution-no-upload.cjs") {
  pass("package smoke script registered");
} else {
  fail("package smoke script missing");
}

for (const token of [
  "CLIO_SINGLE_MASTER_LIVE_WRITE_COMMAND",
  "RUN_CLIO_SINGLE_MASTER_FOLDER_CREATE",
  "CLIO_SINGLE_MASTER_CREATE_FOLDERS_ENABLED",
  "CLIO_SINGLE_MASTER_LIVE_WRITE_ENABLED",
  "CLIO_SINGLE_MASTER_ROOT_FOLDER_ID",
  ".env.vercel.production",
  "mergeNonEmptyEnvFiles",
  "singleMasterResolveFolders: true",
  "Lawsuits/2026-05/2026.05.00001",
  "no document upload was performed",
  "no database mutation was performed",
  "folderSegments.length === 3"
]) {
  if (smoke.includes(token)) pass("smoke contains " + token);
  else fail("smoke missing " + token);
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

for (const token of [
  "parentId: number | null",
  "configuredRootFolderId",
  "CLIO_SINGLE_MASTER_ROOT_FOLDER_ID"
]) {
  if (resolver.includes(token)) pass("resolver contains " + token);
  else fail("resolver missing " + token);
}

for (const forbidden of [
  "uploadRewired: true",
  "databaseMutation: true",
  "confirmUpload: true"
]) {
  if (!smoke.includes(forbidden)) {
    pass("smoke does not include forbidden token: " + forbidden);
  } else {
    fail("smoke includes forbidden token: " + forbidden);
  }
}

console.log("RESULT: Phase 34M live folder resolution no-upload safety verifier");
if (failed) process.exit(1);
