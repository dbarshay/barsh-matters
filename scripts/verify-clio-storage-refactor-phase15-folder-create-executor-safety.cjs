#!/usr/bin/env node
const fs = require("fs");

let failed = false;
function pass(msg) { console.log("PASS: " + msg); }
function fail(msg) { console.error("FAIL: " + msg); failed = true; }
function read(file) { if (!fs.existsSync(file)) { fail(file + " missing"); return ""; } return fs.readFileSync(file, "utf8"); }

const executor = read("lib/clioFolderCreateExecutor.ts");
const doc = read("docs/implementation/clio-storage-refactor-phase15-folder-create-executor.md");
const finalize = read("app/api/documents/finalize/route.ts");
const phase9Route = read("app/api/documents/clio-single-master-upload-target-preview/route.ts");
const phase14Route = read("app/api/documents/clio-folder-create-dry-run-plan/route.ts");
const pkg = JSON.parse(read("package.json") || "{}");

for (const token of ["createClioFolderWithGuard", "assertClioStorageFolderWriteAllowed", "clioFetch", "/folders.json", "method: \"POST\""]) {
  if (executor.includes(token)) pass("executor contains " + token);
  else fail("executor missing " + token);
}

for (const token of ["not wired into document finalization", "does not run live folder creation", "write guard"]) {
  if (doc.includes(token)) pass("Phase 15 doc contains " + token);
  else fail("Phase 15 doc missing " + token);
}

for (const [name, source] of [["finalize route", finalize], ["Phase 9 preview route", phase9Route], ["Phase 14 dry-run route", phase14Route]]) {
  if (!source.includes("createClioFolderWithGuard") && !source.includes("clioFolderCreateExecutor")) pass(name + " does not call folder-create executor");
  else fail(name + " appears wired to folder-create executor");
}

const scriptName = "verify:clio-storage-refactor-phase15-folder-create-executor-safety";
const expectedScript = "node scripts/verify-clio-storage-refactor-phase15-folder-create-executor-safety.cjs";
if ((pkg.scripts || {})[scriptName] === expectedScript) pass("package script registered"); else fail("package script missing or incorrect");

if (failed) process.exit(1);
console.log("RESULT: Clio storage refactor Phase 15 folder-create executor verifier passed");
