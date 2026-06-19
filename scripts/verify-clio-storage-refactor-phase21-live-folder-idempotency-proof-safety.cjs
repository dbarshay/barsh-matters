#!/usr/bin/env node
const fs = require("fs");

let failed = false;
function pass(msg) { console.log("PASS: " + msg); }
function fail(msg) { console.error("FAIL: " + msg); failed = true; }
function read(file) { if (!fs.existsSync(file)) { fail(file + " missing"); return ""; } return fs.readFileSync(file, "utf8"); }

const doc = read("docs/implementation/clio-storage-refactor-phase21-live-folder-idempotency-proof.md");
const smoke = read("scripts/smoke-clio-storage-phase20-live-folder-create.cjs");
const finalize = read("app/api/documents/finalize/route.ts");
const pkg = JSON.parse(read("package.json") || "{}");

for (const token of ["bucket-002001-003000", "matter-2026.05.00001", "22059823835", "22059823955", "BUCKET_FOLDER_CREATED=false", "MATTER_FOLDER_CREATED=false", "parentOutsideInventory"]) {
  if (doc.includes(token) || smoke.includes(token)) pass("Phase 21 contains " + token); else fail("Phase 21 missing " + token);
}
if (smoke.includes("findOrCreateFolder")) pass("Phase 20 smoke remains find-before-create"); else fail("Phase 20 smoke missing find-before-create");
if (!finalize.includes("smoke-clio-storage-phase20") && !finalize.includes("resolveClioMatterFolderWithGuard") && !finalize.includes("createClioFolderWithGuard")) pass("finalize route remains unrevised by Phase 21"); else fail("finalize route appears rewired by Phase 21");
const scriptName = "verify:clio-storage-refactor-phase21-live-folder-idempotency-proof-safety";
const expectedScript = "node scripts/verify-clio-storage-refactor-phase21-live-folder-idempotency-proof-safety.cjs";
if ((pkg.scripts || {})[scriptName] === expectedScript) pass("package script registered"); else fail("package script missing or incorrect");
if (failed) process.exit(1);
console.log("RESULT: Clio storage refactor Phase 21 live folder idempotency verifier passed");
