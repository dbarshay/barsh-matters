#!/usr/bin/env node
import fs from "fs";

const files = {
  adminPage: "app/admin/reference-data/page.tsx",
  entitiesRoute: "app/api/reference-data/entities/route.ts",
  optionsRoute: "app/api/reference-data/options/route.ts",
  directPage: "app/matter/[id]/page.tsx",
  masterPage: "app/matters/page.tsx",
  seed: "scripts/seed-transaction-reference-options.mjs",
  packageJson: "package.json",
};

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function pass(msg) {
  console.log(`PASS: ${msg}`);
}

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  process.exitCode = 1;
}

function mustContain(label, text, needle) {
  text.includes(needle) ? pass(`${label}: found ${needle}`) : fail(`${label}: missing ${needle}`);
}

function mustNotContain(label, text, needle) {
  text.includes(needle) ? fail(`${label}: must not contain ${needle}`) : pass(`${label}: does not contain ${needle}`);
}

const adminPage = read(files.adminPage);
const entitiesRoute = read(files.entitiesRoute);
const optionsRoute = read(files.optionsRoute);
const directPage = read(files.directPage);
const masterPage = read(files.masterPage);
const seed = read(files.seed);
const packageJson = read(files.packageJson);

console.log("=== VERIFY TRANSACTION TYPE MANAGEMENT CONTRACT ===");

mustContain("admin reference page", adminPage, '{ value: "transaction_type", label: "Transaction Types" }');
mustContain("admin reference page", adminPage, "createRecord");
mustContain("admin reference page", adminPage, "updateRecord");
mustContain("admin reference page", adminPage, "deactivate");
mustContain("admin reference page", adminPage, "reactivate");
mustContain("admin reference page", adminPage, "No records were hard-deleted");

mustContain("entities route", entitiesRoute, "normalizeReferenceEntityType");
mustContain("entities route", entitiesRoute, "reference-entity-create");
mustContain("entities route", entitiesRoute, "reference-entity-update");
mustContain("entities route", entitiesRoute, "data.active = false");
mustContain("entities route", entitiesRoute, "data.active = true");
mustContain("entities route", entitiesRoute, "createMatterAuditLogEntry");

mustContain("options route", optionsRoute, "transaction_type");
mustContain("options route", optionsRoute, 'transaction_type: "Transaction Types"');
mustContain("options route", optionsRoute, "activeOnly");
mustContain("options route", optionsRoute, "storage: \"ReferenceEntity\"");
mustContain("admin reference page alias management", adminPage, "/api/reference-data/aliases");
mustContain("admin reference page alias display", adminPage, "selectedRow.aliases");

mustContain("transaction seed", seed, "Collection Payment");
mustContain("transaction seed", seed, "Voluntary Payment");
mustContain("transaction seed", seed, "Attorney Fee");
mustContain("transaction seed", seed, "Direct Pay to Provider");
mustContain("transaction seed", seed, "Direct Pay to Provider (Pre-suit)");
mustContain("transaction seed", seed, "Filing Fee Collected");
mustContain("transaction seed", seed, "Index Fee Collected");
mustContain("transaction seed", seed, "Service Fee");
mustContain("transaction seed", seed, "Other Court Fees Collected");

mustContain("direct page loads transaction types", directPage, "/api/reference-data/options?type=transaction_type");
mustContain("direct page loads transaction statuses", directPage, "/api/reference-data/options?type=transaction_status");
mustContain("direct page default remains Voluntary Payment", directPage, 'useState("Voluntary Payment")');
mustNotContain("direct page must not hardcode Collection Payment in direct options", directPage.slice(directPage.indexOf("const directPaymentTransactionFallbackOptions"), directPage.indexOf("const directPaymentStatusFallbackOptions")), '"Collection Payment"');

mustContain("master page loads transaction types", masterPage, "/api/reference-data/options?type=transaction_type");
mustContain("master page loads transaction statuses", masterPage, "/api/reference-data/options?type=transaction_status");
mustContain("master page default remains Collection Payment", masterPage, 'useState("Collection Payment")');
mustContain("master page Collection display", masterPage, 'return "Collection";');
mustContain("master page Direct Pay pre-suit display", masterPage, 'Direct Pay to Provider (Pre-suit)');
mustContain("master page Attorney Fee status rule", masterPage, 'String(nextType || "").trim() === "Attorney Fee"');
mustContain("master page Attorney Fee Do Not Show", masterPage, 'setMasterPaymentTransactionStatusInput("Do Not Show on Remittance")');

mustContain("package.json", packageJson, "verify:transaction-type-management-contract-safety");

if (process.exitCode) {
  console.error("=== TRANSACTION TYPE MANAGEMENT CONTRACT FAILED ===");
  process.exit(process.exitCode);
}

console.log("=== TRANSACTION TYPE MANAGEMENT CONTRACT PASSED ===");
