#!/usr/bin/env node
const fs = require("fs");
const cp = require("child_process");

let failed = false;
function pass(msg) { console.log("PASS: " + msg); }
function fail(msg) { console.error("FAIL: " + msg); failed = true; }
function read(file) { if (!fs.existsSync(file)) { fail(file + " missing"); return ""; } return fs.readFileSync(file, "utf8"); }

const planner = read("lib/clioFolderCreateDryRunPlan.ts");
const doc = read("docs/implementation/clio-storage-refactor-phase13-folder-create-dry-run-plan.md");
const finalize = read("app/api/documents/finalize/route.ts");
const pkg = JSON.parse(read("package.json") || "{}");

for (const token of ["buildClioFolderCreateDryRunPlan", "buildClioStorageFolderResolutionPreview", "getClioStorageWriteGuard", "dryRunOnly: true", "blockedByDefault: true", "bucket-folder", "matter-folder", "/folders.json"]) {
  if (planner.includes(token) || doc.includes(token)) pass("Phase 13 contains " + token);
  else fail("Phase 13 missing " + token);
}

for (const token of ["callsClio: false", "createsFolders: false", "uploadsDocuments: false", "mutatesDatabase: false"]) {
  if (planner.includes(token)) pass("planner declares " + token);
  else fail("planner missing " + token);
}

const forbiddenPlannerTokens = ["clioFetch", "fetch(", "uploadBufferToClioMatterDocuments", "listClioMatterDocuments", "findExistingClioDocumentsByFilename", "prisma.", "documentFinalization.create"];
if (!forbiddenPlannerTokens.some((token) => planner.includes(token))) pass("dry-run planner has no Clio/database/document IO"); else fail("dry-run planner contains operational IO");

const forbiddenFinalizeTokens = ["buildClioFolderCreateDryRunPlan", "clioFolderCreateDryRunPlan", "assertClioStorageFolderWriteAllowed", "CLIO_SINGLE_MASTER_CREATE_FOLDERS_ENABLED", "CLIO_SINGLE_MASTER_LIVE_WRITE_ENABLED"];
const hit = forbiddenFinalizeTokens.find((token) => finalize.includes(token));
if (!hit) pass("finalize route remains unrevised by Phase 13"); else fail("finalize route appears rewired through " + hit);

const scriptName = "verify:clio-storage-refactor-phase13-folder-create-dry-run-plan-safety";
const expectedScript = "node scripts/verify-clio-storage-refactor-phase13-folder-create-dry-run-plan-safety.cjs";
if ((pkg.scripts || {})[scriptName] === expectedScript) pass("package script registered"); else fail("package script missing or incorrect");

for (const script of ["verify:clio-storage-refactor-phase8-upload-target-preview-safety", "verify:clio-storage-refactor-phase9-upload-target-preview-api-safety", "verify:clio-storage-refactor-phase10-finalization-integration-map-safety", "verify:clio-storage-refactor-phase11-write-guard-contract-safety", "verify:clio-storage-refactor-phase12-live-no-write-folder-preflight-safety"]) {
  try { cp.execFileSync("npm", ["run", script], { stdio: "inherit" }); pass(script + " still passes"); } catch { fail(script + " failed"); }
}

if (failed) process.exit(1);
console.log("RESULT: Clio storage refactor Phase 13 folder-create dry-run planner verifier passed");
