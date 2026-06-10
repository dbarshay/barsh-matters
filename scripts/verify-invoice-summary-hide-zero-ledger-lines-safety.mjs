#!/usr/bin/env node
import fs from "fs";

const invoicePage = fs.readFileSync("app/admin/clients/[id]/invoice/page.tsx", "utf8");
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));

let failures = 0;

function pass(message) { console.log(`PASS: ${message}`); }
function fail(message) { console.error(`FAIL: ${message}`); failures += 1; }
function mustContain(label, body, marker) {
  if (body.includes(marker)) pass(`${label}: found ${marker}`);
  else fail(`${label}: missing ${marker}`);
}
function mustMatch(label, body, regex, description) {
  if (regex.test(body)) pass(`${label}: found ${description}`);
  else fail(`${label}: missing ${description}`);
}
function mustNotMatch(label, body, regex, description) {
  if (regex.test(body)) fail(`${label}: still contains stale unconditional pattern ${description}`);
  else pass(`${label}: does not contain stale unconditional pattern ${description}`);
}

console.log("=== VERIFY SUMMARY HIDES ZERO COST ROWS ===");

mustContain("invoice page", invoicePage, "function isNonZeroMoneyValue(value: unknown): boolean");
mustContain("invoice page", invoicePage, "return Math.abs(Number(value || 0)) >= 0.005;");

mustMatch("on-screen hidden-zero", invoicePage, /\{isNonZeroMoneyValue\(summary\.costBalanceAppliedToLedger\) && <div><strong>Cost Excess Applied to Negative Cost Balance<\/strong>/, "conditional Cost Excess Applied to Negative Cost Balance row");
mustMatch("on-screen hidden-zero", invoicePage, /\{isNonZeroMoneyValue\(summary\.costBalanceLedgerBefore\) && <div><strong>Negative Cost Balance Before This Remittance<\/strong>/, "conditional Negative Cost Balance Before row");
mustMatch("on-screen hidden-zero", invoicePage, /\{isNonZeroMoneyValue\(summary\.costBalanceLedgerAfter\) && <div><strong>Negative Cost Balance After This Remittance<\/strong>/, "conditional Negative Cost Balance After row");
mustMatch("on-screen hidden-zero", invoicePage, /\{isNonZeroMoneyValue\(summary\.costBalanceReimbursementToProvider\) && <div><strong>Cost Excess Added to Net Remit<\/strong>/, "conditional Cost Excess Added to Net Remit row");
mustMatch("on-screen hidden-zero", invoicePage, /\{isNonZeroMoneyValue\(summary\.costBalanceDeductionApplied\) && <div><strong>Cost Deduction Applied<\/strong>/, "conditional Cost Deduction Applied row");

mustMatch("printable hidden-zero", invoicePage, /const printableCostBalanceAppliedToLedgerHtml = isNonZeroMoneyValue\(printableCostSummary\.costBalanceAppliedToLedger\)[\s\S]*Cost Excess Applied to Negative Cost Balance[\s\S]*: "";/, "conditional printable applied row");
mustMatch("printable hidden-zero", invoicePage, /const printableNegativeCostBalanceBeforeHtml = isNonZeroMoneyValue\(printableCostSummary\.costBalanceLedgerBefore\)[\s\S]*Negative Cost Balance Before This Remittance[\s\S]*: "";/, "conditional printable before row");
mustMatch("printable hidden-zero", invoicePage, /const printableNegativeCostBalanceAfterHtml = isNonZeroMoneyValue\(printableCostSummary\.costBalanceLedgerAfter\)[\s\S]*Negative Cost Balance After This Remittance[\s\S]*: "";/, "conditional printable after row");
mustMatch("printable hidden-zero", invoicePage, /const printableCostExcessAddedToNetRemitHtml = isNonZeroMoneyValue\(printableCostSummary\.costBalanceReimbursementToProvider\)[\s\S]*Cost Excess Added to Net Remit[\s\S]*: "";/, "conditional printable excess added row");
mustMatch("printable hidden-zero", invoicePage, /const printableCostDeductionAppliedHtml = isNonZeroMoneyValue\(printableCostSummary\.costBalanceDeductionApplied\)[\s\S]*Cost Deduction Applied[\s\S]*: "";/, "conditional printable deduction row");

mustNotMatch("on-screen stale unconditional", invoicePage, /\n\s{10}<div><strong>Cost Excess Applied to Negative Cost Balance<\/strong><br \/>\{money\(summary\.costBalanceAppliedToLedger\)\}<\/div>/, "unconditional applied row");
mustNotMatch("on-screen stale unconditional", invoicePage, /\n\s{10}<div><strong>Negative Cost Balance Before This Remittance<\/strong><br \/>\{money\(summary\.costBalanceLedgerBefore\)\}<\/div>/, "unconditional before row");
mustNotMatch("on-screen stale unconditional", invoicePage, /\n\s{10}<div><strong>Negative Cost Balance After This Remittance<\/strong><br \/>\{money\(summary\.costBalanceLedgerAfter\)\}<\/div>/, "unconditional after row");
mustNotMatch("on-screen stale unconditional", invoicePage, /\n\s{10}<div><strong>Cost Excess Added to Net Remit<\/strong><br \/>\{money\(summary\.costBalanceReimbursementToProvider\)\}<\/div>/, "unconditional excess added row");
mustNotMatch("on-screen stale unconditional", invoicePage, /\n\s{10}<div><strong>Cost Deduction Applied<\/strong><br \/>\{money\(summary\.costBalanceDeductionApplied\)\}<\/div>/, "unconditional deduction row");

const expectedScript = "node scripts/verify-invoice-summary-hide-zero-ledger-lines-safety.mjs";
if (pkg.scripts?.["verify:invoice-summary-hide-zero-ledger-lines-safety"] === expectedScript) {
  pass("package.json registers verify:invoice-summary-hide-zero-ledger-lines-safety");
} else {
  fail("package.json missing verify:invoice-summary-hide-zero-ledger-lines-safety registration");
}

if (failures) {
  console.error(`\nRESULT: summary hide-zero cost rows safety FAILED (${failures})`);
  process.exit(1);
}

console.log("\nPASS: summary hide-zero cost rows safety passed");
