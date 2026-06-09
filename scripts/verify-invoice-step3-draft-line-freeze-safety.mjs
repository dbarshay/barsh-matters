#!/usr/bin/env node
import fs from "fs";

const schemaPath = "prisma/schema.prisma";
const routePath = "app/api/admin/clients/[id]/invoice/create/route.ts";
const packagePath = "package.json";

const schema = fs.readFileSync(schemaPath, "utf8");
const route = fs.readFileSync(routePath, "utf8");

let failures = 0;

function pass(message) {
  console.log(`PASS: ${message}`);
}

function fail(message) {
  failures += 1;
  console.error(`FAIL: ${message}`);
}

function mustContain(label, text, needle) {
  if (text.includes(needle)) pass(`${label}: found ${needle}`);
  else fail(`${label}: missing ${needle}`);
}

function mustMatch(label, text, regex, description) {
  if (regex.test(text)) pass(`${label}: matched ${description}`);
  else fail(`${label}: missing ${description}`);
}

function mustNotMatch(label, text, regex, description) {
  if (!regex.test(text)) pass(`${label}: avoids ${description}`);
  else fail(`${label}: matched forbidden ${description}`);
}

console.log("=== VERIFY INVOICE STEP 3 DRAFT LINE FREEZE SAFETY ===");

const modelMatch = schema.match(/model\s+ProviderClientInvoiceLine\s+\{[\s\S]*?\n\}/);
if (!modelMatch) {
  fail("ProviderClientInvoiceLine model missing");
} else {
  const model = modelMatch[0];

  for (const field of [
    "dateOfLoss",
    "dateOfService",
    "dosEnd",
    "caseType",
    "checkDate",
    "checkNumber",
    "billedAmount",
    "amount",
    "retainer",
    "sourceType",
    "sourceMatterId",
    "sourceMatterDisplayNumber",
    "sourcePaymentReceiptId",
    "sourceSettlementId",
    "rowSnapshot",
  ]) {
    mustMatch("ProviderClientInvoiceLine model", model, new RegExp(`\\n\\s*${field}\\s+`), field);
  }
}

mustContain("create route", route, "function normalizedLine");
mustContain("create route", route, "function lineValue");
mustContain("create route", route, "dateOfLoss:");
mustContain("create route", route, "dateOfService:");
mustContain("create route", route, "dosEnd:");
mustContain("create route", route, "caseType:");
mustContain("create route", route, "checkDate:");
mustContain("create route", route, "checkNumber:");
mustContain("create route", route, "billedAmount:");
mustContain("create route", route, "amount: moneyNumber(line?.amount)");
mustContain("create route", route, "retainer:");
mustContain("create route", route, "sourceType:");
mustContain("create route", route, "sourceMatterId:");
mustContain("create route", route, "sourceMatterDisplayNumber:");
mustContain("create route", route, "sourcePaymentReceiptId:");
mustContain("create route", route, "sourceSettlementId:");
mustContain("create route", route, "rowSnapshot: jsonOrNull(line?.rowSnapshot ?? line)");

mustContain("create route", route, "providerClientInvoice.create");
mustContain("create route", route, "providerClientInvoiceLine.createMany");
mustContain("create route", route, "providerClientInvoiceAudit.create");
mustContain("create route", route, "status: \"draft\"");
mustContain("create route", route, "does not finalize invoices, update MatterPaymentReceipt.invoiceId");

// Precise lifecycle rule: draft creation may read MatterPaymentReceipt.invoiceId for conflict detection,
// but it must not write MatterPaymentReceipt rows. Do not confuse ProviderClientInvoiceLine.invoiceId
// with MatterPaymentReceipt.invoiceId.
mustNotMatch(
  "create route",
  route,
  /(?:tx|prisma)\.matterPaymentReceipt\.(?:update|updateMany|create|upsert|delete|deleteMany)\s*\(/i,
  "MatterPaymentReceipt mutation during draft creation"
);

mustNotMatch(
  "create route",
  route,
  /claimIndex\.(?:update|updateMany|create|upsert|delete|deleteMany)\s*\(/i,
  "ClaimIndex mutation during draft creation"
);

mustNotMatch(
  "create route",
  route,
  /finalizedAt\s*:\s*new Date|status\s*:\s*["']finalized["']/i,
  "invoice finalization during draft creation"
);

const pkg = JSON.parse(fs.readFileSync(packagePath, "utf8"));
const expectedScript = "node scripts/verify-invoice-step3-draft-line-freeze-safety.mjs";
if (pkg.scripts?.["verify:invoice-step3-draft-line-freeze-safety"] === expectedScript) {
  pass("package.json: verifier script registered");
} else {
  fail("package.json: verifier script is not registered");
}

if (failures) {
  console.error(`\nRESULT: invoice Step 3 draft line freeze safety FAILED (${failures})`);
  process.exit(1);
}

console.log("\nRESULT: invoice Step 3 draft line freeze safety PASSED");
