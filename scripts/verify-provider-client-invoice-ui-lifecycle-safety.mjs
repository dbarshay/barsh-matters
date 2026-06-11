#!/usr/bin/env node
import fs from "fs";

const invoicePage = fs.readFileSync("app/admin/clients/[id]/invoice/page.tsx", "utf8");
const globalPage = fs.readFileSync("app/admin/invoices/page.tsx", "utf8");
const clientPage = fs.readFileSync("app/admin/clients/[id]/page.tsx", "utf8");
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));

let failures = 0;

function pass(message) {
  console.log(`PASS: ${message}`);
}

function fail(message) {
  console.error(`FAIL: ${message}`);
  failures += 1;
}

function mustContain(label, text, needle) {
  if (text.includes(needle)) pass(`${label} contains ${needle}`);
  else fail(`${label} missing ${needle}`);
}

function mustNotContain(label, text, needle) {
  if (!text.includes(needle)) pass(`${label} avoids ${needle}`);
  else fail(`${label} unexpectedly contains ${needle}`);
}

function mustAvoidPattern(label, text, regex, description) {
  if (!regex.test(text)) pass(`${label} avoids ${description}`);
  else fail(`${label} matched forbidden ${description}`);
}

console.log("\n=== VERIFY PROVIDER CLIENT INVOICE UI LIFECYCLE ===");

for (const needle of [
  "Provider Client Invoice Workflow",
  "ProviderInfoItem",
  "providerIdentityRows",
  "normalizeAddressDisplay",
  "normalizeAddressLineDisplay",
  "titleCaseAddressSegment",
  "providerPercentageRows",
  "providerBillingRows",
  "compactInfoGroupStyle",
  "filterControlStyle",
  "Transaction Type",
  '<option value="">All</option>',
  ">Posted</option>",
  ">Voided</option>",
  "Review Invoice",
  "Principal / Interest Received",
  "Costs Received",
  "Fees and Costs Expended",
  "principalInterestPaymentCount",
  "costsReceivedPaymentCount",
  "feesCostsExpendedCount",
  "feesCostsExpendedTotal",
  "Invoice History",
  "Invoice Detail:",
  "Invoice Audit History",
  "Print / Save PDF",
  'window.open("about:blank", "_blank")',
  "popup.document.open()",
  "popup.focus()",
  "confirmCreateInvoiceDraft",
  "confirmFinalizeInvoice",
  "confirmVoidInvoice",
  "/api/admin/clients/${encodeURIComponent(id)}/invoice/create-preview",
  "/api/admin/clients/${encodeURIComponent(id)}/invoice/create",
  "/api/admin/clients/${encodeURIComponent(id)}/invoice/${encodeURIComponent(invoiceId)}/finalize",
  "/api/admin/clients/${encodeURIComponent(id)}/invoice/${encodeURIComponent(invoiceId)}/void",
  "Draft invoice created. Receipt rows are not yet marked as invoiced.",
  "Invoice finalized. Included receipt rows are marked with this invoice ID",
  "Invoice voided. Receipt rows previously marked with this invoice ID were released",
]) {
  mustContain("invoice page", invoicePage, needle);
}

console.log("\n=== VERIFY GLOBAL INVOICE SEARCH UI ===");
for (const needle of [
  "Global Invoice Search",
  "Provider-Level Reporting",
  "/api/admin/invoices?",
  "Client Invoice Page",
]) {
  mustContain("global page", globalPage, needle);
}

mustContain("client page", clientPage, "Global Invoice Search");

for (const stale of [
  "Provider / Client Info",
  "Posting Context",
  "Active/Admin preview",
  "Filing Fee Collected",
  "Other Court Fees Collected",
]) {
  mustNotContain("invoice page stale UI copy", invoicePage, stale);
}

mustAvoidPattern("invoice page", invoicePage, /providerClientInvoice\.(create|update|delete|upsert)\s*\(/i, "direct ProviderClientInvoice mutation in UI");
mustAvoidPattern("invoice page", invoicePage, /matterPaymentReceipt\.(create|update|delete|upsert)\s*\(/i, "direct MatterPaymentReceipt mutation in UI");

if (pkg.scripts?.["verify:provider-client-invoice-ui-lifecycle-safety"] !== "node scripts/verify-provider-client-invoice-ui-lifecycle-safety.mjs") {
  fail("package.json missing verify:provider-client-invoice-ui-lifecycle-safety");
} else {
  pass("package.json registers provider client invoice UI lifecycle verifier");
}

console.log(`\nFAILURES=${failures}`);
if (failures) process.exit(1);
console.log("PASS: provider client invoice UI lifecycle safety passed.");
