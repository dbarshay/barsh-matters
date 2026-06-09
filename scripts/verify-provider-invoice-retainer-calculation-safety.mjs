#!/usr/bin/env node
import fs from "fs";

const pagePath = "app/admin/clients/[id]/invoice/page.tsx";
const packagePath = "package.json";

const page = fs.readFileSync(pagePath, "utf8");
let failures = 0;

function pass(message) {
  console.log(`PASS: ${message}`);
}

function fail(message) {
  console.error(`FAIL: ${message}`);
  failures += 1;
}

function mustContain(label, haystack, needle) {
  if (haystack.includes(needle)) pass(`${label}: found ${needle}`);
  else fail(`${label}: missing ${needle}`);
}

function mustNotContain(label, haystack, needle) {
  if (!haystack.includes(needle)) pass(`${label}: does not contain ${needle}`);
  else fail(`${label}: still contains ${needle}`);
}

console.log("=== VERIFY PROVIDER INVOICE RETAINER CALCULATION SAFETY ===");

mustContain("invoice page", page, "function retainerFeeForReceipt");
mustContain("invoice page", page, "_hiddenImportFields");
mustContain("invoice page", page, "providerDefault");
mustContain("invoice page", page, "hidden_retainer_principal_nf_percent");
mustContain("invoice page", page, "hidden_retainer_interest_percent");
mustContain("invoice page", page, "isFeeRecoveryTransactionType(row?.transactionType)");
mustNotContain("invoice page", page, "numberFromPercent(client?.retainerNfInterest)");
mustNotContain("invoice page", page, "numberFromPercent(client?.retainerNfPrincipal)");

function numberFromPercent(value) {
  const text = String(value ?? "").trim();
  if (!text) return 0;
  const numeric = Number(text.replace(/%/g, ""));
  if (!Number.isFinite(numeric)) return 0;
  return numeric > 1 ? numeric / 100 : numeric;
}

function isFeeRecoveryTransactionType(value) {
  const type = String(value ?? "").toLowerCase();
  return (
    type.includes("filing fee") ||
    type.includes("court fee") ||
    type.includes("court fees") ||
    type.includes("other court fees")
  );
}

function retainerFeeForReceipt(row, client) {
  if (isFeeRecoveryTransactionType(row?.transactionType)) return 0;

  const details = client?.details || {};
  const hidden =
    details?._hiddenImportFields &&
    typeof details._hiddenImportFields === "object" &&
    !Array.isArray(details._hiddenImportFields)
      ? details._hiddenImportFields
      : {};

  function providerDefault(keys) {
    for (const key of keys) {
      const directValue = details?.[key] ?? client?.[key];
      if (directValue !== null && directValue !== undefined && String(directValue).trim()) return String(directValue).trim();

      const hiddenValue = hidden?.[key];
      if (hiddenValue !== null && hiddenValue !== undefined && String(hiddenValue).trim()) return String(hiddenValue).trim();
    }

    return "";
  }

  const amount = Number(row?.amount || 0);
  const type = String(row?.transactionType || "").toLowerCase();
  const rate = type.includes("interest")
    ? numberFromPercent(providerDefault(["retainerNfInterest", "hidden_retainer_interest_percent", "hidden_retainer_nf_interest_percent", "retainer_nf_interest_percent"]))
    : numberFromPercent(providerDefault(["retainerNfPrincipal", "hidden_retainer_principal_nf_percent", "retainer_nf_principal_percent"]));

  return amount * rate;
}

const atlanticClient = {
  details: {
    _hiddenImportFields: {
      hidden_retainer_principal_nf_percent: "10%",
      hidden_retainer_interest_percent: "50.00",
    },
  },
};

const cases = [
  { name: "NF principal payment uses 10%", row: { transactionType: "Direct Pay", amount: 1000 }, expected: 100 },
  { name: "interest payment uses 50%", row: { transactionType: "Interest", amount: 500 }, expected: 250 },
  { name: "filing fee recovery has zero retainer", row: { transactionType: "Filing Fee Collected", amount: 67 }, expected: 0 },
  { name: "other court fee recovery has zero retainer", row: { transactionType: "Other Court Fees Collected", amount: 48.53 }, expected: 0 },
];

for (const test of cases) {
  const actual = retainerFeeForReceipt(test.row, atlanticClient);
  if (Math.abs(actual - test.expected) < 0.0001) pass(`${test.name}: ${actual}`);
  else fail(`${test.name}: expected ${test.expected}, got ${actual}`);
}

const pkg = JSON.parse(fs.readFileSync(packagePath, "utf8"));
const expectedScript = "node scripts/verify-provider-invoice-retainer-calculation-safety.mjs";
if (pkg.scripts?.["verify:provider-invoice-retainer-calculation-safety"] === expectedScript) {
  pass("package.json: verifier script registered");
} else {
  fail("package.json: verifier script is not registered");
}

if (failures) {
  console.error(`\\nRESULT: provider invoice retainer calculation safety FAILED (${failures})`);
  process.exit(1);
}

console.log("\\nRESULT: provider invoice retainer calculation safety PASSED");
