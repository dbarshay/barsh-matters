#!/usr/bin/env node
const fs = require("fs");
const expected = {
  CLIO_STORAGE_MODE: "single_master_matter",
  CLIO_MASTER_MATTER_ID: "1885821245",
  CLIO_MASTER_MATTER_NAME: "Barsh Matters Master Repository",
  CLIO_BUCKET_SIZE: "1000",
};
let failed = false;
function pass(msg) { console.log("PASS: " + msg); }
function fail(msg) { console.error("FAIL: " + msg); failed = true; }
function read(file) { if (!fs.existsSync(file)) { fail(file + " missing"); return ""; } return fs.readFileSync(file, "utf8"); }
const doc = read("docs/implementation/clio-storage-refactor-phase2-setup.md");
const adr = read("docs/adr/0001-clio-single-master-storage.md");
const envText = read(".env.local");
if (doc.includes("Barsh Matters Master Repository")) pass("doc contains master matter name"); else fail("doc missing master matter name");
if (doc.includes("1885821245")) pass("doc contains master matter ID"); else fail("doc missing master matter ID");
if (adr.includes("Barsh Matters Master Repository")) pass("ADR contains master matter name"); else fail("ADR missing master matter name");
const values = {};
for (const line of envText.split(/\r?\n/)) {
  const m = line.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (!m) continue;
  let v = m[2].trim();
  if (v.length >= 2 && v.startsWith("\"") && v.endsWith("\"")) v = v.slice(1, -1);
  values[m[1]] = v;
}
for (const [key, value] of Object.entries(expected)) {
  if (values[key] === value) pass("local env " + key + " matches");
  else fail("local env " + key + " expected " + value + ", got " + (values[key] || "<missing>"));
  if (doc.includes(key)) pass("doc contains " + key); else fail("doc missing " + key);
}
if (failed) process.exit(1);
console.log("RESULT: Clio storage refactor Phase 2 setup safety verifier passed");
