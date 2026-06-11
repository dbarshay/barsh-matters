import fs from "fs";

const historyPagePath = "app/admin/clients/[id]/invoice/history/page.tsx";
const voidRoutePath = "app/api/admin/clients/[id]/invoice/[invoiceId]/void/route.ts";
const pkgPath = "package.json";

const historyPage = fs.readFileSync(historyPagePath, "utf8");
const voidRoute = fs.readFileSync(voidRoutePath, "utf8");
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

console.log("=== VERIFY INVOICE HISTORY ACTIONS SAFETY ===");

mustContain("history page", historyPage, "async function finalizeInvoice(invoice: any)");
mustContain("history page", historyPage, "async function voidInvoice(invoice: any)");
mustContain("history page", historyPage, "confirmFinalizeInvoice: true");
mustContain("history page", historyPage, "confirmVoidInvoice: true");
mustContain("history page", historyPage, "Voided from client invoice history page");
mustContain("history page", historyPage, "<th style={thStyle}>Actions</th>");
mustContain("history page", historyPage, 'invoice.status === "draft"');
mustContain("history page", historyPage, 'invoice.status === "draft" || invoice.status === "finalized"');
mustContain("history page", historyPage, "Finalize");
mustContain("history page", historyPage, "Void");
mustContain("history page", historyPage, 'border: "1px solid #991b1b"');
mustContain("history page", historyPage, 'background: "#991b1b"');
mustContain("history page", historyPage, 'color: "#ffffff"');
mustContain("history page", historyPage, "actionBusyInvoiceId");
mustContain("history page", historyPage, "colSpan={15}");

mustContain("void route", voidRoute, 'invoice.status !== "finalized" && invoice.status !== "draft"');
mustContain("void route", voidRoute, "Only draft or finalized invoices can be voided");
mustContain("void route", voidRoute, "data: { invoiceId: null }");

mustAvoidPattern("history page", historyPage, /providerClientInvoice\.(create|update|delete|upsert)\s*\(/i, "direct ProviderClientInvoice mutation in history page");
mustAvoidPattern("history page", historyPage, /matterPaymentReceipt\.(create|update|delete|upsert)\s*\(/i, "direct MatterPaymentReceipt mutation in history page");

const expected = "node scripts/verify-invoice-history-actions-safety.mjs";
if (pkg.scripts?.["verify:invoice-history-actions-safety"] === expected) {
  pass("package.json registers verify:invoice-history-actions-safety");
} else {
  fail("package.json missing verify:invoice-history-actions-safety");
}

if (failures) {
  console.error(`\nRESULT: invoice history actions safety FAILED (${failures})`);
  process.exit(1);
}

console.log("\nRESULT: invoice history actions safety PASSED");
