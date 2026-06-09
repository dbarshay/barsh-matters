#!/usr/bin/env node
import fs from "fs";

const files = {
  invoicePage: "app/admin/clients/[id]/invoice/page.tsx",
  globalPage: "app/admin/invoices/page.tsx",
  clientPage: "app/admin/clients/[id]/page.tsx",
};

let failures = 0;

function text(file) {
  return fs.readFileSync(file, "utf8");
}

function pass(message) {
  console.log(`PASS: ${message}`);
}

function fail(message) {
  failures += 1;
  console.error(`FAIL: ${message}`);
}

function mustContain(label, body, needle) {
  if (body.includes(needle)) pass(`${label} contains ${needle}`);
  else fail(`${label} missing ${needle}`);
}

for (const [label, file] of Object.entries(files)) {
  if (!fs.existsSync(file)) fail(`${label} missing at ${file}`);
}

const invoicePage = text(files.invoicePage);
const globalPage = text(files.globalPage);
const clientPage = text(files.clientPage);

console.log("");
console.log("=== VERIFY PROVIDER CLIENT INVOICE UI LIFECYCLE ===");
mustContain("invoice page", invoicePage, "Provider Client Invoice Workflow");
mustContain("invoice page", invoicePage, "1. Preview");
mustContain("invoice page", invoicePage, "2. Review Invoice Package");
mustContain("invoice page", invoicePage, "3. Create Draft Invoice");
mustContain("invoice page", invoicePage, "4. Finalize Invoice");
mustContain("invoice page", invoicePage, "Invoice History");
mustContain("invoice page", invoicePage, "Invoice Detail:");
mustContain("invoice page", invoicePage, "Invoice Audit History");
mustContain("invoice page", invoicePage, "Admin mode: include already-invoiced receipt rows for diagnostics");
mustContain("invoice page", invoicePage, "Excluded Already Invoiced");
mustContain("invoice page", invoicePage, "Included Already Invoiced");
mustContain("invoice page", invoicePage, "Print / Save PDF");
mustContain("invoice page", invoicePage, "confirmCreateInvoiceDraft");
mustContain("invoice page", invoicePage, "confirmFinalizeInvoice");
mustContain("invoice page", invoicePage, "confirmVoidInvoice");
mustContain("invoice page", invoicePage, "includeAlreadyInvoiced");
mustContain("invoice page", invoicePage, "/api/admin/clients/${encodeURIComponent(id)}/invoice/create-preview");
mustContain("invoice page", invoicePage, "/api/admin/clients/${encodeURIComponent(id)}/invoice/create");
mustContain("invoice page", invoicePage, "/api/admin/clients/${encodeURIComponent(id)}/invoice/${encodeURIComponent(invoiceId)}/finalize");
mustContain("invoice page", invoicePage, "/api/admin/clients/${encodeURIComponent(id)}/invoice/${encodeURIComponent(invoiceId)}/void");
mustContain("invoice page", invoicePage, "Draft invoice created. Receipt rows are not yet marked as invoiced.");
mustContain("invoice page", invoicePage, "Invoice finalized. Included receipt rows are marked with this invoice ID");
mustContain("invoice page", invoicePage, "Invoice voided. Receipt rows previously marked with this invoice ID were released");

console.log("");
console.log("=== VERIFY GLOBAL INVOICE SEARCH UI ===");
mustContain("global page", globalPage, "Global Invoice Search");
mustContain("global page", globalPage, "Provider-Level Reporting");
mustContain("global page", globalPage, "/api/admin/invoices?");
mustContain("global page", globalPage, "Client Invoice Page");
mustContain("client page", clientPage, "Global Invoice Search");

if (failures) {
  console.error(`\nFAILURES=${failures}`);
  process.exit(1);
}

console.log("\nPASS: provider client invoice UI lifecycle verifier passed");
