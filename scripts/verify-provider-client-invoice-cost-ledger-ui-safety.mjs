#!/usr/bin/env node
import fs from "fs";

const pagePath = "app/admin/clients/[id]/invoice/page.tsx";
const routePath = "app/api/admin/clients/[id]/invoice/cost-ledger/route.ts";
const pkgPath = "package.json";

const page = fs.readFileSync(pagePath, "utf8");
const route = fs.readFileSync(routePath, "utf8");
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

function mustNotMatch(label, text, regex, description) {
  if (!regex.test(text)) pass(`${label}: avoids ${description}`);
  else fail(`${label}: matched forbidden ${description}`);
}

console.log("=== VERIFY PROVIDER CLIENT INVOICE COST LEDGER UI SAFETY ===");

mustContain("page", page, "Client Cost Ledger");
mustContain("page", page, "loadCostLedger");
mustContain("page", page, "/invoice/cost-ledger");
mustContain("page", page, "renderClientCostLedger()");
mustContain("page", page, "Eligible for Future Invoice");
mustContain("page", page, "Date Incurred");
mustContain("page", page, "Posted Date");
mustContain("page", page, "Invoice Status");
mustContain("page", page, "Export CSV");

mustContain("route", route, "provider-client-invoice-cost-ledger");
mustContain("route", route, "read-only-cost-ledger");
mustContain("route", route, "cost_expended");
mustContain("route", route, "cost_received");
mustContain("route", route, "eligibleForFutureInvoice");
mustContain("route", route, "invoiceStatus");
mustContain("route", route, "Lawsuit.lawsuitOptions");
mustContain("route", route, "MatterPaymentReceipt");
mustContain("route", route, "Read-only provider/client invoice cost ledger");

mustNotMatch("route", route, /providerClientInvoice\.(create|update|upsert|delete|deleteMany|updateMany)\s*\(/i, "ProviderClientInvoice mutation");
mustNotMatch("route", route, /providerClientInvoiceLine\.(create|update|upsert|delete|deleteMany|updateMany)\s*\(/i, "ProviderClientInvoiceLine mutation");
mustNotMatch("route", route, /matterPaymentReceipt\.(update|updateMany|create|upsert|delete|deleteMany)\s*\(/i, "MatterPaymentReceipt mutation");
mustNotMatch("route", route, /claimIndex\.(update|updateMany|create|upsert|delete|deleteMany)\s*\(/i, "ClaimIndex mutation");
mustNotMatch("route", route, /clioFetch|fetchClio|updateClio|from\s+["'][^"']*clio/i, "Clio operational dependency");

const expectedScript = "node scripts/verify-provider-client-invoice-cost-ledger-ui-safety.mjs";
if (pkg.scripts?.["verify:provider-client-invoice-cost-ledger-ui-safety"] === expectedScript) {
  pass("package.json registers verify:provider-client-invoice-cost-ledger-ui-safety");
} else {
  fail("package.json missing verify:provider-client-invoice-cost-ledger-ui-safety registration");
}

if (failures) {
  console.error(`\nRESULT: provider client invoice cost ledger UI safety FAILED (${failures})`);
  process.exit(1);
}

console.log("\nRESULT: provider client invoice cost ledger UI safety PASSED");
