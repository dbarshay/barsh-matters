#!/usr/bin/env node
import fs from "node:fs";

// Dow adapter + shared parse/fingerprint safety (pure mapping layer).
function read(p) {
  return fs.readFileSync(p, "utf8");
}
let failures = 0;
const pass = (m) => console.log(`PASS: ${m}`);
const fail = (m) => {
  console.error(`FAIL: ${m}`);
  failures += 1;
};
const must = (label, text, needle) =>
  text.includes(needle) ? pass(`${label}: ${needle}`) : fail(`${label}: missing ${needle}`);

console.log("=== VERIFY DOW ADAPTER SAFETY ===");

const parse = read("lib/import/parse.ts");
const fp = read("lib/import/fingerprint.ts");
const dow = read("lib/import/dowAdapter.ts");
const pkg = read("package.json");

// parse.ts
must("parse money to cents", parse, "Math.round(n * 100) / 100");
must("parse DOS span split", parse, ".split(/[;,]/)");
must("parse DOS min/max", parse, "return { start: parsed[0].t, end: parsed[parsed.length - 1].t");
must("parse date-only", parse, "export function toDateOnly");

// fingerprint.ts
must("fingerprint inputs", fp, "claimOrPolicy: string");
must("fingerprint patient key", fp, "patientKey: string");
must("fingerprint dos span", fp, "dosStart: string");
must("fingerprint amount cents", fp, "input.grossAmount.toFixed(2)");

// dowAdapter.ts — field mapping + derived case type + validation + fingerprint
must("dow case type No-Fault", dow, 'DOW_CASE_TYPE = "No-Fault"');
must("dow claim number", dow, 'const claim = s(row["insuredsID"])');
must("dow patient First Last", dow, "toFirstLastProperCase(patientRaw)");
must("dow carrier raw (resolve later)", dow, 'const carrier = s(row["CarrierName"])');
must("dow DOS span", dow, 'parseDosSpan(row["DateOfService"])');
must("dow gross -> claim_amount", dow, "claim_amount: amount");
must("dow presuit opens at gross", dow, "balance_presuit: amount");
must("dow service type from BillType", dow, 'const billType = s(row["BillType"])');
must("dow validation errors", dow, "errors.push(");
must("dow fingerprint", dow, "computeBillFingerprint({");
must("dow keeps raw row", dow, "raw: row,");
must("dow maps many", dow, "export function mapDowRows");

must("package.json", pkg, "verify:dow-adapter-safety");

if (failures) {
  console.error(`=== DOW ADAPTER SAFETY FAILED: ${failures} failure(s) ===`);
  process.exit(1);
}
console.log("=== DOW ADAPTER SAFETY PASSED ===");
