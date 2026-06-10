#!/usr/bin/env node
import fs from "fs";

const adminClientRoute = fs.readFileSync("app/api/admin/clients/[id]/route.ts", "utf8");
const previewRoute = fs.readFileSync("app/api/admin/clients/[id]/invoice/create-preview/route.ts", "utf8");
const createRoute = fs.readFileSync("app/api/admin/clients/[id]/invoice/create/route.ts", "utf8");
const invoicePage = fs.readFileSync("app/admin/clients/[id]/invoice/page.tsx", "utf8");
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));

let failures = 0;

function pass(message) {
  console.log(`PASS: ${message}`);
}

function fail(message) {
  console.error(`FAIL: ${message}`);
  failures += 1;
}

function mustContain(label, body, marker) {
  if (body.includes(marker)) pass(`${label}: found ${marker}`);
  else fail(`${label}: missing ${marker}`);
}

function mustNotContain(label, body, marker) {
  if (body.includes(marker)) fail(`${label}: still contains stale marker ${marker}`);
  else pass(`${label}: does not contain stale marker ${marker}`);
}

console.log("=== VERIFY REMITTANCE COST BALANCE LEDGER CONTRACT ===");

mustContain("admin client route excludes voided cost history", adminClientRoute, ".filter((row) => row.amount && row.date && !row.voided)");
mustContain("admin client route exposes costsExpended rows", adminClientRoute, "costsExpended: {");
mustContain("admin client route totals active costs expended rows", adminClientRoute, "total: expendedCostRows.reduce((sum: number, row: any) => sum + Number(row.amount || 0), 0)");
mustNotContain("admin client route old cost history filter", adminClientRoute, ".filter((row) => row.amount && row.date);");

mustContain("create-preview reads costs expended from admin client route", previewRoute, "const costsExpendedRows = Array.isArray(detail.costsExpended?.rows) ? detail.costsExpended.rows : []");
mustContain("create-preview identifies eligible uninvoiced costs expended rows", previewRoute, "const eligibleCostsExpendedRows = costsExpendedRows.filter((row: any) => !finalizedCostSourceIdSet.has(clean(row?.id)))");
mustContain("create-preview converts eligible costs expended rows into cost lines", previewRoute, "const costLines = eligibleCostsExpendedRows.map((row: any) => costLine(row))");
mustContain("create-preview reports excluded already-invoiced cost rows", previewRoute, "excludedAlreadyInvoicedCostExpendedRowCount");
mustContain("create-preview totals costs expended", previewRoute, "const costsExpendedTotal = costLines.reduce((sum: number, line: any) => sum + moneyNumber(line.amount), 0)");
mustContain("create-preview calculates period cost balance from costs received minus costs expended", previewRoute, "const costBalanceThisRemittancePeriod = moneyNumber(filingFeePaymentTotal - costsExpendedTotal)");
mustContain("create-preview uses prior finalized cost balance ledger", previewRoute, "select: { costBalanceLedgerAfter: true }");
mustContain("create-preview calculates cost balance ledger after", previewRoute, "const costBalanceLedgerAfter = moneyNumber(Math.max(0, costBalanceLedgerBefore - costBalanceAppliedToLedger + costBalanceAddedToLedger))");
mustContain("create-preview includes costsExpendedTotal in totals snapshot", previewRoute, "costsExpendedTotal,");
mustContain("create-preview includes costBalanceLedgerAfter in totals snapshot", previewRoute, "costBalanceLedgerAfter,");
mustContain("create-preview includes final net remit in totals snapshot", previewRoute, "netRemitToProviderTotal,");

mustContain("create route persists costs expended total", createRoute, "costsExpendedTotal: moneyNumber(totals?.costsExpendedTotal)");
mustContain("create route persists current period cost balance", createRoute, "costBalanceThisRemittancePeriod: moneyNumber(totals?.costBalanceThisRemittancePeriod)");
mustContain("create route persists cost balance ledger before", createRoute, "costBalanceLedgerBefore: moneyNumber(totals?.costBalanceLedgerBefore)");
mustContain("create route persists cost balance ledger change", createRoute, "costBalanceLedgerChange: moneyNumber(totals?.costBalanceLedgerChange)");
mustContain("create route persists cost balance ledger after", createRoute, "costBalanceLedgerAfter: moneyNumber(totals?.costBalanceLedgerAfter)");
mustContain("create route persists final net remit", createRoute, "netRemitToProviderTotal: moneyNumber(totals?.netRemitToProviderTotal)");
mustContain("create route freezes totals snapshot", createRoute, "totalsSnapshot: jsonOrNull(totals)");

mustContain("invoice UI displays costs expended", invoicePage, "Costs Expended During This Remittance Period");
mustContain("invoice UI displays cost balance ledger before", invoicePage, "Cost Balance Ledger Before");
mustContain("invoice UI displays cost balance ledger change", invoicePage, "Cost Balance Ledger Change");
mustContain("invoice UI displays cost balance ledger after", invoicePage, "Cost Balance Ledger");
mustContain("invoice UI displays final net remit", invoicePage, "Final Net Remit to Provider");

const expectedScript = "node scripts/verify-remittance-cost-balance-ledger-contract-safety.mjs";
if (pkg.scripts?.["verify:remittance-cost-balance-ledger-contract-safety"] === expectedScript) {
  pass("package.json registers verify:remittance-cost-balance-ledger-contract-safety");
} else {
  fail("package.json missing verify:remittance-cost-balance-ledger-contract-safety registration");
}

if (failures) {
  console.error(`\nRESULT: remittance cost balance ledger contract safety FAILED (${failures})`);
  process.exit(1);
}

console.log("\nPASS: remittance cost balance ledger contract safety passed");
