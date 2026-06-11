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

console.log("=== LOCAL SETTLEMENT PERSISTENCE SCHEMA SAFETY VERIFICATION ===");

const schema = read("prisma/schema.prisma");
const migration = read("prisma/migrations/20260520120500_add_local_settlement_records/migration.sql");
const page = read("app/matters/page.tsx");
const pkg = read("package.json");

for (const needle of [
  "model LocalSettlementRecord",
  "model LocalSettlementRow",
  "rows LocalSettlementRow[]",
  "LocalSettlementRecord @relation",
  "masterLawsuitId",
  "settledWith",
  "settlementDate",
  "paymentExpectedDate",
  "grossSettlementAmount",
  "allocatedSettlementTotal",
  "interestAmountTotal",
  "principalFeeTotal",
  "interestFeeTotal",
  "totalFee",
  "providerNetTotal",
  "previewSnapshot",
  "roundingAdjustmentsSnapshot",
  "safetySnapshot",
  "voided",
  "@@index([masterLawsuitId])",
  "@@index([settlementRecordId])",
]) mustContain("prisma/schema.prisma", schema, needle);

for (const needle of [
  'CREATE TABLE IF NOT EXISTS "LocalSettlementRecord"',
  'CREATE TABLE IF NOT EXISTS "LocalSettlementRow"',
  'FOREIGN KEY ("settlementRecordId")',
  'REFERENCES "LocalSettlementRecord"("id")',
  "ON DELETE CASCADE",
  '"LocalSettlementRecord_masterLawsuitId_idx"',
  '"LocalSettlementRow_matterId_idx"',
]) mustContain("migration", migration, needle);

mustContain("package.json", pkg, "verify:local-settlement-persistence-schema-safety");
mustContain("app/matters/page.tsx", page, "data-barsh-record-local-settlement-guarded-button");
mustContain("app/matters/page.tsx", page, "/api/settlements/local-record");
mustContain("app/matters/page.tsx", page, "Barsh Matters local settlement tables only");
mustNotContain("prisma/schema.prisma", schema, "clioFetch(");
mustNotContain("prisma/schema.prisma", schema, "writeSettlementToClio");
mustNotContain("prisma/schema.prisma", schema, "settlementWritebackPerformed: true");

if (failures) {
  console.error(`=== LOCAL SETTLEMENT PERSISTENCE SCHEMA SAFETY FAILED: ${failures} failure(s) ===`);
  process.exit(1);
}
console.log("=== LOCAL SETTLEMENT PERSISTENCE SCHEMA SAFETY PASSED ===");
