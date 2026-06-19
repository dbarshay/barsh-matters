#!/usr/bin/env node
const fs = require("fs");

let failed = false;
function pass(msg) { console.log("PASS: " + msg); }
function fail(msg) { console.error("FAIL: " + msg); failed = true; }
function read(file) { if (!fs.existsSync(file)) { fail(file + " missing"); return ""; } return fs.readFileSync(file, "utf8"); }

const smoke = read("scripts/smoke-clio-storage-phase20-live-folder-create.cjs");
const doc = read("docs/implementation/clio-storage-refactor-phase20-live-folder-create-smoke.md");
const finalize = read("app/api/documents/finalize/route.ts");
const pkg = JSON.parse(read("package.json") || "{}");

for (const token of ["RUN_CLIO_SINGLE_MASTER_FOLDER_CREATE", "CLIO_SINGLE_MASTER_CREATE_FOLDERS_ENABLED", "CLIO_SINGLE_MASTER_LIVE_WRITE_ENABLED", "bucket-002001-003000", "matter-2026.05.00001", "findOrCreateFolder"]) {
  if (smoke.includes(token) || doc.includes(token)) pass("Phase 20 contains " + token); else fail("Phase 20 missing " + token);
}
if (smoke.includes("method: \"POST\"") && smoke.includes("/folders.json")) pass("Phase 20 smoke contains controlled folder POST"); else fail("Phase 20 smoke missing folder POST");
if (!smoke.includes("uploadBufferToClioMatterDocuments") && !smoke.includes("documentFinalization.create") && !smoke.includes("prisma.")) pass("Phase 20 smoke has no document/database IO"); else fail("Phase 20 smoke contains document/database IO");
if (!finalize.includes("smoke-clio-storage-phase20") && !finalize.includes("smoke-clio-storage-phase20-live-folder-create") && !finalize.includes("resolveClioMatterFolderWithGuard")) pass("finalize route remains unrevised by Phase 20"); else fail("finalize route appears rewired by Phase 20");

const scriptName = "verify:clio-storage-refactor-phase20-live-folder-create-smoke-safety";
const expectedScript = "node scripts/verify-clio-storage-refactor-phase20-live-folder-create-smoke-safety.cjs";
if ((pkg.scripts || {})[scriptName] === expectedScript) pass("package script registered"); else fail("package script missing or incorrect");
if (failed) process.exit(1);
console.log("RESULT: Clio storage refactor Phase 20 live folder-create smoke verifier passed");
