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

console.log("=== VERIFY INVOICE STEP 4 FINALIZE CARD SCROLL SAFETY ===");

mustContain("invoice page", page, "function scrollToInvoiceSection");
mustContain("invoice page", page, 'id="invoice-step-1"');
mustContain("invoice page", page, 'id="invoice-step-2"');
mustContain("invoice page", page, 'id="invoice-step-3"');
mustContain("invoice page", page, 'id="invoice-step-4"');
mustContain("invoice page", page, 'id="invoice-detail"');
mustContain("invoice page", page, 'scrollToInvoiceSection("invoice-step-2", 200)');
mustContain("invoice page", page, 'scrollToInvoiceSection("invoice-step-4", 200)');
mustContain("invoice page", page, 'scrollToInvoiceSection("invoice-detail", 200)');
mustContain("invoice page", page, "Step 4");
mustContain("invoice page", page, "Finalize Invoice");
mustContain("invoice page", page, "Finalization Action");
mustContain("invoice page", page, "Convert the draft invoice into a finalized invoice package.");
mustContain("invoice page", page, "Finalization marks included MatterPaymentReceipt rows");
mustContain("invoice page", page, 'border: "1px solid #bbf7d0"');
mustContain("invoice page", page, 'background: "#f0fdf4"');
mustContain("invoice page", page, 'boxShadow: createdInvoice?.status === "draft" ? "0 2px 6px rgba(22, 101, 52, 0.25)" : undefined');
mustContain("invoice page", page, "finalizeInvoice()");
mustContain("invoice page", page, "finalizing");

mustAvoid("invoice page", page, "provider-client-invoice-history.csv");
mustAvoidPattern("invoice page", page, /providerClientInvoice\.(create|update|delete|upsert)\s*\(/i, "direct ProviderClientInvoice mutation in UI");
mustAvoidPattern("invoice page", page, /matterPaymentReceipt\.(create|update|delete|upsert)\s*\(/i, "direct MatterPaymentReceipt mutation in UI");

const expected = "node scripts/verify-invoice-step4-finalize-card-scroll-safety.mjs";
if (pkg.scripts?.["verify:invoice-step4-finalize-card-scroll-safety"] === expected) {
  pass("package.json registers verify:invoice-step4-finalize-card-scroll-safety");
} else {
  fail("package.json missing verify:invoice-step4-finalize-card-scroll-safety");
}

if (failures) {
  console.error(`\nRESULT: invoice Step 4 finalize card scroll safety FAILED (${failures})`);
  process.exit(1);
}

console.log("\nRESULT: invoice Step 4 finalize card scroll safety PASSED");
