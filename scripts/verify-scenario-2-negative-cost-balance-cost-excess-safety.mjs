#!/usr/bin/env node
import fs from "fs";

const invoicePage = fs.readFileSync("app/admin/clients/[id]/invoice/page.tsx", "utf8");
const previewRoute = fs.readFileSync("app/api/admin/clients/[id]/invoice/create-preview/route.ts", "utf8");
const createRoute = fs.readFileSync("app/api/admin/clients/[id]/invoice/create/route.ts", "utf8");
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

console.log("=== VERIFY SCENARIO 2: NEGATIVE COST BALANCE + COST EXCESS APPLIED ===");

mustContain(
  "create-preview scenario 2 math",
  previewRoute,
  "const currentPeriodPositiveCostBalance = moneyNumber(Math.max(0, costBalanceThisRemittancePeriod));"
);
mustContain(
  "create-preview scenario 2 math",
  previewRoute,
  "const costBalanceAppliedToLedger = moneyNumber(Math.min(currentPeriodPositiveCostBalance, costBalanceLedgerBefore));"
);
mustContain(
  "create-preview scenario 2 math",
  previewRoute,
  "const costBalanceReimbursementToProvider = moneyNumber(Math.max(0, currentPeriodPositiveCostBalance - costBalanceAppliedToLedger));"
);
mustContain(
  "create-preview scenario 2 math",
  previewRoute,
  "const costBalanceLedgerAfter = moneyNumber(Math.max(0, costBalanceLedgerBefore - costBalanceAppliedToLedger + costBalanceAddedToLedger));"
);
mustContain(
  "create-preview scenario 2 math",
  previewRoute,
  "const netRemitToProviderTotal = moneyNumber(baseNetRemitToProvider + costBalanceAdjustmentToNetRemit);"
);

mustContain(
  "create-preview persists scenario 2 totals",
  previewRoute,
  "costBalanceAppliedToLedger,"
);
mustContain(
  "create-preview persists scenario 2 totals",
  previewRoute,
  "costBalanceReimbursementToProvider,"
);
mustContain(
  "create-preview persists scenario 2 totals",
  previewRoute,
  "costBalanceLedgerBefore,"
);
mustContain(
  "create-preview persists scenario 2 totals",
  previewRoute,
  "costBalanceLedgerAfter,"
);

mustContain(
  "create route persists scenario 2 applied amount",
  createRoute,
  "costBalanceLedgerBefore: moneyNumber(totals?.costBalanceLedgerBefore)"
);
mustContain(
  "create route persists scenario 2 after balance",
  createRoute,
  "costBalanceLedgerAfter: moneyNumber(totals?.costBalanceLedgerAfter)"
);
mustContain(
  "create route persists final net remit",
  createRoute,
  "netRemitToProviderTotal: moneyNumber(totals?.netRemitToProviderTotal)"
);

mustContain(
  "printable summary scenario 2 prior balance",
  invoicePage,
  "Negative Cost Balance Before This Remittance</span><span>${safeHtml(money(printableCostSummary.costBalanceLedgerBefore))}</span>"
);
mustContain(
  "printable summary scenario 2 current excess",
  invoicePage,
  '<div class="summary-emphasis"><span>Cost Excess / Shortfall This Remittance</span><span>${safeHtml(money(printableCostSummary.costBalanceThisRemittancePeriod))}</span></div>'
);
mustContain(
  "printable summary scenario 2 applied amount",
  invoicePage,
  "Cost Excess Applied to Negative Cost Balance</span><span>${safeHtml(money(printableCostSummary.costBalanceAppliedToLedger))}</span>"
);
mustContain(
  "printable summary scenario 2 after balance",
  invoicePage,
  "Negative Cost Balance After This Remittance</span><span>${safeHtml(money(printableCostSummary.costBalanceLedgerAfter))}</span>"
);

mustContain(
  "on-screen summary scenario 2 prior balance",
  invoicePage,
  "isNonZeroMoneyValue(summary.costBalanceLedgerBefore) && <div><strong>Negative Cost Balance Before This Remittance</strong><br />{money(summary.costBalanceLedgerBefore)}</div>"
);
mustContain(
  "on-screen summary scenario 2 current excess",
  invoicePage,
  '<div style={{ paddingLeft: 28, fontWeight: 950 }}><strong>Cost Excess / Shortfall This Remittance</strong><br /><strong>{money(summary.costBalanceThisRemittancePeriod)}</strong></div>'
);
mustContain(
  "on-screen summary scenario 2 applied amount",
  invoicePage,
  "isNonZeroMoneyValue(summary.costBalanceAppliedToLedger) && <div><strong>Cost Excess Applied to Negative Cost Balance</strong><br />{money(summary.costBalanceAppliedToLedger)}</div>"
);
mustContain(
  "on-screen summary scenario 2 after balance",
  invoicePage,
  "isNonZeroMoneyValue(summary.costBalanceLedgerAfter) && <div><strong>Negative Cost Balance After This Remittance</strong><br />{money(summary.costBalanceLedgerAfter)}</div>"
);
mustContain(
  "on-screen summary hides scenario 2 net excess when zero",
  invoicePage,
  "isNonZeroMoneyValue(summary.costBalanceReimbursementToProvider) && <div><strong>Cost Excess Added to Net Remit</strong><br />{money(summary.costBalanceReimbursementToProvider)}</div>"
);
mustContain(
  "on-screen summary hides deduction when zero",
  invoicePage,
  "isNonZeroMoneyValue(summary.costBalanceDeductionApplied) && <div><strong>Cost Deduction Applied</strong><br />{money(summary.costBalanceDeductionApplied)}</div>"
);

mustOccurExactly(
  "on-screen applied row",
  invoicePage,
  "<strong>Cost Excess Applied to Negative Cost Balance</strong><br />{money(summary.costBalanceAppliedToLedger)}",
  1
);
mustOccurExactly(
  "on-screen prior negative balance row",
  invoicePage,
  "<strong>Negative Cost Balance Before This Remittance</strong><br />{money(summary.costBalanceLedgerBefore)}",
  1
);
mustOccurExactly(
  "on-screen after negative balance row",
  invoicePage,
  "<strong>Negative Cost Balance After This Remittance</strong><br />{money(summary.costBalanceLedgerAfter)}",
  1
);
mustOccurExactly(
  "on-screen cost excess added row",
  invoicePage,
  "<strong>Cost Excess Added to Net Remit</strong><br />{money(summary.costBalanceReimbursementToProvider)}",
  1
);

mustNotContain("scenario 2 stale label", invoicePage, "Cost Balance Applied to Ledger");
mustNotContain("scenario 2 stale label", invoicePage, "Prior Cost Shortfall Balance");
mustNotContain("scenario 2 stale label", invoicePage, "Cost Shortfall Balance After This Remittance");
mustNotContain("scenario 2 stale label", invoicePage, "Cost Balance Added to Net Remit");
mustNotContain("scenario 2 stale label", invoicePage, "Cost Balance (lifetime)");
mustNotContain("scenario 2 stale label", invoicePage, "Cost Balance (prior)");
mustNotContain("scenario 2 stale label", invoicePage, "Cost Balance (after this remittance)");

const expectedScript = "node scripts/verify-scenario-2-negative-cost-balance-cost-excess-safety.mjs";
if (pkg.scripts?.["verify:scenario-2-negative-cost-balance-cost-excess-safety"] === expectedScript) {
  pass("package.json registers verify:scenario-2-negative-cost-balance-cost-excess-safety");
} else {
  fail("package.json missing verify:scenario-2-negative-cost-balance-cost-excess-safety registration");
}

if (failures) {
  console.error(`\nRESULT: scenario 2 negative cost balance cost excess safety FAILED (${failures})`);
  process.exit(1);
}

console.log("\nPASS: scenario 2 negative cost balance cost excess safety passed");
