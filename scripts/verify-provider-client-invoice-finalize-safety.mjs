#!/usr/bin/env node
import fs from "fs";

const routePath = "app/api/admin/clients/[id]/invoice/[invoiceId]/finalize/route.ts";
const pagePath = "app/admin/clients/[id]/invoice/page.tsx";
const packagePath = "package.json";

const route = fs.readFileSync(routePath, "utf8");
const page = fs.readFileSync(pagePath, "utf8");
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

console.log("=== VERIFY PROVIDER CLIENT INVOICE FINALIZE SAFETY ===");

mustContain("route", route, "export async function POST");
mustContain("route", route, "confirmFinalizeInvoice");
mustContain("route", route, "provider-client-invoice-finalize");
mustContain("route", route, "mode: result.isReceiptMarkRepair ? \"local-finalized-receipt-mark-repair\" : \"local-finalized\"");
mustContain("route", route, "status !== \"draft\"");
mustContain("route", route, "status: \"finalized\"");
mustContain("route", route, "finalizedAt");
mustContain("route", route, "matterPaymentReceipt.updateMany");
mustContain("route", route, "invoiceId: null");
mustContain("route", route, 'invoiceId: ""');
mustContain("route", route, "isReceiptMarkRepair");
mustContain("route", route, "local-finalized-receipt-mark-repair");
mustContain("route", route, "treating null and empty invoiceId as unmarked");
mustContain("route", route, "data: { invoiceId: invoice.id }");
mustContain("route", route, "does not mutate Clio, ClaimIndex, source costs, documents, email, print, queue");
mustContain("route", route, "receiptRowsMarkedWithThisInvoiceId");
mustContain("route", route, "isFinalized");

mustNotMatch("route", route, /claimIndex\.(update|updateMany|create|upsert|delete|deleteMany)\s*\(/i, "ClaimIndex mutation");
mustNotMatch("route", route, /providerClientInvoiceLine\.(create|update|upsert|delete|deleteMany|updateMany)\s*\(/i, "ProviderClientInvoiceLine mutation");
mustNotMatch("route", route, /clioFetch|fetchClio|updateClio|from\s+["'][^"']*clio/i, "Clio operational dependency");
mustNotMatch("route", route, /sendEmail|printQueue|generateDocument|finalizeDocument/i, "external output action");

mustContain("invoice page", page, "finalizeInvoice");
mustContain("invoice page", page, "/finalize");
mustContain("invoice page", page, "confirmFinalizeInvoice: true");
mustContain("invoice page", page, "window.confirm");
mustContain("invoice page", page, "Invoice finalized. Included receipt rows are marked with this invoice ID");
mustContain("invoice page", page, "Included receipt rows are now marked with this invoice ID and excluded from future invoice previews by default.");
mustContain("invoice page", page, "disabled={!createdInvoice || createdInvoice?.status !== \"draft\" || finalizing}");
mustContain("invoice page", page, "4. Finalize Invoice");

mustNotMatch("invoice page", page, /providerClientInvoice\.(create|update|upsert|delete|deleteMany|updateMany)\s*\(/i, "direct ProviderClientInvoice mutation in UI");
mustNotMatch("invoice page", page, /matterPaymentReceipt\.(update|updateMany|create|upsert|delete|deleteMany)\s*\(/i, "direct MatterPaymentReceipt mutation in UI");

const pkg = JSON.parse(fs.readFileSync(packagePath, "utf8"));
const expectedScript = "node scripts/verify-provider-client-invoice-finalize-safety.mjs";
if (pkg.scripts?.["verify:provider-client-invoice-finalize-safety"] === expectedScript) {
  pass("package.json: verifier script registered");
} else {
  fail("package.json: verifier script is not registered");
}

if (failures) {
  console.error(`\nRESULT: provider client invoice finalize safety FAILED (${failures})`);
  process.exit(1);
}

console.log("\nRESULT: provider client invoice finalize safety PASSED");
