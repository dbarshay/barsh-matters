import fs from "fs";

const pagePath = "app/admin/clients/[id]/page.tsx";
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

console.log("=== VERIFY PROVIDER CLIENT NOTES EYEBROW REMOVED SAFETY ===");

mustContain("client page", page, "Account Notes");
mustContain("client page", page, "Add Note");
mustContain("client page", page, "Edit Notes");
mustContain("client page", page, "Save New Note");
mustContain("client page", page, "Save Note Edits");
mustContain("client page", page, "deleteEditableNote");

mustAvoidPattern("client page", page, /<div style=\{providerHubHeaderLabelStyle\}>\s*Notes\s*<\/div>/s, "visible Notes eyebrow label");
mustAvoidPattern("client page", page, /providerClientInvoice\.(create|update|delete|upsert)\s*\(/i, "direct ProviderClientInvoice mutation on hub page");
mustAvoidPattern("client page", page, /matterPaymentReceipt\.(create|update|delete|upsert)\s*\(/i, "direct MatterPaymentReceipt mutation on hub page");

const expected = "node scripts/verify-provider-client-notes-eyebrow-removed-safety.mjs";
if (pkg.scripts?.["verify:provider-client-notes-eyebrow-removed-safety"] === expected) {
  pass("package.json registers verify:provider-client-notes-eyebrow-removed-safety");
} else {
  fail("package.json missing verify:provider-client-notes-eyebrow-removed-safety");
}

if (failures) {
  console.error(`\nRESULT: provider/client notes eyebrow removed safety FAILED (${failures})`);
  process.exit(1);
}

console.log("\nRESULT: provider/client notes eyebrow removed safety PASSED");
