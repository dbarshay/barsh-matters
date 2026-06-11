#!/usr/bin/env node

import fs from "fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function pass(message) {
  console.log(`PASS: ${message}`);
}

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exitCode = 1;
}

function mustContain(label, text, needle) {
  if (text.includes(needle)) {
    pass(`${label}: found ${needle}`);
  } else {
    fail(`${label}: missing ${needle}`);
  }
}

function mustNotMatch(label, text, pattern, description) {
  if (!pattern.test(text)) {
    pass(`${label}: does not match ${description}`);
  } else {
    fail(`${label}: unexpectedly matches ${description}`);
  }
}

console.log("=== VERIFY ADMIN CLIENT REMITTANCE SOURCE SAFETY ===");

const pagePath = "app/admin/clients/[id]/page.tsx";
const invoicePagePath = "app/admin/clients/[id]/invoice/page.tsx";
const routePath = "app/api/admin/clients/[id]/route.ts";
const schemaPath = "prisma/schema.prisma";
const packagePath = "package.json";
const prodPath = "scripts/verify-prod.sh";

const page = read(pagePath);
const invoicePage = read(invoicePagePath);
const route = read(routePath);
const schema = read(schemaPath);
const packageJson = read(packagePath);
const verifyProd = read(prodPath);

console.log("");
console.log("=== VERIFY LOCAL SOURCE MODELS ===");
mustContain("schema", schema, "model ProviderClientInfo");
mustContain("schema", schema, "providerClientInfo ProviderClientInfo?");
mustContain("schema", schema, "model MatterPaymentReceipt");
mustContain("schema", schema, "invoiceId");
mustContain("schema", schema, "posted");
mustContain("schema", schema, "voided");

console.log("");
console.log("=== VERIFY ADMIN CLIENT ROUTE READS LOCAL SOURCE TABLES ===");
mustContain("admin client detail route", route, "providerClientInfo.findUnique");
mustContain("admin client detail route", route, "claimIndex.findMany");
mustContain("admin client detail route", route, "compactProviderName");
mustContain("admin client detail route", route, "providerSearchTerms(nameCandidates)");
mustContain("admin client detail route", route, "claimMatchesProviderCandidate");
mustContain("admin client detail route", route, "rawClaimRows.filter");
mustContain("admin client detail route", route, "matterPaymentReceipt.findMany");
mustContain("admin client detail route", route, "buildReceiptWhere(matterKeys)");
mustContain("admin client detail route", route, "OR.push({ matterId: numeric })");
mustContain("admin client detail route", route, "OR.push({ displayNumber: key })");
mustContain("admin client detail route", route, "Number.isSafeInteger(numeric)");
mustContain("admin client detail route", route, "isoDateOnly");
mustContain("admin client detail route", route, "dotMatch");
mustContain("admin client detail route", route, "const rowDate = isoDateOnly(row.transactionDate)");
mustContain("admin client detail route", route, "dateOfLoss: claimDateOfLoss(claim)");
mustContain("admin client detail route", route, "dateOfService: claimDateOfService(claim)");
mustContain("admin client detail route", route, "claimDateOfServiceEnd");
mustContain("admin client detail route", route, "dateOfServiceEnd: claimDateOfServiceEnd(claim)");
mustContain("admin client detail route", route, "billedAmount: claimBillAmount(claim)");
mustContain("admin client detail route", route, 'caseType: "NF"');
mustContain("admin client detail route", route, "ClaimIndex child matters");
mustContain("admin client detail route", route, "MatterPaymentReceipt child-ledger rows");
mustContain("admin client detail route", route, "lawsuit.findMany");
mustContain("admin client detail route", route, "expendedCostRows");
mustContain("admin client detail route", route, "costsExpended");
mustContain("admin client detail route", route, "costEntryDateFromOptions");
mustContain("admin client detail route", route, "costEntryDateInSelectedPeriod");
mustContain("admin client detail route", route, "lawsuit.masterLawsuitId");
mustContain("admin client detail route", route, "options.masterLawsuitId");
mustContain("admin client detail route", route, "options.master_lawsuit_id");
mustContain("admin client detail route", route, "options.indexAaaNumber");
mustContain("admin client detail route", route, "options.indexNumber");
mustContain("admin client detail route", route, "claim.master_lawsuit_id");
mustContain("admin client detail route", route, "claim.masterLawsuitId");
mustContain("admin client detail route", route, "row.master_lawsuit_id");
mustContain("admin client detail route", route, "row.masterLawsuitId");
mustContain("admin client detail route", route, "filingFeeEntryDate");
mustContain("admin client detail route", route, "serviceFeeEntryDate");
mustContain("admin client detail route", route, "otherCourtCostsEntryDate");
mustContain("admin client detail route", route, "Read-only Admin Client detail/remittance preview");
mustContain("admin client detail route", route, "It does not call Clio");
mustContain("admin client detail route", route, "write payments");
mustContain("admin client detail route", route, "edit ClaimIndex");
mustContain("admin client detail route", route, "sourceOfTruth");

console.log("");
console.log("=== VERIFY ADMIN CLIENT ROUTE MUTATIONS ARE LIMITED TO CLIENT INFO PATCH ===");
mustContain("admin client detail route", route, "export async function PATCH");
mustContain("admin client detail route", route, "providerClientInfo.upsert");
mustContain("admin client detail route", route, "createMatterAuditLogEntry");
mustContain("admin client detail route", route, "noPaymentRecordsChanged: true");
mustContain("admin client detail route", route, "noClaimIndexRecordsChanged: true");
mustContain("admin client detail route", route, "noClioRecordsChanged: true");

mustNotMatch("admin client detail route", route, /from\s+["'][^"']*clio/i, "Clio import");
mustNotMatch("admin client detail route", route, /\bclioFetch\s*\(/i, "clioFetch call");
mustNotMatch("admin client detail route", route, /\bfetchClio\s*\(/i, "fetchClio call");
mustNotMatch("admin client detail route", route, /\bupdateClio\b/i, "updateClio reference");
mustNotMatch("admin client detail route", route, /matterPaymentReceipt\.(create|update|upsert|delete|deleteMany|updateMany)\s*\(/i, "MatterPaymentReceipt write");
mustNotMatch("admin client detail route", route, /claimIndex\.(create|update|upsert|delete|deleteMany|updateMany)\s*\(/i, "ClaimIndex write");
mustNotMatch("admin client detail route", route, /invoice\.(create|update|upsert|delete|deleteMany|updateMany)\s*\(/i, "Invoice write");
mustNotMatch("admin client detail route", route, /remittance\.(create|update|upsert|delete|deleteMany|updateMany)\s*\(/i, "Remittance write");

console.log("");
console.log("=== VERIFY ADMIN CLIENT PAGE STATES CHILD-MATTER REPORTING CONTRACT ===");
mustContain("admin client page", page, "Invoicing / Remittance Preview");
mustContain("admin client page", page, "Provider Workflow Hub");
mustContain("admin client page", page, "Lawsuit Matters");
mustContain("admin client page", page, "Individual Matters");
mustContain("admin client page", page, "Invoicing / Remittance");
mustContain("admin client page", page, "/invoice");
mustContain("admin client invoice page", invoicePage, "Provider Client Invoice Workflow");
mustContain("admin client invoice page", invoicePage, "Invoicing / Remittance");
mustContain("admin client invoice page", invoicePage, "Principal / Interest");
mustContain("admin client invoice page", invoicePage, "Principal / Interest Received");
mustContain("admin client invoice page", invoicePage, "Costs Received");
mustContain("admin client invoice page", invoicePage, "Costs Expended");
mustContain("admin client invoice page", invoicePage, "Fees and Costs Expended");
mustContain("admin client invoice page", invoicePage, "Date of Loss");
mustContain("admin client invoice page", invoicePage, "Date of Service");
mustContain("admin client invoice page", invoicePage, "Date Posted");
mustContain("admin client invoice page", invoicePage, "Check Number");
mustContain("admin client invoice page", invoicePage, "Retainer Fee");
mustContain("admin client invoice page", invoicePage, "Totals");
mustContain("admin client invoice page", invoicePage, "Cost Balance During This Remittance Period");
mustContain("admin client invoice page", invoicePage, "Cost Balance Ledger");
mustContain("admin client invoice page", invoicePage, "Final Net Remit to Provider");
mustContain("admin client invoice page", invoicePage, "Export CSV");
mustContain("admin client invoice page", invoicePage, "/api/admin/clients");
mustContain("admin client page", page, "activeWorkflowPanel");
mustContain("admin client page", page, "setActiveWorkflowPanel");
mustContain("admin client page", page, "Child-matter-based local payment reporting");
mustContain("admin client page", page, "Lawsuit-page payments appear here only through allocated child MatterPaymentReceipt rows");
mustContain("admin client page", page, "This preview does not create invoices, write remittances, or update Clio");
mustContain("admin client page", page, "Individual Matters");
mustContain("admin client page", page, "Export CSV");
mustContain("admin client page", page, "downloadCsv");

console.log("");
console.log("=== VERIFY SCRIPT REGISTRATION ===");
mustContain("package.json", packageJson, "verify:admin-client-remittance-source-safety");
mustContain("verify-prod.sh", verifyProd, "verify:admin-client-remittance-source-safety");

if (process.exitCode) {
  console.error("");
  console.error("=== ADMIN CLIENT REMITTANCE SOURCE SAFETY VERIFICATION FAILED ===");
  process.exit(process.exitCode);
}

console.log("");
console.log("=== ADMIN CLIENT REMITTANCE SOURCE SAFETY VERIFICATION PASSED ===");
console.log("Provider/client remittance preview remains local-only.");
console.log("Payment reporting remains child-matter based.");
console.log("Lawsuit-page payments are reportable only through allocated child MatterPaymentReceipt rows.");
console.log("No Clio records are changed by this workflow.");
