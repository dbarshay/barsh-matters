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

function countOf(text, needle) {
  return text.split(needle).length - 1;
}

function mustAvoidPattern(label, text, regex, description) {
  if (regex.test(text) === false) pass(`${label}: avoids ${description}`);
  else fail(`${label}: matched forbidden ${description}`);
}

console.log("=== VERIFY INVOICE DRAFT ACTION MERGED INTO REVIEW SAFETY ===");

mustContain("invoice page", page, "Step 1");
mustContain("invoice page", page, "Select Invoice Criteria");
mustContain("invoice page", page, "Step 2");
mustContain("invoice page", page, "Review Invoice Preview");
mustContain("invoice page", page, "Draft Invoice Action");
mustContain("invoice page", page, "Create a draft invoice from this reviewed preview.");
mustContain("invoice page", page, "Draft invoices freeze package lines for review but do not mark receipt rows as invoiced.");
mustContain("invoice page", page, "Step 3");
mustContain("invoice page", page, "Finalize Invoice");
mustContain("invoice page", page, 'id="invoice-step-1"');
mustContain("invoice page", page, 'id="invoice-step-2"');
mustContain("invoice page", page, 'id="invoice-step-3"');
mustContain("invoice page", page, 'scrollToInvoiceSection("invoice-step-3", 200)');
mustContain("invoice page", page, "createDraftInvoice");
mustContain("invoice page", page, "creatingDraft");
mustContain("invoice page", page, "finalizeInvoice");

if (countOf(page, 'id="invoice-step-3"') === 1) {
  pass("invoice page: exactly one invoice-step-3 section exists");
} else {
  fail(`invoice page: invoice-step-3 occurs ${countOf(page, 'id="invoice-step-3"')} times`);
}

mustAvoid("invoice page", page, 'id="invoice-step-4"');
mustAvoid("invoice page", page, "Step 4");
mustAvoid("invoice page", page, 'scrollToInvoiceSection("invoice-step-4", 200)');
mustAvoid("invoice page", page, '<h2 style={{ marginTop: 0 }}>3. Create Draft Invoice</h2>');
mustAvoid("invoice page", page, "provider-client-invoice-history.csv");

mustAvoidPattern("invoice page", page, /providerClientInvoice\.(create|update|delete|upsert)\s*\(/i, "direct ProviderClientInvoice mutation in UI");
mustAvoidPattern("invoice page", page, /matterPaymentReceipt\.(create|update|delete|upsert)\s*\(/i, "direct MatterPaymentReceipt mutation in UI");

const expected = "node scripts/verify-invoice-draft-action-merged-into-review-safety.mjs";
if (pkg.scripts?.["verify:invoice-draft-action-merged-into-review-safety"] === expected) {
  pass("package.json registers verify:invoice-draft-action-merged-into-review-safety");
} else {
  fail("package.json missing verify:invoice-draft-action-merged-into-review-safety");
}

if (failures) {
  console.error(`\nRESULT: invoice draft action merged into review safety FAILED (${failures})`);
  process.exit(1);
}

console.log("\nRESULT: invoice draft action merged into review safety PASSED");
