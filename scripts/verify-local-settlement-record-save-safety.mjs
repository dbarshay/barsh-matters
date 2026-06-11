#!/usr/bin/env node
import fs from "fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

let failures = 0;
function pass(message) {
  console.log(`PASS: ${message}`);
}
function fail(message) {
  console.error(`FAIL: ${message}`);
  failures += 1;
}
function mustContain(label, text, needle) {
  text.includes(needle) ? pass(`${label}: found ${needle}`) : fail(`${label}: missing ${needle}`);
}
function mustNotContain(label, text, needle) {
  !text.includes(needle) ? pass(`${label}: does not contain ${needle}`) : fail(`${label}: unexpectedly contains ${needle}`);
}

console.log("=== LOCAL SETTLEMENT RECORD SAVE SAFETY VERIFICATION ===");

const route = read("app/api/settlements/local-record/route.ts");
const page = read("app/matters/page.tsx");
const pkg = read("package.json");

for (const needle of [
  "export async function POST",
  'action: "local-settlement-record-save"',
  "prisma.localSettlementRecord.create",
  "rows: {",
  "create: validation.settlementRows.map",
  'databaseWriteScope: ["LocalSettlementRecord", "LocalSettlementRow"]',
  "clioRecordsChanged: false",
  "documentsGenerated: false",
  "printQueueChanged: false",
  "mattersClosed: false",
  "settlementWritebackPerformed: false",
  "priorActiveSettlementAutoSuperseded",
]) mustContain("app/api/settlements/local-record/route.ts", route, needle);

for (const forbidden of [
  "clioFetch(",
  "writeSettlementToClio",
  "previewSettlementWritebackToClio",
  "prisma.claimIndex.update",
  "prisma.claimIndex.create",
  "prisma.documentPrintQueueItem.create",
  "prisma.documentFinalization.create",
  "prisma.settlementWriteback.create",
  'method: "PATCH"',
  'method: "DELETE"',
]) mustNotContain("app/api/settlements/local-record/route.ts", route, forbidden);

for (const needle of [
  "/api/settlements/local-record",
  "Local Settlement Save Result",
  "Barsh Matters local settlement tables only",
  "databaseRecordsChanged",
  "data-barsh-record-local-settlement-guarded-button",
]) mustContain("app/matters/page.tsx", page, needle);

mustContain("package.json", pkg, "verify:local-settlement-record-save-safety");

if (failures) {
  console.error(`=== LOCAL SETTLEMENT RECORD SAVE SAFETY FAILED: ${failures} failure(s) ===`);
  process.exit(1);
}
console.log("=== LOCAL SETTLEMENT RECORD SAVE SAFETY PASSED ===");
