#!/usr/bin/env node
import fs from "fs";

const files = {
  schema: "prisma/schema.prisma",
  historyRoute: "app/api/admin/clients/[id]/invoice/route.ts",
  globalRoute: "app/api/admin/invoices/route.ts",
  previewRoute: "app/api/admin/clients/[id]/invoice/create-preview/route.ts",
  createRoute: "app/api/admin/clients/[id]/invoice/create/route.ts",
  detailRoute: "app/api/admin/clients/[id]/invoice/[invoiceId]/route.ts",
  finalizeRoute: "app/api/admin/clients/[id]/invoice/[invoiceId]/finalize/route.ts",
  voidRoute: "app/api/admin/clients/[id]/invoice/[invoiceId]/void/route.ts",
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

function mustNotMatch(label, body, regex, description) {
  if (regex.test(body)) fail(`${label} has forbidden ${description}`);
  else pass(`${label} avoids ${description}`);
}

for (const [label, file] of Object.entries(files)) {
  if (!fs.existsSync(file)) fail(`${label} missing at ${file}`);
}

const schema = text(files.schema);
const historyRoute = text(files.historyRoute);
const globalRoute = text(files.globalRoute);
const previewRoute = text(files.previewRoute);
const createRoute = text(files.createRoute);
const detailRoute = text(files.detailRoute);
const finalizeRoute = text(files.finalizeRoute);
const voidRoute = text(files.voidRoute);

mustContain("schema", schema, "model ProviderClientInvoiceAudit");
mustContain("schema", schema, "voidedAt");
mustContain("schema", schema, "voidReason");
mustContain("schema", schema, "auditSnapshot");

mustContain("history route", historyRoute, "provider-client-invoice-history");
mustContain("history route", historyRoute, "read-only-history");
mustContain("global route", globalRoute, "provider-client-invoice-global-search");
mustContain("global route", globalRoute, "read-only-search");

mustContain("preview route", previewRoute, "includeAlreadyInvoiced");
mustContain("preview route", previewRoute, "eligibleRemittanceRows");
mustContain("preview route", previewRoute, "excludedAlreadyInvoicedReceiptRowCount");
mustContain("preview route", previewRoute, "includedAlreadyInvoicedReceiptRowCount");

mustContain("create route", createRoute, "confirmIncludeAlreadyInvoiced");
mustContain("create route", createRoute, "invoice.draft_created");
mustContain("create route", createRoute, "providerClientInvoiceAudit.create");

mustContain("detail route", detailRoute, "auditEvents");
mustContain("detail route", detailRoute, "isVoided");

mustContain("finalize route", finalizeRoute, "invoice.finalized");
mustContain("finalize route", finalizeRoute, "invoice.finalize_repair");
mustContain("finalize route", finalizeRoute, "providerClientInvoiceAudit.create");
mustContain("finalize route", finalizeRoute, "receiptRowsMarkedWithAnotherInvoiceId");

mustContain("void route", voidRoute, "confirmVoidInvoice");
mustContain("void route", voidRoute, "invoice.voided");
mustContain("void route", voidRoute, "receiptRowsClearedOnVoid");
mustContain("void route", voidRoute, "data: { invoiceId: null }");

for (const [label, body] of [
  ["history route", historyRoute],
  ["global route", globalRoute],
  ["preview route", previewRoute],
  ["create route", createRoute],
  ["detail route", detailRoute],
  ["finalize route", finalizeRoute],
  ["void route", voidRoute],
]) {
  mustNotMatch(label, body, /from\s+["'][^"']*clio/i, "Clio import");
  mustNotMatch(label, body, /\bclioFetch\s*\(/i, "clioFetch call");
  mustNotMatch(label, body, /claimIndex\.(create|update|upsert|delete|deleteMany|updateMany)\s*\(/i, "ClaimIndex write");
}

mustNotMatch("preview route", previewRoute, /matterPaymentReceipt\.(create|update|upsert|delete|deleteMany|updateMany)\s*\(/i, "MatterPaymentReceipt write");

if (failures) {
  console.error(`\nFAILURES=${failures}`);
  process.exit(1);
}

console.log("\nPASS: provider client invoice lifecycle backend safety verifier passed");
