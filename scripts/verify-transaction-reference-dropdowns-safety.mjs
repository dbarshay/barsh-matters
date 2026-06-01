import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exitCode = 1;
}

function mustContain(label, text, needle) {
  if (!text.includes(needle)) fail(`${label} missing ${needle}`);
}

function mustNotContain(label, text, needle) {
  if (text.includes(needle)) fail(`${label} must not contain ${needle}`);
}

const seed = read("scripts/seed-transaction-reference-options.mjs");
const directPage = read("app/matter/[id]/page.tsx");
const masterPage = read("app/matters/page.tsx");
const optionsRoute = read("app/api/reference-data/options/route.ts");
const packageJson = read("package.json");

const transactionTypes = [
  "Collection Payment",
  "Voluntary Payment",
  "Attorney Fee",
  "Filing Fee Collected",
  "Filing Fee Billed",
  "Index Fee Collected",
  "Index Fee Billed",
  "Interest",
  "PreC to Provider",
  "Service Fee Collected",
  "Service Fee Billed",
  "Other Court Fees Collected",
  "Other Court Fees Billed",
];

const transactionStatuses = [
  "Show on Remittance",
  "Do Not Show on Remittance",
];

for (const value of [...transactionTypes, ...transactionStatuses]) {
  mustContain("transaction seed", seed, value);
}

mustContain("transaction seed", seed, 'type,');
mustContain("transaction seed", seed, 'await upsertReferenceOption("transaction_type", value)');
mustContain("transaction seed", seed, 'await upsertReferenceOption("transaction_status", value)');
mustContain("transaction seed", seed, "prisma.referenceEntity.upsert");
mustContain("transaction seed", seed, "prisma.referenceAlias.upsert");
mustContain("transaction seed", seed, ".env.local");

mustContain("options route", optionsRoute, 'transaction_type: "transaction_type"');
mustContain("options route", optionsRoute, 'transaction_status: "transaction_status"');
mustContain("options route", optionsRoute, 'transaction_type: "Transaction Types"');
mustContain("options route", optionsRoute, 'transaction_status: "Transaction Statuses"');

mustContain("direct matter page", directPage, "paymentTransactionTypeOptions");
mustContain("direct matter page", directPage, "paymentTransactionStatusOptions");
mustContain("direct matter page", directPage, "/api/reference-data/options?type=transaction_type");
mustContain("direct matter page", directPage, "/api/reference-data/options?type=transaction_status");
mustContain("direct matter page", directPage, "paymentTransactionTypeDropdownOptions().map");
mustContain("direct matter page", directPage, "paymentTransactionStatusDropdownOptions().map");
mustContain("direct matter page fallback", directPage, "fallbackPaymentTransactionTypeOptions");
mustContain("direct matter page fallback", directPage, "fallbackPaymentTransactionStatusOptions");

mustContain("master page", masterPage, "masterPaymentTransactionTypeOptions");
mustContain("master page", masterPage, "masterPaymentTransactionStatusOptions");
mustContain("master page", masterPage, "/api/reference-data/options?type=transaction_type");
mustContain("master page", masterPage, "/api/reference-data/options?type=transaction_status");
mustContain("master page", masterPage, "masterPaymentTransactionTypeDropdownOptions().map");
mustContain("master page", masterPage, "masterPaymentTransactionStatusDropdownOptions().map");
mustContain("master page fallback", masterPage, "fallbackMasterPaymentTransactionTypeOptions");
mustContain("master page fallback", masterPage, "fallbackMasterPaymentTransactionStatusOptions");

mustNotContain("transaction seed no Clio", seed, "clioFetch");
mustNotContain("transaction seed no Clio token", seed, "getValidClioAccessToken");
mustContain("package.json", packageJson, "seed:transaction-reference-options");
mustContain("package.json", packageJson, "verify:transaction-reference-dropdowns-safety");

if (process.exitCode) {
  process.exit();
}

console.log("Transaction reference dropdown safety verifier passed.");
