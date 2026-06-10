#!/usr/bin/env node
import fs from "fs";

const invoicePage = fs.readFileSync("app/admin/clients/[id]/invoice/page.tsx", "utf8");
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));

let failures = 0;

function pass(message) { console.log(`PASS: ${message}`); }
function fail(message) { console.error(`FAIL: ${message}`); failures += 1; }
function mustContain(label, body, marker) {
  if (body.includes(marker)) pass(`${label}: found ${marker}`);
  else fail(`${label}: missing ${marker}`);
}

console.log("=== VERIFY PRINTABLE INVOICE SUMMARY PAGE BREAK SAFETY ===");

mustContain("printable invoice CSS", invoicePage, ".totals { margin-top: 30px;");
mustContain("printable invoice CSS", invoicePage, "break-inside: avoid; page-break-inside: avoid;");
mustContain("print media CSS", invoicePage, ".totals { break-inside: avoid; page-break-inside: avoid; }");
mustContain("printable summary block", invoicePage, '<div class="totals">');
mustContain("printable summary keeps final remit", invoicePage, '<div class="total"><span>Final Net Remit to Provider</span>');

const expectedScript = "node scripts/verify-printable-invoice-summary-page-break-safety.mjs";
if (pkg.scripts?.["verify:printable-invoice-summary-page-break-safety"] === expectedScript) {
  pass("package.json registers verify:printable-invoice-summary-page-break-safety");
} else {
  fail("package.json missing verify:printable-invoice-summary-page-break-safety registration");
}

if (failures) {
  console.error(`\nRESULT: printable invoice summary page break safety FAILED (${failures})`);
  process.exit(1);
}

console.log("\nPASS: printable invoice summary page break safety passed");
