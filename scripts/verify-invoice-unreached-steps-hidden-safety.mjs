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

function mustAvoidPattern(label, text, regex, description) {
  if (regex.test(text) === false) pass(`${label}: avoids ${description}`);
  else fail(`${label}: matched forbidden ${description}`);
}

console.log("=== VERIFY INVOICE UNREACHED STEPS HIDDEN SAFETY ===");

mustContain("invoice page", page, '<h2 style={{ marginTop: 0 }}>1. Preview Invoice</h2>');
mustContain("invoice page", page, '<h2 style={{ marginTop: 0 }}>2. Review Invoice</h2>');
mustContain("invoice page", page, '<h2 style={{ marginTop: 0 }}>3. Create Draft Invoice</h2>');
mustContain("invoice page", page, '<h2 style={{ marginTop: 0 }}>4. Finalize Invoice</h2>');
mustContain("invoice page", page, 'display: preview ? undefined : "none"');
mustContain("invoice page", page, 'display: createdInvoice ? undefined : "none"');
mustContain("invoice page", page, "Preview Invoice");
mustContain("invoice page", page, "Create Draft Invoice");
mustContain("invoice page", page, "Finalize Invoice");
mustContain("invoice page", page, "Open Client Costs Ledger");
mustContain("invoice page", page, "Show Invoice History");
mustContain("invoice page", page, "Client Cost Ledger");

mustAvoidPattern("invoice page", page, /providerClientInvoice\.(create|update|delete|upsert)\s*\(/i, "direct ProviderClientInvoice mutation in UI");
mustAvoidPattern("invoice page", page, /matterPaymentReceipt\.(create|update|delete|upsert)\s*\(/i, "direct MatterPaymentReceipt mutation in UI");

const expected = "node scripts/verify-invoice-unreached-steps-hidden-safety.mjs";
if (pkg.scripts?.["verify:invoice-unreached-steps-hidden-safety"] === expected) {
  pass("package.json registers verify:invoice-unreached-steps-hidden-safety");
} else {
  fail("package.json missing verify:invoice-unreached-steps-hidden-safety");
}

if (failures) {
  console.error(`\nRESULT: invoice unreached steps hidden safety FAILED (${failures})`);
  process.exit(1);
}

console.log("\nRESULT: invoice unreached steps hidden safety PASSED");
