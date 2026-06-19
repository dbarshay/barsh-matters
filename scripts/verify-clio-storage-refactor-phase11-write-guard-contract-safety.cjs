#!/usr/bin/env node
const fs = require("fs");
const cp = require("child_process");

let failed = false;
function pass(msg) { console.log("PASS: " + msg); }
function fail(msg) { console.error("FAIL: " + msg); failed = true; }
function read(file) { if (!fs.existsSync(file)) { fail(file + " missing"); return ""; } return fs.readFileSync(file, "utf8"); }

const guard = read("lib/clioStorageWriteGuard.ts");
const doc = read("docs/implementation/clio-storage-refactor-phase11-write-guard-contract.md");
const finalize = read("app/api/documents/finalize/route.ts");
const pkg = JSON.parse(read("package.json") || "{}");

for (const token of ["getClioStorageWriteGuard", "assertClioStorageFolderWriteAllowed", "CLIO_SINGLE_MASTER_CREATE_FOLDERS_ENABLED", "CLIO_SINGLE_MASTER_LIVE_WRITE_ENABLED", "CLIO_SINGLE_MASTER_UPLOAD_REWIRE_ENABLED"]) {
  if (guard.includes(token) || doc.includes(token)) pass("Phase 11 contains " + token);
  else fail("Phase 11 missing " + token);
}

for (const token of ["noClioCallsMadeByGuard: true", "noFoldersCreatedByGuard: true", "noDocumentsUploadedByGuard: true", "noDatabaseMutationByGuard: true"]) {
  if (guard.includes(token)) pass("guard declares " + token);
  else fail("guard missing " + token);
}

const forbiddenGuardTokens = ["clioFetch", "fetch(", "uploadBufferToClioMatterDocuments", "listClioMatterDocuments", "findExistingClioDocumentsByFilename", "prisma.", "documentFinalization.create"];
if (!forbiddenGuardTokens.some((token) => guard.includes(token))) pass("write guard has no Clio/database/document IO"); else fail("write guard contains operational IO");

const forbiddenRewireTokens = ["getClioStorageWriteGuard", "assertClioStorageFolderWriteAllowed", "CLIO_SINGLE_MASTER_UPLOAD_REWIRE_ENABLED", "buildClioSingleMasterUploadTargetPreview", "clio-single-master-upload-target-preview"];
const hit = forbiddenRewireTokens.find((token) => finalize.includes(token));
if (!hit) pass("finalize route remains unrevised by Phase 11"); else fail("finalize route appears rewired through " + hit);

const scriptName = "verify:clio-storage-refactor-phase11-write-guard-contract-safety";
const expectedScript = "node scripts/verify-clio-storage-refactor-phase11-write-guard-contract-safety.cjs";
if ((pkg.scripts || {})[scriptName] === expectedScript) pass("package script registered"); else fail("package script missing or incorrect");

try { cp.execFileSync("npm", ["run", "verify:clio-storage-refactor-phase8-upload-target-preview-safety"], { stdio: "inherit" }); pass("Phase 8 verifier still passes"); } catch { fail("Phase 8 verifier failed"); }
try { cp.execFileSync("npm", ["run", "verify:clio-storage-refactor-phase9-upload-target-preview-api-safety"], { stdio: "inherit" }); pass("Phase 9 verifier still passes"); } catch { fail("Phase 9 verifier failed"); }
try { cp.execFileSync("npm", ["run", "verify:clio-storage-refactor-phase10-finalization-integration-map-safety"], { stdio: "inherit" }); pass("Phase 10 verifier still passes"); } catch { fail("Phase 10 verifier failed"); }

if (failed) process.exit(1);
console.log("RESULT: Clio storage refactor Phase 11 write-guard contract verifier passed");
