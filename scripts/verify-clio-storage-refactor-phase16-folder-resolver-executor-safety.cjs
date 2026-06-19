#!/usr/bin/env node
const fs = require("fs");

let failed = false;
function pass(msg) { console.log("PASS: " + msg); }
function fail(msg) { console.error("FAIL: " + msg); failed = true; }
function read(file) { if (!fs.existsSync(file)) { fail(file + " missing"); return ""; } return fs.readFileSync(file, "utf8"); }

const resolver = read("lib/clioFolderResolverExecutor.ts");
const executor = read("lib/clioFolderCreateExecutor.ts");
const doc = read("docs/implementation/clio-storage-refactor-phase16-folder-resolver-executor.md");
const finalize = read("app/api/documents/finalize/route.ts");
const phase9Route = read("app/api/documents/clio-single-master-upload-target-preview/route.ts");
const phase14Route = read("app/api/documents/clio-folder-create-dry-run-plan/route.ts");
const pkg = JSON.parse(read("package.json") || "{}");

for (const token of ["resolveClioMatterFolderWithGuard", "buildClioStorageFolderResolutionPreview", "createClioFolderWithGuard", "bucketFolderName", "matterFolderName", "matterFolderPath"]) {
  if (resolver.includes(token)) pass("resolver contains " + token);
  else fail("resolver missing " + token);
}

if (executor.includes("createClioFolderWithGuard") && executor.includes("method: \"POST\"")) pass("Phase 15 guarded folder POST primitive remains present"); else fail("Phase 15 guarded executor missing expected POST primitive");

for (const token of ["not wired into document finalization", "does not run live folder creation", "only new Clio folder POST primitive"]) {
  if (doc.includes(token)) pass("Phase 16 doc contains " + token);
  else fail("Phase 16 doc missing " + token);
}

for (const [name, source] of [["finalize route", finalize], ["Phase 9 preview route", phase9Route], ["Phase 14 dry-run route", phase14Route]]) {
  if (!source.includes("resolveClioMatterFolderWithGuard") && !source.includes("clioFolderResolverExecutor")) pass(name + " does not call folder resolver executor");
  else fail(name + " appears wired to folder resolver executor");
}

const scriptName = "verify:clio-storage-refactor-phase16-folder-resolver-executor-safety";
const expectedScript = "node scripts/verify-clio-storage-refactor-phase16-folder-resolver-executor-safety.cjs";
if ((pkg.scripts || {})[scriptName] === expectedScript) pass("package script registered"); else fail("package script missing or incorrect");

if (failed) process.exit(1);
console.log("RESULT: Clio storage refactor Phase 16 folder resolver executor verifier passed");
