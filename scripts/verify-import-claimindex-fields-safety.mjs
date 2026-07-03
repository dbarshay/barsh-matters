#!/usr/bin/env node
import fs from "node:fs";

// The ClaimIndex import fields (Carisk/Dow dictionaries) exist, and the Carisk bill key is UNIQUE.
function read(p) {
  return fs.readFileSync(p, "utf8");
}
let failures = 0;
const pass = (m) => console.log(`PASS: ${m}`);
const fail = (m) => {
  console.error(`FAIL: ${m}`);
  failures += 1;
};

const schema = read("prisma/schema.prisma");
const pkg = read("package.json");

console.log("=== VERIFY IMPORT CLAIMINDEX FIELDS SAFETY ===");

// cic_number is the hard-unique Carisk dedup key.
(schema.includes("cic_number") && /cic_number\s+String\?\s+@unique/.test(schema))
  ? pass("cic_number String? @unique (Carisk dedup key)")
  : fail("cic_number must be String? @unique");

for (const f of [
  "case_type",
  "status_notes",
  "status_date",
  "date_bill_submitted",
  "provider_tin",
  "treating_physician_npi",
  "treating_physician_license",
  "place_of_service_address",
  "place_of_service_address2",
  "place_of_service_city",
  "place_of_service_state",
  "place_of_service_zip",
  "carisk_operator",
]) {
  schema.includes(f) ? pass(`field ${f}`) : fail(`missing field ${f}`);
}

schema.includes("@@index([case_type])") ? pass("case_type indexed") : fail("case_type not indexed");
pkg.includes("verify:import-claimindex-fields-safety") ? pass("package.json registered") : fail("package.json not registered");

if (failures) {
  console.error(`=== IMPORT CLAIMINDEX FIELDS SAFETY FAILED: ${failures} failure(s) ===`);
  process.exit(1);
}
console.log("=== IMPORT CLAIMINDEX FIELDS SAFETY PASSED ===");
