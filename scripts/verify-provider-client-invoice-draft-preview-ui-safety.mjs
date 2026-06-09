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
  "Review Invoice",
  "Retainer Fee",
  "receiptMarkDiagnostics",
]) {
  mustContain("invoice page", page, needle);
}

for (const needle of [
  "Principal / Interest Received",
  "Costs Received",
  "Fees and Costs Expended",
  "No principal or interest payments in this preview.",
  "No cost payments received in this preview.",
  "No fees or costs expended in this preview.",
  "previewLineDisplayType",
  "Index Fee",
  "Service Fee",
  "Other Court Costs",
  "<tfoot>",
  "colSpan={activeColumns.length}",
  "previewTableSort",
  "setPreviewTableSort",
  "sortPreviewLines",
  "togglePreviewTableSort",
  "activeSort.direction",
  "Remit to Provider",
  "previewRemitToProvider",
  "showRemitToProvider",
  "remitTotal",
  "isCostsReceivedTable",
  "showBilledAndRetainerColumns",
  "hideForCostsReceived: true",
  "colSpan={isCostsReceivedTable ? activeColumns.length - 1 : 11}",
]) {
  mustContain("invoice page", page, needle);
}

mustNotContain("invoice page", page, "No eligible invoice lines in this preview.");
mustNotContain("invoice page", page, "Other Court Fees Collected");

for (const needle of [
  "createDraftInvoice",
  "confirmCreateInvoiceDraft",
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

if (page.includes("Admin mode: include already-invoiced receipt rows for diagnostics") || page.includes("Admin review mode is active") || page.includes("includeAlreadyInvoiced") || page.includes("confirmIncludeAlreadyInvoiced") || page.includes('<option value="active">active</option>')) {
  console.error("FAIL: invoice page still contains Active/Admin preview UI remnants");
  failures += 1;
} else {
  console.log("PASS: invoice page Active/Admin preview UI removed");
}

if (page.includes("includeAlreadyInvoiced") || page.includes("confirmIncludeAlreadyInvoiced") || page.includes("Admin mode: include already-invoiced receipt rows for diagnostics") || page.includes("Admin review mode is active")) {
  console.error("FAIL: invoice page still contains removed admin include-already-invoiced draft-preview UI");
  failures += 1;
} else {
  console.log("PASS: invoice page removed admin include-already-invoiced draft-preview UI");
}

mustContain("invoice page", page, "Review Invoice");
mustContain("invoice page", page, "Number of Principal / Interest Payments Received");
mustContain("invoice page", page, "Number of Costs Payments Received");
mustContain("invoice page", page, "principalInterestPaymentCount");
mustContain("invoice page", page, "principalInterestPaymentTotal");
mustContain("invoice page", page, "costPaymentCount");
mustContain("invoice page", page, "costPaymentTotal");

if (page.includes("Receipt Rows") || page.includes("Excluded Already Invoiced") || page.includes("Included Already Invoiced") || page.includes("Package Total") || page.includes("Invoice Candidate")) {
  console.error("FAIL: invoice page still contains removed old review summary labels");
  failures += 1;
} else {
  console.log("PASS: invoice page old review summary labels removed");
}

if (failures) {
  console.error(`\nRESULT: provider client invoice draft-preview UI safety FAILED (${failures})`);
  process.exit(1);
}

console.log("\nPASS: provider client invoice draft-preview UI safety passed");
