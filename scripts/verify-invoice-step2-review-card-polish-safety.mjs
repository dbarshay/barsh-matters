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

console.log("=== VERIFY INVOICE STEP 2 REVIEW CARD POLISH SAFETY ===");

mustContain("invoice page", page, "Step 2");
mustContain("invoice page", page, "Review Invoice Preview");
mustContain("invoice page", page, "Confirm the previewed receipt rows");
mustContain("invoice page", page, 'gridTemplateColumns: "repeat(4, minmax(190px, 1fr))"');
mustContain("invoice page", page, "Principal / Interest");
mustContain("invoice page", page, "Costs Received");
mustContain("invoice page", page, "Costs Expended");
mustContain("invoice page", page, "Final Net Remit");
mustContain("invoice page", page, "Cost balance after:");
mustContain("invoice page", page, 'border: "1px solid #dbeafe"');
mustContain("invoice page", page, 'background: "#f8fbff"');
mustContain("invoice page", page, "renderPreviewLineTable(");
mustContain("invoice page", page, "renderCostBalanceSummary(previewTotals)");
mustContain("invoice page", page, "principalInterestPaymentTotal");
mustContain("invoice page", page, "costsReceivedPaymentTotal");
mustContain("invoice page", page, "feesCostsExpendedTotal");
mustContain("invoice page", page, "previewTotals.netRemitToProviderTotal");
mustContain("invoice page", page, "previewTotals.costBalanceLedgerAfter");

mustAvoid("invoice page", page, "provider-client-invoice-history.csv");
mustAvoidPattern("invoice page", page, /providerClientInvoice\.(create|update|delete|upsert)\s*\(/i, "direct ProviderClientInvoice mutation in UI");
mustAvoidPattern("invoice page", page, /matterPaymentReceipt\.(create|update|delete|upsert)\s*\(/i, "direct MatterPaymentReceipt mutation in UI");

const expected = "node scripts/verify-invoice-step2-review-card-polish-safety.mjs";
if (pkg.scripts?.["verify:invoice-step2-review-card-polish-safety"] === expected) {
  pass("package.json registers verify:invoice-step2-review-card-polish-safety");
} else {
  fail("package.json missing verify:invoice-step2-review-card-polish-safety");
}

if (failures) {
  console.error(`\nRESULT: invoice Step 2 review card polish safety FAILED (${failures})`);
  process.exit(1);
}

console.log("\nRESULT: invoice Step 2 review card polish safety PASSED");
