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
mustContain("printable summary", invoicePage, '<div class=\"summary-emphasis\"><span>Net Remit Before Costs</span><span>${safeHtml(money(summaryNetRemitToProvider))}</span></div>');
mustContain("printable summary", invoicePage, '<div class=\"summary-emphasis\"><span>Cost Excess / Shortfall This Remittance</span><span>${safeHtml(money(printableCostSummary.costBalanceThisRemittancePeriod))}</span></div>');
mustContain("printable hidden row", invoicePage, "Cost Excess Applied to Negative Cost Balance</span><span class=\"negative-remit-adjustment\">${safeHtml(money(printableCostSummary.costBalanceAppliedToLedger))}</span>");
mustContain("printable hidden row", invoicePage, "Negative Cost Balance Before This Remittance</span><span>${safeHtml(money(printableCostSummary.costBalanceLedgerBefore))}</span>");
mustContain("printable hidden row", invoicePage, "Negative Cost Balance After This Remittance</span><span>${safeHtml(money(printableCostSummary.costBalanceLedgerAfter))}</span>");
mustContain("printable scenario 1 row", invoicePage, "<div class=\"summary-emphasis\"><span>Cost Excess Added to Net Remit</span><span>${safeHtml(money(printableCostSummary.costBalanceReimbursementToProvider))}</span></div>");

mustContain("on-screen summary", invoicePage, '<Row label="Net Remit Before Costs" value={summary.baseNetRemitToProvider} variant="shaded" />');
mustContain("on-screen summary", invoicePage, '<Row label="Cost Excess / Shortfall This Remittance" value={summary.costBalanceThisRemittancePeriod} variant="shaded" />');
mustContain("on-screen hidden row", invoicePage, 'hasCostExcessApplied && <Row label="Cost Excess Applied to Negative Cost Balance" value={summary.costBalanceAppliedToLedger} variant="red" />');
mustContain("on-screen hidden row", invoicePage, 'hasPriorNegativeBalance && <Row label="Negative Cost Balance Before This Remittance" value={summary.costBalanceLedgerBefore} />');
mustContain("on-screen hidden row", invoicePage, 'hasAfterNegativeBalance && <Row label="Negative Cost Balance After This Remittance" value={summary.costBalanceLedgerAfter} />');
mustContain("on-screen scenario 1 row", invoicePage, 'hasCostExcessAdded && <Row label="Cost Excess Added to Net Remit" value={summary.costBalanceReimbursementToProvider} variant="blue" />');

mustContain("on-screen applied row", invoicePage, '<Row label="Cost Excess Applied to Negative Cost Balance" value={summary.costBalanceAppliedToLedger} variant="red" />');
mustContain("on-screen before row", invoicePage, '<Row label="Negative Cost Balance Before This Remittance" value={summary.costBalanceLedgerBefore} />');
mustContain("on-screen after row", invoicePage, '<Row label="Negative Cost Balance After This Remittance" value={summary.costBalanceLedgerAfter} />');
mustContain("on-screen scenario 1 row", invoicePage, '<Row label="Cost Excess Added to Net Remit" value={summary.costBalanceReimbursementToProvider} variant="blue" />');

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
