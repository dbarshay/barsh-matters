#!/usr/bin/env node
import fs from "fs";

const previewPath = "app/api/admin/clients/[id]/invoice/create-preview/route.ts";
const finalizePath = "app/api/admin/clients/[id]/invoice/[invoiceId]/finalize/route.ts";
const voidPath = "app/api/admin/clients/[id]/invoice/[invoiceId]/void/route.ts";
const pkgPath = "package.json";

const preview = fs.readFileSync(previewPath, "utf8");
const finalize = fs.readFileSync(finalizePath, "utf8");
const voidRoute = fs.readFileSync(voidPath, "utf8");
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

console.log("=== VERIFY PROVIDER CLIENT INVOICE COST EXPENDED REINVOICE SAFETY ===");

mustContain("preview route", preview, "finalizedCostLineMarks");
mustContain("preview route", preview, "providerClientInvoiceLine.findMany");
mustContain("preview route", preview, 'lineType: "cost_expended"');
mustContain("preview route", preview, 'sourceTable: "Lawsuit.lawsuitOptions"');
mustContain("preview route", preview, 'status: "finalized"');
mustContain("preview route", preview, "voidedAt: null");
mustContain("preview route", preview, "eligibleCostsExpendedRows");
mustContain("preview route", preview, "excludedAlreadyInvoicedCostRows");
mustContain("preview route", preview, "const costLines = eligibleCostsExpendedRows.map((row: any) => costLine(row))");
mustContain("preview route", preview, "excludedAlreadyInvoicedCostExpendedRowCount");
mustContain("preview route", preview, "excludedCostExpendedDetails");
mustContain("preview route", preview, "cost-expended rows already frozen into finalized non-voided invoice lines");

mustContain("finalize route", finalize, "data: { invoiceId: invoice.id }");
mustContain("finalize route", finalize, "receiptRowsMarkedWithThisInvoiceId");
mustContain("finalize route", finalize, "does not mutate Clio, ClaimIndex, source costs, documents, email, print, queue");
mustContain("void route", voidRoute, "data: { invoiceId: null }");
mustContain("void route", voidRoute, "receiptRowsClearedOnVoid");
mustContain("void route", voidRoute, "Only finalized invoices can be voided");

mustNotMatch("preview route", preview, /matterPaymentReceipt\.(update|updateMany|create|upsert|delete|deleteMany)\s*\(/i, "MatterPaymentReceipt mutation in preview");
mustNotMatch("preview route", preview, /claimIndex\.(update|updateMany|create|upsert|delete|deleteMany)\s*\(/i, "ClaimIndex mutation in preview");
mustNotMatch("preview route", preview, /clioFetch|fetchClio|updateClio|from\s+["'][^"']*clio/i, "Clio operational dependency");

const expectedScript = "node scripts/verify-provider-client-invoice-cost-expended-reinvoice-safety.mjs";
if (pkg.scripts?.["verify:provider-client-invoice-cost-expended-reinvoice-safety"] === expectedScript) {
  pass("package.json registers verify:provider-client-invoice-cost-expended-reinvoice-safety");
} else {
  fail("package.json missing verify:provider-client-invoice-cost-expended-reinvoice-safety registration");
}

if (failures) {
  console.error(`\nRESULT: provider client invoice cost expended reinvoice safety FAILED (${failures})`);
  process.exit(1);
}

console.log("\nRESULT: provider client invoice cost expended reinvoice safety PASSED");
