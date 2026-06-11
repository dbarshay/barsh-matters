#!/usr/bin/env node
import fs from "fs";

const pagePath = "app/admin/clients/[id]/invoice/page.tsx";
const pkgPath = "package.json";
const page = fs.readFileSync(pagePath, "utf8");
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));

let failures = 0;

function pass(message) {
  console.log(`PASS: ${message}`);
}

function fail(message) {
  console.error(`FAIL: ${message}`);
  failures += 1;
}

function mustContain(label, text, needle) {
  if (text.includes(needle)) pass(`${label}: found ${needle}`);
  else fail(`${label}: missing ${needle}`);
}

function mustAvoidPattern(label, text, regex, description) {
  if (regex.test(text) === false) pass(`${label}: avoids ${description}`);
  else fail(`${label}: matched forbidden ${description}`);
}

console.log("=== VERIFY INVOICE HISTORY COLLAPSED DEFAULT SAFETY ===");

mustContain("invoice page", page, "const [invoiceHistoryVisible, setInvoiceHistoryVisible] = useState(false);");
mustContain("invoice page", page, "const latestFinalizedInvoice = history.find");
mustContain("invoice page", page, "const latestInvoice = history[0] || null;");
mustContain("invoice page", page, "const finalizedInvoiceCount = history.filter");
mustContain("invoice page", page, "const draftInvoiceCount = history.filter");
mustContain("invoice page", page, "const voidedInvoiceCount = history.filter");
mustContain("invoice page", page, "Collapsed by default.");
mustContain("invoice page", page, "Show Invoice History");
mustContain("invoice page", page, "Hide Invoice History");
mustContain("invoice page", page, "setInvoiceHistoryVisible((value) => value === false)");
mustContain("invoice page", page, "invoiceHistoryVisible === false &&");
mustContain("invoice page", page, "invoiceHistoryVisible &&");
mustContain("invoice page", page, "Latest invoice:");
mustContain("invoice page", page, "Cost Balance:");
mustContain("invoice page", page, "displayedCostBalanceLedger");
mustContain("invoice page", page, "loadHistory()");

mustAvoidPattern("invoice page", page, /providerClientInvoice\.(create|update|delete|upsert)\s*\(/i, "direct ProviderClientInvoice mutation in UI");
mustAvoidPattern("invoice page", page, /matterPaymentReceipt\.(create|update|delete|upsert)\s*\(/i, "direct MatterPaymentReceipt mutation in UI");

const expected = "node scripts/verify-invoice-history-collapsed-default-safety.mjs";
if (pkg.scripts?.["verify:invoice-history-collapsed-default-safety"] === expected) {
  pass("package.json registers verify:invoice-history-collapsed-default-safety");
} else {
  fail("package.json missing verify:invoice-history-collapsed-default-safety");
}

if (failures) {
  console.error(`\nRESULT: invoice history collapsed default safety FAILED (${failures})`);
  process.exit(1);
}

console.log("\nRESULT: invoice history collapsed default safety PASSED");
