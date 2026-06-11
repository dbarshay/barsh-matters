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

function mustNotContain(label, text, needle) {
  if (!text.includes(needle)) pass(`${label}: avoids ${needle}`);
  else fail(`${label}: still contains ${needle}`);
}

function mustNotMatch(label, text, regex, description) {
  if (!regex.test(text)) pass(`${label}: avoids ${description}`);
  else fail(`${label}: matched forbidden ${description}`);
}

console.log("=== VERIFY INVOICE COST LEDGER COLLAPSED DEFAULT SAFETY ===");

mustContain("invoice page", page, "const [costLedgerVisible, setCostLedgerVisible] = useState(false);");
mustNotContain("invoice page", page, "const [costLedgerVisible, setCostLedgerVisible] = useState(true);");
mustContain("invoice page", page, "Open Client Costs Ledger");
mustContain("invoice page", page, "setCostLedgerVisible(true);");
mustContain("invoice page", page, "loadCostLedger();");
mustContain("invoice page", page, 'document.getElementById("client-cost-ledger")?.scrollIntoView');
mustContain("invoice page", page, "renderClientCostLedger()");
mustContain("invoice page", page, 'id="client-cost-ledger"');
mustContain("invoice page", page, "Hide Ledger");
mustContain("invoice page", page, "Show Ledger");
mustContain("invoice page", page, "Client Cost Ledger");

mustNotMatch("invoice page", page, /providerClientInvoice\.(create|update|delete|upsert)\s*\(/i, "direct ProviderClientInvoice mutation in UI");
mustNotMatch("invoice page", page, /matterPaymentReceipt\.(create|update|delete|upsert)\s*\(/i, "direct MatterPaymentReceipt mutation in UI");

const expected = "node scripts/verify-invoice-cost-ledger-collapsed-default-safety.mjs";
if (pkg.scripts?.["verify:invoice-cost-ledger-collapsed-default-safety"] === expected) {
  pass("package.json registers verify:invoice-cost-ledger-collapsed-default-safety");
} else {
  fail("package.json missing verify:invoice-cost-ledger-collapsed-default-safety");
}

if (failures) {
  console.error(`\nRESULT: invoice cost ledger collapsed default safety FAILED (${failures})`);
  process.exit(1);
}

console.log("\nRESULT: invoice cost ledger collapsed default safety PASSED");
