#!/usr/bin/env node
const fs = require("fs");

let failed = false;
function pass(msg) { console.log("PASS: " + msg); }
function fail(msg) { console.error("FAIL: " + msg); failed = true; }
function read(file) { if (!fs.existsSync(file)) { fail(file + " missing"); return ""; } return fs.readFileSync(file, "utf8"); }

const gate = read("lib/clioLiveWriteReadiness.ts");
const doc = read("docs/implementation/clio-storage-refactor-phase18-live-write-readiness-gate.md");
const finalize = read("app/api/documents/finalize/route.ts");
const pkg = JSON.parse(read("package.json") || "{}");

for (const token of ["getClioLiveWriteReadiness", "RUN_CLIO_SINGLE_MASTER_FOLDER_CREATE", "CLIO_SINGLE_MASTER_LIVE_WRITE_COMMAND", "CLIO_SINGLE_MASTER_CREATE_FOLDERS_ENABLED", "CLIO_SINGLE_MASTER_LIVE_WRITE_ENABLED"]) {
  if (gate.includes(token) || doc.includes(token)) pass("Phase 18 contains " + token);
  else fail("Phase 18 missing " + token);
}

for (const token of ["requiresExplicitUserCommand: true", "requiresCleanMasterInventory: true", "requiresWriteGuardEnabled: true", "requiresNoFinalizeRewire: true"]) {
  if (gate.includes(token)) pass("readiness gate declares " + token);
  else fail("readiness gate missing " + token);
}

if (!gate.includes("clioFetch") && !gate.includes("fetch(") && !gate.includes("prisma.") && !gate.includes("createClioFolderWithGuard")) pass("readiness gate has no operational IO"); else fail("readiness gate appears operational");
if (!finalize.includes("getClioLiveWriteReadiness") && !finalize.includes("RUN_CLIO_SINGLE_MASTER_FOLDER_CREATE") && !finalize.includes("createClioFolderWithGuard") && !finalize.includes("resolveClioMatterFolderWithGuard")) pass("finalize route remains unrevised by Phase 18"); else fail("finalize route appears rewired by Phase 18");

const scriptName = "verify:clio-storage-refactor-phase18-live-write-readiness-gate-safety";
const expectedScript = "node scripts/verify-clio-storage-refactor-phase18-live-write-readiness-gate-safety.cjs";
if ((pkg.scripts || {})[scriptName] === expectedScript) pass("package script registered"); else fail("package script missing or incorrect");

if (failed) process.exit(1);
console.log("RESULT: Clio storage refactor Phase 18 live-write readiness gate verifier passed");
