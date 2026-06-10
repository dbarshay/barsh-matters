#!/usr/bin/env node
import fs from "fs";

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
  if (body.includes(marker)) fail(`${label}: still contains stale unconditional marker ${marker}`);
  else pass(`${label}: does not contain stale unconditional marker ${marker}`);
}

function mustMatch(label, body, regex, description) {
  if (regex.test(body)) pass(`${label}: found ${description}`);
  else fail(`${label}: missing ${description}`);
}

function mustNotMatch(label, body, regex, description) {
  if (regex.test(body)) fail(`${label}: still contains stale unconditional pattern ${description}`);
  else pass(`${label}: does not contain stale unconditional pattern ${description}`);
}

console.log("=== VERIFY INVOICE SUMMARY HIDES ZERO LEDGER LINES ===");

mustContain("invoice page", invoicePage, "function isNonZeroMoneyValue(value: unknown): boolean");
mustContain("invoice page", invoicePage, "return Math.abs(Number(value || 0)) >= 0.005;");
mustContain("on-screen summary", invoicePage, "{isNonZeroMoneyValue(summary.costBalanceAppliedToLedger) && <div><strong>Cost Balance Applied to Ledger</strong>");
mustContain("on-screen summary", invoicePage, "{isNonZeroMoneyValue(summary.costBalanceLedgerBefore) && <div><strong>Cost Balance Ledger Before</strong>");
mustContain("on-screen summary", invoicePage, "{isNonZeroMoneyValue(summary.costBalanceLedgerChange) && <div><strong>Cost Balance Ledger Change</strong>");
mustContain("on-screen summary", invoicePage, "{isNonZeroMoneyValue(summary.costBalanceLedgerAfter) && <div><strong>Cost Balance Ledger</strong>");
mustContain("printable summary", invoicePage, "const printableCostBalanceAppliedToLedgerHtml = isNonZeroMoneyValue(printableCostSummary.costBalanceAppliedToLedger)");
mustContain("printable summary", invoicePage, "const printableCostBalanceLedgerAfterHtml = isNonZeroMoneyValue(printableCostSummary.costBalanceLedgerAfter)");
mustContain("printable summary", invoicePage, "${printableCostBalanceAppliedToLedgerHtml}");
mustContain("printable summary", invoicePage, "${printableCostBalanceLedgerAfterHtml}");
mustContain("summary keeps cost balance math", invoicePage, "Cost Balance During This Remittance Period");
mustContain("summary keeps final net remit", invoicePage, "Final Net Remit to Provider");

mustMatch(
  "on-screen summary",
  invoicePage,
  /\{isNonZeroMoneyValue\(summary\.costBalanceAppliedToLedger\) && <div><strong>Cost Balance Applied to Ledger<\/strong>/,
  "conditional Cost Balance Applied to Ledger row"
);
mustMatch(
  "on-screen summary",
  invoicePage,
  /\{isNonZeroMoneyValue\(summary\.costBalanceLedgerBefore\) && <div><strong>Cost Balance Ledger Before<\/strong>/,
  "conditional Cost Balance Ledger Before row"
);
mustMatch(
  "on-screen summary",
  invoicePage,
  /\{isNonZeroMoneyValue\(summary\.costBalanceLedgerChange\) && <div><strong>Cost Balance Ledger Change<\/strong>/,
  "conditional Cost Balance Ledger Change row"
);
mustMatch(
  "on-screen summary",
  invoicePage,
  /\{isNonZeroMoneyValue\(summary\.costBalanceLedgerAfter\) && <div><strong>Cost Balance Ledger<\/strong>/,
  "conditional Cost Balance Ledger row"
);
mustMatch(
  "printable summary",
  invoicePage,
  /const printableCostBalanceAppliedToLedgerHtml = isNonZeroMoneyValue\(printableCostSummary\.costBalanceAppliedToLedger\)[\s\S]*Cost Balance Applied to Ledger[\s\S]*: "";/,
  "conditional printable Cost Balance Applied to Ledger row"
);
mustMatch(
  "printable summary",
  invoicePage,
  /const printableCostBalanceLedgerAfterHtml = isNonZeroMoneyValue\(printableCostSummary\.costBalanceLedgerAfter\)[\s\S]*Cost Balance Ledger[\s\S]*: "";/,
  "conditional printable Cost Balance Ledger row"
);
mustNotMatch(
  "on-screen summary",
  invoicePage,
  /\n\s{10}<div><strong>Cost Balance Applied to Ledger<\/strong><br \/>\{money\(summary\.costBalanceAppliedToLedger\)\}<\/div>/,
  "unconditional on-screen Cost Balance Applied to Ledger row"
);
mustNotMatch(
  "on-screen summary",
  invoicePage,
  /\n\s{10}<div><strong>Cost Balance Ledger Before<\/strong><br \/>\{money\(summary\.costBalanceLedgerBefore\)\}<\/div>/,
  "unconditional on-screen Cost Balance Ledger Before row"
);
mustNotMatch(
  "on-screen summary",
  invoicePage,
  /\n\s{10}<div><strong>Cost Balance Ledger Change<\/strong><br \/>\{money\(summary\.costBalanceLedgerChange\)\}<\/div>/,
  "unconditional on-screen Cost Balance Ledger Change row"
);
mustNotMatch(
  "on-screen summary",
  invoicePage,
  /\n\s{10}<div><strong>Cost Balance Ledger<\/strong><br \/>\{money\(summary\.costBalanceLedgerAfter\)\}<\/div>/,
  "unconditional on-screen Cost Balance Ledger row"
);
mustNotMatch(
  "printable summary",
  invoicePage,
  /\n\s{4}<div><span>Cost Balance Applied to Ledger<\/span><span>\$\{safeHtml\(money\(printableCostSummary\.costBalanceAppliedToLedger\)\)\}<\/span><\/div>/,
  "unconditional printable Cost Balance Applied to Ledger row"
);
mustNotMatch(
  "printable summary",
  invoicePage,
  /\n\s{4}<div><span>Cost Balance Ledger<\/span><span>\$\{safeHtml\(money\(printableCostSummary\.costBalanceLedgerAfter\)\)\}<\/span><\/div>/,
  "unconditional printable Cost Balance Ledger row"
);

const expectedScript = "node scripts/verify-invoice-summary-hide-zero-ledger-lines-safety.mjs";
if (pkg.scripts?.["verify:invoice-summary-hide-zero-ledger-lines-safety"] === expectedScript) {
  pass("package.json registers verify:invoice-summary-hide-zero-ledger-lines-safety");
} else {
  fail("package.json missing verify:invoice-summary-hide-zero-ledger-lines-safety registration");
}

if (failures) {
  console.error(`\nRESULT: invoice summary hide zero ledger lines safety FAILED (${failures})`);
  process.exit(1);
}

console.log("\nPASS: invoice summary hide zero ledger lines safety passed");
