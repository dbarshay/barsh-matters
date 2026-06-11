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

function mustAvoid(label, text, needle) {
  if (!text.includes(needle)) pass(`${label}: avoids ${needle}`);
  else fail(`${label}: still contains ${needle}`);
}

function mustAvoidPattern(label, text, regex, description) {
  if (regex.test(text) === false) pass(`${label}: avoids ${description}`);
  else fail(`${label}: matched forbidden ${description}`);
}

console.log("=== VERIFY PROVIDER CLIENT IDENTITY NOWRAP SAFETY ===");

mustContain("client page", page, "providerHubIdentityLabelStyle");
mustContain("client page", page, "providerHubIdentityValueStyle");
mustContain("client page", page, 'whiteSpace: "nowrap"');
mustContain("client page", page, 'gridTemplateColumns: "minmax(450px, 1.05fr) minmax(440px, 1fr) minmax(320px, 0.85fr)"');
mustContain("client page", page, 'gridTemplateColumns: "100px max-content"');
mustContain("client page", page, '<dt style={providerHubIdentityLabelStyle}>Name</dt>');
mustContain("client page", page, '<dt style={providerHubIdentityLabelStyle}>Address</dt>');
mustContain("client page", page, '<dt style={providerHubIdentityLabelStyle}>Status</dt>');
mustAvoid("client page", page, '<dt style={providerHubIdentityLabelStyle}>Aliases</dt>');
mustAvoid("client page", page, '<dt style={{ fontWeight: 800 }}>Aliases</dt>');
mustContain("client page", page, '<dd style={providerHubIdentityValueStyle}>');
mustContain("client page", page, 'whiteSpace: "pre"');

mustAvoidPattern("client page", page, /providerClientInvoice\.(create|update|delete|upsert)\s*\(/i, "direct ProviderClientInvoice mutation on hub page");
mustAvoidPattern("client page", page, /matterPaymentReceipt\.(create|update|delete|upsert)\s*\(/i, "direct MatterPaymentReceipt mutation on hub page");

const expected = "node scripts/verify-provider-client-identity-nowrap-safety.mjs";
if (pkg.scripts?.["verify:provider-client-identity-nowrap-safety"] === expected) {
  pass("package.json registers verify:provider-client-identity-nowrap-safety");
} else {
  fail("package.json missing verify:provider-client-identity-nowrap-safety");
}

if (failures) {
  console.error(`\nRESULT: provider/client identity nowrap safety FAILED (${failures})`);
  process.exit(1);
}

console.log("\nRESULT: provider/client identity nowrap safety PASSED");
