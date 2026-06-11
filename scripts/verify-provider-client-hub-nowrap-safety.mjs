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

console.log("=== VERIFY PROVIDER CLIENT HUB NOWRAP SAFETY ===");

mustContain("client page", page, "providerHubNoWrapLabelStyle");
mustContain("client page", page, "providerHubNoWrapValueStyle");
mustContain("client page", page, 'whiteSpace: "nowrap"');
mustContain("client page", page, 'gridTemplateColumns: "minmax(330px, 0.95fr) minmax(460px, 1.2fr) minmax(320px, 0.9fr)"');
mustContain("client page", page, 'gridTemplateColumns: "205px max-content"');
mustContain("client page", page, '<dt style={providerHubNoWrapLabelStyle}>Owner</dt>');
mustContain("client page", page, '<dt style={providerHubNoWrapLabelStyle}>Provider Group</dt>');
mustContain("client page", page, '<dt style={providerHubNoWrapLabelStyle}>Retainer NF Principal</dt>');
mustContain("client page", page, '<dd style={providerHubNoWrapValueStyle}>');

mustAvoidPattern("client page", page, /providerClientInvoice\.(create|update|delete|upsert)\s*\(/i, "direct ProviderClientInvoice mutation on hub page");
mustAvoidPattern("client page", page, /matterPaymentReceipt\.(create|update|delete|upsert)\s*\(/i, "direct MatterPaymentReceipt mutation on hub page");

const expected = "node scripts/verify-provider-client-hub-nowrap-safety.mjs";
if (pkg.scripts?.["verify:provider-client-hub-nowrap-safety"] === expected) {
  pass("package.json registers verify:provider-client-hub-nowrap-safety");
} else {
  fail("package.json missing verify:provider-client-hub-nowrap-safety");
}

if (failures) {
  console.error(`\nRESULT: provider/client hub nowrap safety FAILED (${failures})`);
  process.exit(1);
}

console.log("\nRESULT: provider/client hub nowrap safety PASSED");
