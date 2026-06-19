#!/usr/bin/env node
const fs = require("fs");
const cp = require("child_process");

let failed = false;
function pass(msg) { console.log("PASS: " + msg); }
function fail(msg) { console.error("FAIL: " + msg); failed = true; }
function read(file) { if (!fs.existsSync(file)) { fail(file + " missing"); return ""; } return fs.readFileSync(file, "utf8"); }

const helper = read("lib/clioSingleMasterUploadTargetPreview.ts");
const doc = read("docs/implementation/clio-storage-refactor-phase8-upload-target-preview.md");
const pkg = JSON.parse(read("package.json") || "{}");

for (const token of ["buildClioSingleMasterUploadTargetPreview", "buildClioStorageFolderResolutionPreview", "uploadRewired: false", "future-clio-folder", "masterMatterId", "matterFolderPath"]) {
  if (helper.includes(token) || doc.includes(token)) pass("Phase 8 contains " + token);
  else fail("Phase 8 missing " + token);
}

for (const token of ["noExistingRoutesRewired: true", "noClioCalls: true", "noFolderCreation: true", "noDocumentUploads: true", "noDatabaseMutation: true"]) {
  if (helper.includes(token)) pass("Phase 8 safety declares " + token);
  else fail("Phase 8 safety missing " + token);
}

const forbidden = ["clioFetch", "fetch(", "uploadBufferToClioMatterDocuments", "listClioMatterDocuments", "findExistingClioDocumentsByFilename", "prisma.", "migration.sql"];
if (!forbidden.some((token) => helper.includes(token))) pass("upload-target preview has no Clio/database/document IO"); else fail("upload-target preview contains operational IO");

const scriptName = "verify:clio-storage-refactor-phase8-upload-target-preview-safety";
const expectedScript = "node scripts/verify-clio-storage-refactor-phase8-upload-target-preview-safety.cjs";
if ((pkg.scripts || {})[scriptName] === expectedScript) pass("package script registered"); else fail("package script missing or incorrect");

try { cp.execFileSync("node", ["scripts/verify-clio-storage-refactor-phase2-setup-safety.cjs"], { stdio: "inherit" }); pass("Phase 2 verifier still passes"); } catch { fail("Phase 2 verifier failed"); }
try { cp.execFileSync("npm", ["run", "verify:clio-storage-refactor-phase3-config-contract-safety"], { stdio: "inherit" }); pass("Phase 3 verifier still passes"); } catch { fail("Phase 3 verifier failed"); }
try { cp.execFileSync("npm", ["run", "verify:clio-storage-refactor-phase4-storage-plan-safety"], { stdio: "inherit" }); pass("Phase 4 verifier still passes"); } catch { fail("Phase 4 verifier failed"); }
try { cp.execFileSync("npm", ["run", "verify:clio-storage-refactor-phase5-folder-resolution-preview-safety"], { stdio: "inherit" }); pass("Phase 5 verifier still passes"); } catch { fail("Phase 5 verifier failed"); }
try { cp.execFileSync("npm", ["run", "verify:clio-storage-refactor-phase6-live-master-readonly-safety"], { stdio: "inherit", env: { ...process.env, CLIO_PHASE6_LIVE: "1", CLIO_PHASE6_ENV_FILE: ".env.vercel.production" } }); pass("Phase 6 verifier still passes"); } catch { fail("Phase 6 verifier failed"); }
try { cp.execFileSync("npm", ["run", "verify:clio-storage-refactor-phase7-master-folder-inventory-preview-safety"], { stdio: "inherit", env: { ...process.env, CLIO_PHASE7_LIVE: "1", CLIO_PHASE7_ENV_FILE: ".env.vercel.production" } }); pass("Phase 7 verifier still passes"); } catch { fail("Phase 7 verifier failed"); }

if (failed) process.exit(1);
console.log("RESULT: Clio storage refactor Phase 8 upload-target preview verifier passed");
