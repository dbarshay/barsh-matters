#!/usr/bin/env node
const fs = require("fs");

let failed = false;
function pass(msg) { console.log("PASS: " + msg); }
function fail(msg) { console.error("FAIL: " + msg); failed = true; }
function read(file) { if (!fs.existsSync(file)) { fail(file + " missing"); return ""; } return fs.readFileSync(file, "utf8"); }

const plan = read("lib/clioStoragePlan.ts");
const doc = read("docs/implementation/clio-storage-refactor-phase22-human-readable-folder-naming.md");
const finalize = read("app/api/documents/finalize/route.ts");
const pkg = JSON.parse(read("package.json") || "{}");

for (const token of ["buildBucketFolderName(input: ClioStorageTargetInput)", "getMatterYearMonth", "YYYY-MM Matters", "2026-05 Matters", "2026.05.00001"]) {
  if (plan.includes(token) || doc.includes(token)) pass("Phase 22 contains " + token); else fail("Phase 22 missing " + token);
}

if (!plan.includes("bucket-${pad") && !plan.includes("matter-${input.bmMatterId}") && !plan.includes("matter-${matterOrdinal}")) pass("old machine-style folder naming removed from planner"); else fail("old machine-style folder naming still present in planner");
if (!plan.includes("patient") && !plan.includes("provider") && !plan.includes("insurer") && !plan.includes("claim")) pass("planner folder naming remains privacy-safe"); else fail("planner may include private matter details in folder names");
if (!finalize.includes("buildClioStorageTargetPlan") && !finalize.includes("resolveClioMatterFolderWithGuard") && !finalize.includes("createClioFolderWithGuard")) pass("finalize route remains unrevised by Phase 22"); else fail("finalize route appears rewired by Phase 22");

const scriptName = "verify:clio-storage-refactor-phase22-human-readable-folder-naming-safety";
const expectedScript = "node scripts/verify-clio-storage-refactor-phase22-human-readable-folder-naming-safety.cjs";
if ((pkg.scripts || {})[scriptName] === expectedScript) pass("package script registered"); else fail("package script missing or incorrect");

if (failed) process.exit(1);
console.log("RESULT: Clio storage refactor Phase 22 human-readable folder naming verifier passed");
