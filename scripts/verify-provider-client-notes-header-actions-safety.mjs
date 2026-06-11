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

console.log("=== VERIFY PROVIDER CLIENT NOTES HEADER ACTIONS SAFETY ===");

mustContain("client page", page, "Account Notes");
mustContain("client page", page, 'editingField !== "notes"');
mustContain("client page", page, "startAddNote");
mustContain("client page", page, "startEditNotes");
mustContain("client page", page, "Add Note");
mustContain("client page", page, "Edit Notes");
mustContain("client page", page, 'padding: "3px 8px"');
mustContain("client page", page, "fontSize: 12");
mustContain("client page", page, "lineHeight: 1.1");
mustContain("client page", page, "Save New Note");
mustContain("client page", page, "Save Note Edits");
mustContain("client page", page, "deleteEditableNote");

mustAvoidPattern("client page", page, /<div style=\{\{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" \}\}>\s*<button type="button" onClick=\{startAddNote\}/s, "old lower Add/Edit notes action row");
mustAvoidPattern("client page", page, /providerClientInvoice\.(create|update|delete|upsert)\s*\(/i, "direct ProviderClientInvoice mutation on hub page");
mustAvoidPattern("client page", page, /matterPaymentReceipt\.(create|update|delete|upsert)\s*\(/i, "direct MatterPaymentReceipt mutation on hub page");

const expected = "node scripts/verify-provider-client-notes-header-actions-safety.mjs";
if (pkg.scripts?.["verify:provider-client-notes-header-actions-safety"] === expected) {
  pass("package.json registers verify:provider-client-notes-header-actions-safety");
} else {
  fail("package.json missing verify:provider-client-notes-header-actions-safety");
}

if (failures) {
  console.error(`\nRESULT: provider/client notes header actions safety FAILED (${failures})`);
  process.exit(1);
}

console.log("\nRESULT: provider/client notes header actions safety PASSED");
