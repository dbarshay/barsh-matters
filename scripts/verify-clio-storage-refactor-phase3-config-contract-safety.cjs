#!/usr/bin/env node
const fs = require("fs");
const cp = require("child_process");

let failed = false;
function pass(msg) { console.log("PASS: " + msg); }
function fail(msg) { console.error("FAIL: " + msg); failed = true; }
function read(file) { if (!fs.existsSync(file)) { fail(file + " missing"); return ""; } return fs.readFileSync(file, "utf8"); }

const config = read("lib/clioStorageConfig.ts");
const doc = read("docs/implementation/clio-storage-refactor-phase3-config-contract.md");
const pkg = JSON.parse(read("package.json") || "{}");

for (const token of ["CLIO_STORAGE_MODE", "CLIO_MASTER_MATTER_ID", "CLIO_MASTER_MATTER_NAME", "CLIO_BUCKET_SIZE", "single_master_matter", "Barsh Matters Master Repository", "1885821245"]) {
  if (config.includes(token) || doc.includes(token)) pass("contract contains " + token);
  else fail("contract missing " + token);
}

if (config.includes("export function getClioStorageConfig")) pass("exports getClioStorageConfig"); else fail("missing getClioStorageConfig export");
if (config.includes("export function assertSingleMasterClioStorageConfig")) pass("exports assertSingleMasterClioStorageConfig"); else fail("missing assertSingleMasterClioStorageConfig export");
if (config.includes("positiveIntegerOrDefault(env.CLIO_BUCKET_SIZE, 1000)")) pass("bucket size defaults to 1000"); else fail("bucket size default contract missing");

const forbiddenIoTokens = ["clioFetch", "fetch(", "uploadBufferToClioMatterDocuments", "listClioMatterDocuments", "findExistingClioDocumentsByFilename"];
if (!forbiddenIoTokens.some((token) => config.includes(token))) pass("config module has no Clio/document IO calls"); else fail("config module contains operational Clio/document IO");

const forbiddenDbTokens = ["prisma", "migration", "model "];
if (!forbiddenDbTokens.some((token) => config.includes(token))) pass("config module has no database coupling"); else fail("config module contains database coupling");

const scriptName = "verify:clio-storage-refactor-phase3-config-contract-safety";
const expectedScript = "node scripts/verify-clio-storage-refactor-phase3-config-contract-safety.cjs";
if ((pkg.scripts || {})[scriptName] === expectedScript) pass("package script registered"); else fail("package script missing or incorrect");

try {
  cp.execFileSync("node", ["scripts/verify-clio-storage-refactor-phase2-setup-safety.cjs"], { stdio: "inherit" });
  pass("Phase 2 verifier still passes");
} catch {
  fail("Phase 2 verifier failed");
}

if (failed) process.exit(1);
console.log("RESULT: Clio storage refactor Phase 3 config contract verifier passed");
