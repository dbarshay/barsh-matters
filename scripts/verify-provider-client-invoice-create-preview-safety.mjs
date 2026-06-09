#!/usr/bin/env node
import fs from "fs";

const routePath = "app/api/admin/clients/[id]/invoice/create-preview/route.ts";
const packagePath = "package.json";
const route = fs.readFileSync(routePath, "utf8");
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
  if (!regex.test(text)) pass(`${label}: does not match ${description}`);
  else fail(`${label}: matched forbidden ${description}`);
}

console.log("=== VERIFY PROVIDER CLIENT INVOICE CREATE PREVIEW SAFETY ===");

mustContain("route", route, "export async function GET");
mustContain("route", route, "provider-client-invoice-create-preview");
mustContain("route", route, 'mode: includeAlreadyInvoiced ? "read-only-preview-admin-include-already-invoiced" : "read-only-preview"');
mustContain("route", route, "includeAlreadyInvoiced");
mustContain("route", route, "Ordinary mode excludes MatterPaymentReceipt rows already assigned to an invoiceId");
mustContain("route", route, "Admin include-already-invoiced mode is diagnostic only");
mustContain("route", route, "receiptMarkDiagnostics");
mustContain("route", route, "excludedAlreadyInvoicedReceiptRowCount");
mustContain("route", route, "includedAlreadyInvoicedReceiptRowCount");
mustContain("route", route, "invoiceDraftPreview");
mustContain("route", route, "invoiceNumberCandidate");
mustContain("route", route, "status: \"draft-preview\"");
mustContain("route", route, "clientSnapshot");
mustContain("route", route, "filterSnapshot");
mustContain("route", route, "totalsSnapshot");
mustContain("route", route, "lineType: \"cost_expended\"");
mustContain("route", route, "sourceTable: \"MatterPaymentReceipt\"");
mustContain("route", route, "sourceTable: \"Lawsuit.lawsuitOptions\"");
mustContain("route", route, "retainerFeeForReceipt");
mustContain("route", route, "isFeeRecoveryTransactionType");
mustContain("route", route, "_hiddenImportFields");
mustContain("route", route, "Read-only invoice create preview");

mustNotMatch("route", route, /export\s+async\s+function\s+POST/i, "POST handler");
mustNotMatch("route", route, /providerClientInvoice\.(create|update|upsert|delete|deleteMany|updateMany)\s*\(/i, "ProviderClientInvoice write");
mustNotMatch("route", route, /providerClientInvoiceLine\.(create|update|upsert|delete|deleteMany|updateMany)\s*\(/i, "ProviderClientInvoiceLine write");
mustNotMatch("route", route, /matterPaymentReceipt\.(update|updateMany|create|upsert|delete|deleteMany)\s*\(/i, "MatterPaymentReceipt write");
mustNotMatch("route", route, /claimIndex\.(update|updateMany|create|upsert|delete|deleteMany)\s*\(/i, "ClaimIndex write");
mustNotMatch("route", route, /clioFetch|fetchClio|updateClio|from\s+["'][^"']*clio/i, "Clio operational dependency");

const pkg = JSON.parse(fs.readFileSync(packagePath, "utf8"));
const expectedScript = "node scripts/verify-provider-client-invoice-create-preview-safety.mjs";
if (pkg.scripts?.["verify:provider-client-invoice-create-preview-safety"] === expectedScript) {
  pass("package.json: verifier script registered");
} else {
  fail("package.json: verifier script is not registered");
}

if (failures) {
  console.error(`\nRESULT: provider client invoice create-preview safety FAILED (${failures})`);
  process.exit(1);
}

console.log("\nRESULT: provider client invoice create-preview safety PASSED");
