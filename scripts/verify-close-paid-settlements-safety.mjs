#!/usr/bin/env node
import fs from "fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}
function pass(message) {
  console.log(`PASS: ${message}`);
}
function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exitCode = 1;
}
function mustContain(label, text, needle) {
  text.includes(needle) ? pass(`${label}: found ${needle}`) : fail(`${label}: missing ${needle}`);
}
function mustNotContain(label, text, needle) {
  !text.includes(needle) ? pass(`${label}: does not contain ${needle}`) : fail(`${label}: unexpectedly contains ${needle}`);
}

console.log("=== VERIFY CLOSE PAID SETTLEMENTS SAFETY ===");

const route = read("app/api/settlements/close/route.ts");
const matterPage = read("app/matter/[id]/page.tsx");
const packageJson = read("package.json");

mustContain("close paid settlements route", route, "legacyClioOperationalRouteBlocked");
mustContain("close paid settlements route", route, "app/api/settlements/close");

for (const forbidden of [
  "clioFetch",
  "ingestMattersFromClioBatch",
  "upsertClaimIndexFromMatter",
  "method: \"PATCH\"",
  "custom_field_values",
  "patchMatterClosedAsPaidSettlement",
]) {
  mustNotContain("close paid settlements route", route, forbidden);
}

mustContain("matter page", matterPage, "Close Paid Settlements");
mustContain("matter page", matterPage, "/api/settlements/close");
mustContain("matter page", matterPage, "confirmPaid: true");
mustContain("matter page", matterPage, "confirmClosePaidSettlements: true");
mustNotContain("matter page", matterPage, "Close Settlement Matters Now");
mustNotContain("matter page", matterPage, "Confirm Settlement Close");

mustContain("package.json", packageJson, "verify:close-paid-settlements-safety");

if (process.exitCode) {
  console.error("=== CLOSE PAID SETTLEMENTS SAFETY VERIFICATION FAILED ===");
  process.exit(process.exitCode);
}

console.log("=== CLOSE PAID SETTLEMENTS SAFETY VERIFICATION PASSED ===");
console.log("Close paid settlements route is quarantined; no Clio/database/document/print mutations are verified here.");
