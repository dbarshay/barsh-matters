#!/usr/bin/env node
import fs from "fs";

const page = fs.readFileSync("app/matters/page.tsx", "utf8");

const checks = [
  ["settlement launch mode state", "masterDocumentLaunchMode"],
  ["settlement record id state", "masterDocumentSettlementRecordId"],
  ["settlement preview endpoint used", "/api/settlements/documents-preview"],
  ["settlement commit launches settlement mode", 'mode: "settlement"'],
  ["settlement document options from planned documents", "settlementDocumentOptions"],
  ["uses displayed options in datalist", "displayedTemplateOptions.map"],
  ["settlement document generation title", "Settlement Document Generation"],
  ["local settlement source copy", "Barsh Matters local settlement records only"],
  ["no settlement strip marker reintroduced", "settlement document preview strip"],
];

let failed = false;
for (const [label, needle] of checks) {
  const present = page.includes(needle);
  if (label === "no settlement strip marker reintroduced") {
    if (present) {
      console.log(`FAIL: ${label}`);
      failed = true;
    } else {
      console.log(`PASS: ${label}`);
    }
  } else if (present) {
    console.log(`PASS: ${label}`);
  } else {
    console.log(`FAIL: ${label} missing ${needle}`);
    failed = true;
  }
}

if (failed) process.exit(1);
console.log("PASS: settlement document dialog mode verifier");
