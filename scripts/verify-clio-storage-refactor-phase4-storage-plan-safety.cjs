#!/usr/bin/env node
const fs = require("fs");
const cp = require("child_process");

let failed = false;
function pass(msg) { console.log("PASS: " + msg); }
function fail(msg) { console.error("FAIL: " + msg); failed = true; }
function read(file) { if (!fs.existsSync(file)) { fail(file + " missing"); return ""; } return fs.readFileSync(file, "utf8"); }

const plan = read("lib/clioStoragePlan.ts");
const doc = read("docs/implementation/clio-storage-refactor-phase4-storage-plan.md");
const pkg = JSON.parse(read("package.json") || "{}");

for (const token of ["buildClioStorageTargetPlan", "getBucketRange", "buildBucketFolderName", "buildMatterFolderName", "bucket-000001-001000", "Barsh Matters Master Repository", "1885821245"]) {
  if (plan.includes(token) || doc.includes(token)) pass("Phase 4 contains " + token);
  else fail("Phase 4 missing " + token);
}

if (plan.includes("getClioStorageConfig")) pass("planner uses Phase 3 config contract"); else fail("planner does not use Phase 3 config contract");
if (plan.includes("Math.floor((matterOrdinal - 1) / bucketSize) + 1")) pass("bucket math is deterministic"); else fail("bucket math contract missing");
if (plan.includes("matterFolderPath: `${bucketFolderName}/${matterFolderName}`")) pass("matter folder path is bucket/folder"); else fail("matter folder path contract missing");

const forbiddenTokens = ["clioFetch", "fetch(", "uploadBufferToClioMatterDocuments", "listClioMatterDocuments", "findExistingClioDocumentsByFilename", "prisma.", "migration.sql"];
if (!forbiddenTokens.some((token) => plan.includes(token))) pass("planner has no Clio/database/document IO"); else fail("planner contains operational IO");

const scriptName = "verify:clio-storage-refactor-phase4-storage-plan-safety";
const expectedScript = "node scripts/verify-clio-storage-refactor-phase4-storage-plan-safety.cjs";
if ((pkg.scripts || {})[scriptName] === expectedScript) pass("package script registered"); else fail("package script missing or incorrect");

try { cp.execFileSync("node", ["scripts/verify-clio-storage-refactor-phase2-setup-safety.cjs"], { stdio: "inherit" }); pass("Phase 2 verifier still passes"); } catch { fail("Phase 2 verifier failed"); }
try { cp.execFileSync("npm", ["run", "verify:clio-storage-refactor-phase3-config-contract-safety"], { stdio: "inherit" }); pass("Phase 3 verifier still passes"); } catch { fail("Phase 3 verifier failed"); }

if (failed) process.exit(1);
console.log("RESULT: Clio storage refactor Phase 4 storage plan verifier passed");
