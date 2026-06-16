#!/usr/bin/env node
import fs from "fs";

const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const NC = "\x1b[0m";

const invoicePagePath = "app/admin/clients/[id]/invoice/page.tsx";
const routePath = "app/api/admin/clients/[id]/invoice/create-preview/route.ts";

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

const invoicePage = read(invoicePagePath);
const route = read(routePath);

console.log("=== VERIFY PROVIDER CLIENT INVOICE STEP 2 REVIEW TABLES ===");

for (const required of [
  "Principal / Interest Received",
  "Direct Payments to Provider",
  "Costs Received",
  "Fees and Costs Expended",
  "renderPreviewLineTable",
  '<h3 style={{ margin: 0, fontWeight: 950 }}>{title}</h3>',
]) {
  mustContain("review tables", invoicePage, required);
}

for (const required of [
  "previewTableSort",
  "setPreviewTableSort",
  "previewTableColumns",
  "previewSortValue",
  "sortPreviewLines",
  "togglePreviewTableSort",
  'onClick={() => togglePreviewTableSort(title, column.key)}',
  'activeSort.direction === "asc" ? " ▲" : " ▼"',
  "sortedLines.slice(0, 250).map",
]) {
  mustContain("sortable columns", invoicePage, required);
}

for (const required of [
  "previewRemitToProvider",
  "if (isDirectProviderPaymentLine(line)) return -Number(line?.retainerFee || 0);",
  '{ key: "remitToProvider", label: "Remit to Provider", align: "right", principalOnly: true }',
  'const showRemitToProvider = title === "Principal / Interest Received" || isDirectProviderTable;',
  "const remitTotal = lines.reduce((sum: number, line: any) => sum + previewRemitToProvider(line), 0);",
  "money(previewRemitToProvider(line))",
  "money(remitTotal)",
]) {
  mustContain("principal remit", invoicePage, required);
}

for (const required of [
  'const isCostsReceivedTable = title === "Costs Received";',
  "hideForCostsReceived: true",
  "const showBilledAndRetainerColumns = !isCostsReceivedTable && !isFeesCostsExpendedTable;",
  "if (column.hideForCostsReceived && isCostsReceivedTable) return false;",
  "previewLineDisplayType",
  'return "Index Fee";',
  'return "Service Fee";',
  'return "Other Court Costs";',
]) {
  mustContain("costs received table", invoicePage, required);
}

for (const required of [
  'const isFeesCostsExpendedTable = title === "Fees and Costs Expended";',
  'expendedLabel: "Date Incurred"',
  'expendedLabel: "Amount Expended"',
  "hideForExpended: true",
  "const showCheckColumns = !isFeesCostsExpendedTable;",
  "if (column.hideForExpended && isFeesCostsExpendedTable) return false;",
  '(isFeesCostsExpendedTable && column.expendedLabel) ? column.expendedLabel : column.label',
  "{showCheckColumns && (",
]) {
  mustContain("fees and costs expended table", invoicePage, required);
}

for (const stale of [
  '{line.description || line.lineType || "—"}',
  "No eligible invoice lines in this preview.",
  "Other Court Fees Collected",
  "Number of Principal / Interest Payments Received:",
  "Number of Costs Payments Received:",
  "Number of Costs Expended:",
]) {
  mustNotContain("invoice page stale Step 2 text", invoicePage, stale);
}

for (const required of [
  "retainerFeeForReceipt",
  'type.includes("interest")',
  "retainerNfInterest",
  "retainerNfPrincipal",
  "if (isFeeRecoveryTransactionType(row?.transactionType)) return 0",
  'lineType: receiptLineType(row)',
  'lineType: "cost_expended"',
]) {
  mustContain("create-preview route Step 2 data contract", route, required);
}

for (const required of [
  'type.includes("filing fee")',
  'type.includes("index fee")',
  'type.includes("service fee")',
  'type.includes("court cost")',
  'type.includes("court costs")',
  'type.includes("court fee")',
  'type.includes("court fees")',
  'type.includes("other court costs")',
  'type.includes("other court fees")',
]) {
  mustContain("create-preview route cost classifier", route, required);
}

if (failures) {
  console.error(`\n${RED}RESULT: provider client invoice Step 2 review tables safety FAILED (${failures})${NC}`);
  process.exit(1);
}

console.log(`\n${GREEN}PASS: provider client invoice Step 2 review tables safety passed${NC}`);
