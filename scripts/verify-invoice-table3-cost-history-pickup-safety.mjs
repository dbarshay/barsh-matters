#!/usr/bin/env node
import fs from "fs";

const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const NC = "\x1b[0m";

let failures = 0;

function pass(message) {
  console.log(`${GREEN}PASS:${NC} ${message}`);
}

function fail(message, details) {
  failures += 1;
  console.error(`${RED}FAIL:${NC} ${message}`);
  if (details !== undefined) console.error(JSON.stringify(details, null, 2));
}

function read(path) {
  if (!fs.existsSync(path)) {
    fail(`missing file ${path}`);
    return "";
  }
  return fs.readFileSync(path, "utf8");
}

function mustContain(label, body, needle) {
  if (body.includes(needle)) pass(`${label}: found ${needle}`);
  else fail(`${label}: missing ${needle}`);
}

function mustNotContain(label, body, needle) {
  if (!body.includes(needle)) pass(`${label}: does not contain ${needle}`);
  else fail(`${label}: still contains ${needle}`);
}

function mustMatch(label, body, regex, description) {
  if (regex.test(body)) pass(`${label}: matched ${description}`);
  else fail(`${label}: missing ${description}`, { regex: String(regex) });
}

const mattersPagePath = "app/matters/page.tsx";
const updateMetadataRoutePath = "app/api/lawsuits/update-metadata/route.ts";
const adminClientRoutePath = "app/api/admin/clients/[id]/route.ts";
const previewRoutePath = "app/api/admin/clients/[id]/invoice/create-preview/route.ts";
const invoicePagePath = "app/admin/clients/[id]/invoice/page.tsx";
const packagePath = "package.json";

const mattersPage = read(mattersPagePath);
const updateMetadataRoute = read(updateMetadataRoutePath);
const adminClientRoute = read(adminClientRoutePath);
const previewRoute = read(previewRoutePath);
const invoicePage = read(invoicePagePath);
const pkg = JSON.parse(read(packagePath) || "{}");

console.log("=== VERIFY INVOICE TABLE 3 COST HISTORY PICKUP SAFETY ===");

for (const required of [
  "function masterCostEntryDateField",
  'if (field === "filingFee") return "filingFeeEntryDate"',
  'if (field === "serviceFee") return "serviceFeeEntryDate"',
  'if (field === "otherCourtCosts") return "otherCourtCostsEntryDate"',
  "function masterCostEntryAmountField",
  'if (field === "filingFee") return "filingFeeEntryAmount"',
  'if (field === "serviceFee") return "serviceFeeEntryAmount"',
  'if (field === "otherCourtCosts") return "otherCourtCostsEntryAmount"',
  "function masterCostEntryHistoryField",
  'if (field === "filingFee") return "filingFeeEntryHistory"',
  'if (field === "serviceFee") return "serviceFeeEntryHistory"',
  'if (field === "otherCourtCosts") return "otherCourtCostsEntryHistory"',
]) {
  mustContain("master cost field mapping", mattersPage, required);
}

for (const required of [
  "function parseMasterCostEntryHistory",
  "JSON.parse(text)",
  "amount: clean(row?.amount)",
  "date: clean(row?.date)",
  "function masterCostEntryRecordLines",
  "function masterCostEntryRecordDisplay",
  "added ${costEntryDateDisplay(row.date)}",
]) {
  mustContain("master cost history display", mattersPage, required);
}

for (const required of [
  "const costEntryDateValue = clean(after) ? todayIsoDateOnly() : \"\"",
  "const costEntryAmountValue = clean(after) ? after : \"\"",
  "const existingCostEntryHistory = costEntryHistoryField",
  "? parseMasterCostEntryHistory(masterInfoOverrides[costEntryHistoryField] ?? masterLocalMetadataValue(costEntryHistoryField))",
  "payload[costEntryDateField] = costEntryDateValue",
  "payload[costEntryAmountField] = costEntryAmountValue",
  "payload[costEntryHistoryField] = costEntryHistoryValue",
]) {
  mustContain("master cost UI append behavior", mattersPage, required);
}

for (const required of [
  "filingFeeEntryHistory",
  "serviceFeeEntryHistory",
  "otherCourtCostsEntryHistory",
]) {
  mustContain("update metadata accepts cost history", updateMetadataRoute, required);
  mustContain("master page persists cost history", mattersPage, required);
  mustContain("admin client route reads cost history", adminClientRoute, required);
}

for (const required of [
  "function parseCostEntryHistory",
  "voided: Boolean(row?.voided || row?.isVoided || row?.voidedAt || row?.voided_at)",
  ".filter((row) => row.amount && row.date && !row.voided)",
  "JSON.parse(text)",
  "amount: moneyNumber(row?.amount)",
  "date: formatDateValue(row?.date)",
  "function costEntryHistoryFromOptions",
  "return parseCostEntryHistory(options.filingFeeEntryHistory)",
  "return parseCostEntryHistory(options.serviceFeeEntryHistory)",
  "return parseCostEntryHistory(options.otherCourtCostsEntryHistory)",
]) {
  mustContain("admin client cost history parser", adminClientRoute, required);
}

for (const required of [
  "const historyRows = costEntryHistoryFromOptions(options, candidate.metadataField)",
  "for (const historyRow of historyRows)",
  "if (!costEntryDateInSelectedPeriod(historyRow.date, dateFrom, dateTo)) continue",
  "dateEntered: historyRow.date",
  "amount: historyRow.amount",
  'source: "Lawsuit.lawsuitOptions cost entry history"',
  "costType: candidate.costType",
  "expendedCostRows.push",
]) {
  mustContain("admin client cost expended row builder", adminClientRoute, required);
}

for (const required of [
  "function costLine(row: any)",
  'lineType: "cost_expended"',
  'sourceTable: "Lawsuit.lawsuitOptions"',
  "sourceId: clean(row?.id)",
  "sortDate: clean(row?.dateEntered)",
  "description: clean(row?.costType)",
  "amount: moneyNumber(row?.amount)",
  "retainerFee: 0",
  "rowSnapshot: row",
]) {
  mustContain("invoice create-preview cost line mapping", previewRoute, required);
}

for (const required of [
  "const costsExpendedRows = Array.isArray(detail.costsExpended?.rows) ? detail.costsExpended.rows : []",
  "const eligibleCostsExpendedRows = costsExpendedRows.filter((row: any) => !finalizedCostSourceIdSet.has(clean(row?.id)))",
  "const costLines = eligibleCostsExpendedRows.map((row: any) => costLine(row))",
  "excludedAlreadyInvoicedCostExpendedRowCount",
  "costLines.reduce((sum: number, line: any) => sum + moneyNumber(line.amount), 0)",
]) {
  mustContain("invoice create-preview cost history pickup", previewRoute, required);
}

for (const required of [
  'const isFeesCostsExpendedTable = title === "Fees and Costs Expended"',
  'expendedLabel: "Date Incurred"',
  'expendedLabel: "Amount Expended"',
  "dateOnly(line.sortDate)",
  "money(line.amount)",
  "hideForExpended: true",
  "if (column.hideForExpended && isFeesCostsExpendedTable) return false",
]) {
  mustContain("invoice Step 2 Table 3 display mapping", invoicePage, required);
}

for (const stale of [
  "Other Court Fees",
  "No eligible invoice lines in this preview.",
]) {
  mustNotContain("invoice page stale cost wording", invoicePage, stale);
}

mustContain("master cost UI append behavior", mattersPage, "const nextCostEntryHistory =");
mustContain("master cost UI append behavior", mattersPage, "? [...existingCostEntryHistory, { amount: costEntryAmountValue, date: costEntryDateValue }]");
mustContain("master cost UI append behavior", mattersPage, "const costEntryHistoryValue = costEntryHistoryField ? JSON.stringify(nextCostEntryHistory) : \"\"");

const expectedScript = "node scripts/verify-invoice-table3-cost-history-pickup-safety.mjs";
if (pkg.scripts?.["verify:invoice-table3-cost-history-pickup-safety"] === expectedScript) {
  pass("package.json: verifier script registered");
} else {
  fail("package.json: verifier script missing or wrong", {
    expected: expectedScript,
    actual: pkg.scripts?.["verify:invoice-table3-cost-history-pickup-safety"],
  });
}

if (failures) {
  console.error(`\n${RED}RESULT: invoice Table 3 cost-history pickup safety FAILED (${failures})${NC}`);
  process.exit(1);
}

console.log(`\n${GREEN}PASS: invoice Table 3 cost-history pickup safety passed${NC}`);
