#!/usr/bin/env node
const fs = require("fs");

let failed = false;
function pass(msg) { console.log("PASS: " + msg); }
function fail(msg) { console.error("FAIL: " + msg); failed = true; }
function read(file) { if (!fs.existsSync(file)) { fail(file + " missing"); return ""; } return fs.readFileSync(file, "utf8"); }

const smoke = read("scripts/smoke-clio-storage-phase20-live-folder-create.cjs");
const doc = read("docs/implementation/clio-storage-refactor-phase23-live-human-readable-folder-create-smoke.md");
const finalize = read("app/api/documents/finalize/route.ts");
const pkg = JSON.parse(read("package.json") || "{}");

for (const token of ["2026-05 Matters", "2026.05.00001", "findOrCreateFolder", "RUN_CLIO_SINGLE_MASTER_FOLDER_CREATE"]) {
  if (smoke.includes(token) || doc.includes(token)) pass("Phase 23 contains " + token); else fail("Phase 23 missing " + token);
}
if (!smoke.includes("bucket-002001-003000") && !smoke.includes("matter-2026.05.00001")) pass("old test folder names removed from live smoke"); else fail("old test folder names still present in live smoke");
if (smoke.includes("method: \"POST\"") && smoke.includes("/folders.json")) pass("Phase 23 smoke contains controlled folder POST"); else fail("Phase 23 smoke missing folder POST");
if (!smoke.includes("uploadBufferToClioMatterDocuments") && !smoke.includes("documentFinalization.create") && !smoke.includes("prisma.")) pass("Phase 23 smoke has no document/database IO"); else fail("Phase 23 smoke contains document/database IO");
if (!finalize.includes("smoke-clio-storage-phase20") && !finalize.includes("resolveClioMatterFolderWithGuard") && !finalize.includes("createClioFolderWithGuard")) pass("finalize route remains unrevised by Phase 23"); else fail("finalize route appears rewired by Phase 23");
const scriptName = "verify:clio-storage-refactor-phase23-live-human-readable-folder-create-smoke-safety";
const expectedScript = "node scripts/verify-clio-storage-refactor-phase23-live-human-readable-folder-create-smoke-safety.cjs";
if ((pkg.scripts || {})[scriptName] === expectedScript) pass("package script registered"); else fail("package script missing or incorrect");
if (failed) process.exit(1);
console.log("RESULT: Clio storage refactor Phase 23 live human-readable folder-create smoke verifier passed");
