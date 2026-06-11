import fs from "fs";

const pagePath = "app/admin/clients/[id]/invoice/page.tsx";
const pkgPath = "package.json";
const page = fs.readFileSync(pagePath, "utf8");
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

function mustAvoid(label, text, needle) {
  if (!text.includes(needle)) pass(`${label}: avoids ${needle}`);
  else fail(`${label}: still contains ${needle}`);
}

function mustAvoidPattern(label, text, regex, description) {
  if (regex.test(text) === false) pass(`${label}: avoids ${description}`);
  else fail(`${label}: matched forbidden ${description}`);
}

console.log("=== VERIFY INVOICE STEP 1 CRITERIA CARD POLISH SAFETY ===");

mustContain("invoice page", page, "Step 1");
mustContain("invoice page", page, "Select Invoice Criteria");
mustContain("invoice page", page, '{loadingPreview ? "Loading Preview..." : "Preview Invoice"}');
mustContain("invoice page", page, "Select the receipt status, transaction type, and date range that should be included in the invoice preview.");
mustContain("invoice page", page, 'border: "1px solid #dbeafe"');
mustContain("invoice page", page, 'background: "#f8fbff"');
mustContain("invoice page", page, 'gridTemplateColumns: "minmax(190px, 1fr) minmax(220px, 1fr) minmax(180px, 0.9fr) minmax(180px, 0.9fr)"');
mustContain("invoice page", page, "Previewing does not create, finalize, email, print, queue, or mark invoice source rows.");
mustContain("invoice page", page, 'boxShadow: "0 2px 6px rgba(37, 99, 235, 0.25)"');
mustContain("invoice page", page, "statusFilter");
mustContain("invoice page", page, "transactionType");
mustContain("invoice page", page, "setTransactionType");
mustContain("invoice page", page, "dateFrom");
mustContain("invoice page", page, "dateTo");
mustContain("invoice page", page, "loadPreview");

mustAvoid("invoice page", page, "transactionTypeFilter");
mustAvoid("invoice page", page, "setTransactionTypeFilter");
mustAvoid("invoice page", page, "provider-client-invoice-history.csv");
mustAvoidPattern("invoice page", page, /providerClientInvoice\.(create|update|delete|upsert)\s*\(/i, "direct ProviderClientInvoice mutation in UI");
mustAvoidPattern("invoice page", page, /matterPaymentReceipt\.(create|update|delete|upsert)\s*\(/i, "direct MatterPaymentReceipt mutation in UI");

const expected = "node scripts/verify-invoice-step1-preview-card-polish-safety.mjs";
if (pkg.scripts?.["verify:invoice-step1-preview-card-polish-safety"] === expected) {
  pass("package.json registers verify:invoice-step1-preview-card-polish-safety");
} else {
  fail("package.json missing verify:invoice-step1-preview-card-polish-safety");
}

if (failures) {
  console.error(`\nRESULT: invoice Step 1 criteria card polish safety FAILED (${failures})`);
  process.exit(1);
}

console.log("\nRESULT: invoice Step 1 criteria card polish safety PASSED");
