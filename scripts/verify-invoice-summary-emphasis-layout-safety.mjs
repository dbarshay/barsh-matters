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
function mustNotContain(label, body, marker) {
  if (body.includes(marker)) fail(`${label}: still contains ${marker}`);
  else pass(`${label}: does not contain ${marker}`);
}
function countOccurrences(body, marker) {
  return body.split(marker).length - 1;
}
function mustOccurExactly(label, body, marker, expected) {
  const actual = countOccurrences(body, marker);
  if (actual === expected) pass(`${label}: ${marker} occurs ${expected} time(s)`);
  else fail(`${label}: ${marker} occurs ${actual} time(s), expected ${expected}`);
}

console.log("=== VERIFY SCENARIO 1 COST EXCESS SUMMARY TERMINOLOGY ===");

mustContain("printable CSS", invoicePage, ".summary-emphasis { padding-left: 28px !important; font-weight: 900; }");
mustContain("printable CSS", invoicePage, ".summary-emphasis span { font-weight: 900; }");
mustContain("printable summary", invoicePage, '<div class="summary-emphasis"><span>Net Remit Before Costs</span><span>${safeHtml(money(summaryNetRemitToProvider))}</span></div>');
mustContain("printable summary", invoicePage, '<div class="summary-emphasis"><span>Cost Excess / Shortfall This Remittance</span><span>${safeHtml(money(printableCostSummary.costBalanceThisRemittancePeriod))}</span></div>');
mustContain("printable hidden row", invoicePage, "Cost Excess Applied to Negative Cost Balance</span><span class=\"negative-remit-adjustment\">${safeHtml(money(printableCostSummary.costBalanceAppliedToLedger))}</span>");
mustContain("printable hidden row", invoicePage, "Negative Cost Balance Before This Remittance</span><span>${safeHtml(money(printableCostSummary.costBalanceLedgerBefore))}</span>");
mustContain("printable hidden row", invoicePage, "Negative Cost Balance After This Remittance</span><span>${safeHtml(money(printableCostSummary.costBalanceLedgerAfter))}</span>");
mustContain("printable scenario 1 row", invoicePage, "<div class=\"summary-emphasis\"><span>Cost Excess Added to Net Remit</span><span>${safeHtml(money(printableCostSummary.costBalanceReimbursementToProvider))}</span></div>");

mustContain("on-screen summary", invoicePage, '<div style={{ paddingLeft: 28, fontWeight: 950 }}><strong>Net Remit Before Costs</strong><br /><strong>{money(summary.baseNetRemitToProvider)}</strong></div>');
mustContain("on-screen summary", invoicePage, '<div style={{ paddingLeft: 28, fontWeight: 950 }}><strong>Cost Excess / Shortfall This Remittance</strong><br /><strong>{money(summary.costBalanceThisRemittancePeriod)}</strong></div>');
mustContain("on-screen hidden row", invoicePage, "isNonZeroMoneyValue(summary.costBalanceAppliedToLedger) && <div><strong>Cost Excess Applied to Negative Cost Balance</strong><br /><span style={{ color: \"#b91c1c\", fontWeight: 900 }}>{money(summary.costBalanceAppliedToLedger)}</span></div>");
mustContain("on-screen hidden row", invoicePage, "isNonZeroMoneyValue(summary.costBalanceLedgerBefore) && <div><strong>Negative Cost Balance Before This Remittance</strong><br />{money(summary.costBalanceLedgerBefore)}</div>");
mustContain("on-screen hidden row", invoicePage, "isNonZeroMoneyValue(summary.costBalanceLedgerAfter) && <div><strong>Negative Cost Balance After This Remittance</strong><br />{money(summary.costBalanceLedgerAfter)}</div>");
mustContain("on-screen scenario 1 row", invoicePage, "isNonZeroMoneyValue(summary.costBalanceReimbursementToProvider) && <div style={{ paddingLeft: 28, fontWeight: 950 }}><strong>Cost Excess Added to Net Remit</strong><br /><strong>{money(summary.costBalanceReimbursementToProvider)}</strong></div>");

mustOccurExactly("on-screen applied row", invoicePage, "<strong>Cost Excess Applied to Negative Cost Balance</strong><br /><span style={{ color: \"#b91c1c\", fontWeight: 900 }}>{money(summary.costBalanceAppliedToLedger)}</span>", 1);
mustOccurExactly("on-screen before row", invoicePage, "<strong>Negative Cost Balance Before This Remittance</strong><br />{money(summary.costBalanceLedgerBefore)}", 1);
mustOccurExactly("on-screen after row", invoicePage, "<strong>Negative Cost Balance After This Remittance</strong><br />{money(summary.costBalanceLedgerAfter)}", 1);
mustOccurExactly("on-screen scenario 1 row", invoicePage, "<strong>Cost Excess Added to Net Remit</strong><br /><strong>{money(summary.costBalanceReimbursementToProvider)}</strong>", 1);

mustNotContain("summary stale label", invoicePage, "Cost Balance Added to Net Remit");
mustNotContain("summary stale label", invoicePage, "Cost Balance Applied to Ledger");
mustNotContain("summary stale label", invoicePage, "Prior Cost Shortfall Balance");
mustNotContain("summary stale label", invoicePage, "Cost Shortfall Balance After This Remittance");
mustNotContain("summary stale label", invoicePage, "Cost Balance (lifetime)");
mustNotContain("summary stale label", invoicePage, "Cost Balance (prior)");
mustNotContain("summary stale label", invoicePage, "Cost Balance (after this remittance)");

const expectedScript = "node scripts/verify-invoice-summary-emphasis-layout-safety.mjs";
if (pkg.scripts?.["verify:invoice-summary-emphasis-layout-safety"] === expectedScript) {
  pass("package.json registers verify:invoice-summary-emphasis-layout-safety");
} else {
  fail("package.json missing verify:invoice-summary-emphasis-layout-safety registration");
}

if (failures) {
  console.error(`\nRESULT: scenario 1 cost excess summary terminology safety FAILED (${failures})`);
  process.exit(1);
}

console.log("\nPASS: scenario 1 cost excess summary terminology safety passed");
