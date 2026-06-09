#!/usr/bin/env node
import fs from "fs";

const pagePath = "app/admin/clients/[id]/invoice/page.tsx";
const packagePath = "package.json";
const page = fs.readFileSync(pagePath, "utf8");
const pkg = JSON.parse(fs.readFileSync(packagePath, "utf8"));

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
  if (!text.includes(needle)) pass(`${label}: does not contain ${needle}`);
  else fail(`${label}: still contains ${needle}`);
}

console.log("=== VERIFY PROVIDER CLIENT INVOICE DRAFT PREVIEW UI SAFETY ===");

for (const needle of [
  "preview",
  "loadingPreview",
  "loadPreview",
  "/invoice/create-preview?",
  "Review Invoice Package",
  "Invoice Candidate",
  "Receipt Rows",
  "Excluded Already Invoiced",
  "Included Already Invoiced",
  "Package Total",
  "Retainer Fee",
  "receiptMarkDiagnostics",
  "includeAlreadyInvoiced",
  "Admin mode: include already-invoiced receipt rows for diagnostics",
  "Admin review mode is active. Already-invoiced receipt rows may be included.",
  "No eligible invoice lines in this preview.",
]) {
  mustContain("invoice page", page, needle);
}

for (const needle of [
  "createDraftInvoice",
  "confirmCreateInvoiceDraft",
  "confirmIncludeAlreadyInvoiced",
  "Draft invoice created. Receipt rows are not yet marked as invoiced.",
]) {
  mustContain("invoice page", page, needle);
}

for (const stale of [
  "providerClientInvoice.create",
  "providerClientInvoiceLine.create",
  "matterPaymentReceipt.updateMany",
  "Create Invoice is enabled",
  "Invoice Workflow Status",
  "Finalize printable/exportable package",
]) {
  mustNotContain("invoice page", page, stale);
}

const expectedScript = "node scripts/verify-provider-client-invoice-draft-preview-ui-safety.mjs";
if (pkg.scripts?.["verify:provider-client-invoice-draft-preview-ui-safety"] === expectedScript) {
  pass("package.json: verifier script registered");
} else {
  fail("package.json: verifier script is not registered");
}

if (failures) {
  console.error(`\nRESULT: provider client invoice draft-preview UI safety FAILED (${failures})`);
  process.exit(1);
}

console.log("\nPASS: provider client invoice draft-preview UI safety passed");
