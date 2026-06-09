#!/usr/bin/env node
import fs from "fs";

const invoicePagePath = "app/admin/clients/[id]/invoice/page.tsx";
const packagePath = "package.json";

const invoicePage = fs.readFileSync(invoicePagePath, "utf8");
const packageJson = fs.readFileSync(packagePath, "utf8");

let failures = 0;

function pass(message) {
  console.log(`PASS: ${message}`);
}

function fail(message) {
  failures += 1;
  console.error(`FAIL: ${message}`);
}

function mustContain(label, text, needle) {
  if (text.includes(needle)) pass(`${label}: found ${needle}`);
  else fail(`${label}: missing ${needle}`);
}

function mustNotContain(label, text, needle) {
  if (text.includes(needle)) fail(`${label}: forbidden stale text present: ${needle}`);
  else pass(`${label}: does not contain ${needle}`);
}

console.log("=== VERIFY PROVIDER CLIENT INVOICE WORKFLOW SEQUENCE UI SAFETY ===");

for (const needle of [
  "Provider Client Invoice Workflow",
  "1. Preview",
  "2. Review Invoice Package",
  "3. Create Draft Invoice",
  "4. Finalize Invoice",
  "Invoice History",
  "Invoice Detail:",
  "Invoice Audit History",
  "Admin mode: include already-invoiced receipt rows for diagnostics",
  "Excluded Already Invoiced",
  "Included Already Invoiced",
  "Print / Save PDF",
  "Export CSV",
  "Global Invoice Search",
  "Draft invoice created. Receipt rows are not yet marked as invoiced.",
  "Invoice finalized. Included receipt rows are marked with this invoice ID",
  "Invoice voided. Receipt rows previously marked with this invoice ID were released",
]) {
  mustContain("invoice page", invoicePage, needle);
}

for (const needle of [
  "loadPreview",
  "createDraftInvoice",
  "finalizeInvoice",
  "voidInvoice",
  "loadHistory",
  "loadInvoiceDetail",
  "printableInvoice",
  "confirmCreateInvoiceDraft",
  "confirmFinalizeInvoice",
  "confirmVoidInvoice",
  "confirmIncludeAlreadyInvoiced",
  "includeAlreadyInvoiced",
  "receiptMarkDiagnostics",
]) {
  mustContain("invoice page", invoicePage, needle);
}

for (const needle of [
  "/invoice/create-preview",
  "/invoice/create",
  "/finalize",
  "/void",
  "/api/admin/clients/${encodeURIComponent(id)}/invoice",
]) {
  mustContain("invoice page", invoicePage, needle);
}

for (const stale of [
  "Invoice Workflow Status",
  "Create invoice record",
  "Finalize printable/exportable package",
  "providerClientInvoice.create",
  "providerClientInvoiceLine.create",
  "matterPaymentReceipt.updateMany",
]) {
  mustNotContain("invoice page", invoicePage, stale);
}

mustContain("package.json", packageJson, "verify:provider-client-invoice-workflow-sequence-ui-safety");

if (failures) {
  console.error(`\nRESULT: provider client invoice workflow sequence UI safety FAILED (${failures})`);
  process.exit(1);
}

console.log("\nPASS: provider client invoice workflow sequence UI safety passed");
