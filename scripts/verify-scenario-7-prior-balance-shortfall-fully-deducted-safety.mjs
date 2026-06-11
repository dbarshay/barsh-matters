#!/usr/bin/env node
import fs from "fs";

const invoicePage = fs.readFileSync("app/admin/clients/[id]/invoice/page.tsx", "utf8");
const previewRoute = fs.readFileSync("app/api/admin/clients/[id]/invoice/create-preview/route.ts", "utf8");
const createRoute = fs.readFileSync("app/api/admin/clients/[id]/invoice/create/route.ts", "utf8");
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

function mustMatch(label, body, regex, description) {
  if (regex.test(body)) pass(`${label}: found ${description}`);
  else fail(`${label}: missing ${description}`);
}

function assertOrder(label, body, markers) {
  let last = -1;
  for (const marker of markers) {
    const index = body.indexOf(marker);
    if (index === -1) {
      fail(`${label}: missing order marker ${marker}`);
      return;
    }
    if (index <= last) {
      fail(`${label}: marker out of order ${marker}`);
      return;
    }
    last = index;
  }
  pass(`${label}: order is correct`);
}

console.log("=== VERIFY SCENARIO 7: PRIOR NEGATIVE BALANCE + CURRENT SHORTFALL + UNUSED CAP APPLIED TO PRIOR BALANCE ===");

mustContain(
  "scenario 7 computes current shortfall",
  previewRoute,
  "const currentPeriodNegativeCostBalance = moneyNumber(Math.max(0, -costBalanceThisRemittancePeriod));"
);

mustMatch(
  "scenario 7 computes 25 percent cap in background",
  previewRoute,
  /const costBalanceDeductionCap = moneyNumber\([^;]*baseNetRemitToProvider\s*\*\s*0\.25[^;]*\);/,
  "costBalanceDeductionCap based on baseNetRemitToProvider * 0.25"
);

mustContain(
  "scenario 7 computes total recoverable negative balance from current shortfall plus prior balance after current excess",
  previewRoute,
  "const totalRecoverableNegativeCostBalance = moneyNumber(currentPeriodNegativeCostBalance + Math.max(0, costBalanceLedgerBefore - costBalanceAppliedToLedger));"
);

mustContain(
  "scenario 7 caps deduction at lesser of total recoverable negative balance and 25 percent cap",
  previewRoute,
  "const costBalanceDeductionApplied = moneyNumber(Math.min(totalRecoverableNegativeCostBalance, costBalanceDeductionCap));"
);

mustContain(
  "scenario 7 applies deduction first to current shortfall",
  previewRoute,
  "const currentShortfallDeductionApplied = moneyNumber(Math.min(currentPeriodNegativeCostBalance, costBalanceDeductionApplied));"
);

mustContain(
  "scenario 7 applies unused cap room to prior negative balance",
  previewRoute,
  "const priorBalanceDeductionApplied = moneyNumber(Math.max(0, costBalanceDeductionApplied - currentShortfallDeductionApplied));"
);

mustContain(
  "scenario 7 carries forward only unrecovered current shortfall",
  previewRoute,
  "const costBalanceAddedToLedger = moneyNumber(Math.max(0, currentPeriodNegativeCostBalance - currentShortfallDeductionApplied));"
);

mustContain(
  "scenario 7 reduces prior balance by unused cap room after current shortfall deduction",
  previewRoute,
  "const costBalanceLedgerAfter = moneyNumber(Math.max(0, costBalanceLedgerBefore - costBalanceAppliedToLedger - priorBalanceDeductionApplied + costBalanceAddedToLedger));"
);

mustContain(
  "scenario 7 deducts applied amount from final net remit",
  previewRoute,
  "const costBalanceAdjustmentToNetRemit = moneyNumber(costBalanceReimbursementToProvider - costBalanceDeductionApplied);"
);

mustContain(
  "scenario 7 final net remit includes current deduction",
  previewRoute,
  "const netRemitToProviderTotal = moneyNumber(baseNetRemitToProvider + costBalanceAdjustmentToNetRemit);"
);

mustContain("scenario 7 totals snapshot includes ledger before", previewRoute, "costBalanceLedgerBefore,");
mustContain("scenario 7 totals snapshot includes deduction cap", previewRoute, "costBalanceDeductionCap,");
mustContain("scenario 7 totals snapshot includes deduction applied", previewRoute, "costBalanceDeductionApplied,");
mustContain("scenario 7 totals snapshot includes carried-forward current shortfall", previewRoute, "costBalanceAddedToLedger,");
mustContain("scenario 7 totals snapshot includes ledger after", previewRoute, "costBalanceLedgerAfter,");
mustContain("scenario 7 totals snapshot includes final net remit", previewRoute, "netRemitToProviderTotal,");

mustContain(
  "create route freezes scenario 7 totals snapshot",
  createRoute,
  "totalsSnapshot: jsonOrNull(totals)"
);

mustContain(
  "create route persists scenario 7 ledger before column",
  createRoute,
  "costBalanceLedgerBefore: moneyNumber(totals?.costBalanceLedgerBefore)"
);

mustContain(
  "create route persists scenario 7 deduction cap column",
  createRoute,
  "costBalanceDeductionCap: moneyNumber(totals?.costBalanceDeductionCap)"
);

mustContain(
  "create route persists scenario 7 ledger after column",
  createRoute,
  "costBalanceLedgerAfter: moneyNumber(totals?.costBalanceLedgerAfter)"
);

mustContain(
  "create route persists scenario 7 final net remit column",
  createRoute,
  "netRemitToProviderTotal: moneyNumber(totals?.netRemitToProviderTotal)"
);

mustContain(
  "printable Scenario 7 prior negative balance",
  invoicePage,
  "Negative Cost Balance Before This Remittance</span><span>${safeHtml(money(printableCostSummary.costBalanceLedgerBefore))}</span>"
);

mustContain(
  "printable Scenario 7 after balance",
  invoicePage,
  "Negative Cost Balance After This Remittance</span><span>${safeHtml(money(printableCostSummary.costBalanceLedgerAfter))}</span>"
);

mustContain(
  "printable Scenario 7 cap shown when cost deduction is applied",
  invoicePage,
  "const printableCostDeductionCapHtml = isNonZeroMoneyValue(printableCostSummary.costBalanceDeductionApplied)"
);

mustContain(
  "on-screen Scenario 7 cap shown when cost deduction is applied",
  invoicePage,
  "isNonZeroMoneyValue(summary.costBalanceDeductionApplied) && <div><strong>25% Deduction Cap</strong><br />{money(summary.costBalanceDeductionCap)}</div>"
);

mustContain(
  "printable Scenario 7 deduction applied is emphasized/red",
  invoicePage,
  "<div class=\"summary-emphasis\"><span>Cost Deduction Applied</span><span class=\"negative-remit-adjustment\">${safeHtml(money(printableCostSummary.costBalanceDeductionApplied))}</span></div>"
);

mustContain(
  "on-screen Scenario 7 prior negative balance",
  invoicePage,
  "isNonZeroMoneyValue(summary.costBalanceLedgerBefore) && <div><strong>Negative Cost Balance Before This Remittance</strong><br />{money(summary.costBalanceLedgerBefore)}</div>"
);

mustContain(
  "on-screen Scenario 7 after balance",
  invoicePage,
  "isNonZeroMoneyValue(summary.costBalanceLedgerAfter) && <div><strong>Negative Cost Balance After This Remittance</strong><br />{money(summary.costBalanceLedgerAfter)}</div>"
);

mustContain(
  "on-screen Scenario 7 deduction applied is emphasized/red",
  invoicePage,
  "isNonZeroMoneyValue(summary.costBalanceDeductionApplied) && <div style={{ paddingLeft: 28, fontWeight: 950 }}><strong>Cost Deduction Applied</strong><br /><span style={{ color: \"#b91c1c\", fontWeight: 900 }}>{money(summary.costBalanceDeductionApplied)}</span></div>"
);

assertOrder(
  "on-screen Scenario 7 balance/deduction/final order",
  invoicePage,
  [
    "<strong>Negative Cost Balance Before This Remittance</strong><br />{money(summary.costBalanceLedgerBefore)}",
    "<strong>Negative Cost Balance After This Remittance</strong><br />{money(summary.costBalanceLedgerAfter)}",
    "<strong>Cost Deduction Applied</strong><br /><span style={{ color: \"#b91c1c\", fontWeight: 900 }}>{money(summary.costBalanceDeductionApplied)}</span>",
    "<strong>Final Net Remit to Provider</strong><br />{money(summary.netRemitToProviderTotal)}",
  ]
);

mustNotContain(
  "on-screen Scenario 7 old cap display rule",
  invoicePage,
  "summary.costBalanceThisRemittancePeriod < 0 && <div><strong>25% Deduction Cap</strong><br />{money(summary.costBalanceDeductionCap)}</div>"
);

mustNotContain("scenario 7 stale label", invoicePage, "Cost Balance Applied to Ledger");
mustNotContain("scenario 7 stale label", invoicePage, "Prior Cost Shortfall Balance");
mustNotContain("scenario 7 stale label", invoicePage, "Cost Shortfall Balance After This Remittance");
mustNotContain("scenario 7 stale label", invoicePage, "Cost Balance Added to Net Remit");

const expectedScript = "node scripts/verify-scenario-7-prior-balance-shortfall-fully-deducted-safety.mjs";
if (pkg.scripts?.["verify:scenario-7-prior-balance-shortfall-fully-deducted-safety"] === expectedScript) {
  pass("package.json registers verify:scenario-7-prior-balance-shortfall-fully-deducted-safety");
} else {
  fail("package.json missing verify:scenario-7-prior-balance-shortfall-fully-deducted-safety registration");
}

if (failures) {
  console.error(`\nRESULT: scenario 7 prior balance shortfall fully deducted safety FAILED (${failures})`);
  process.exit(1);
}

console.log("\nPASS: scenario 7 prior balance shortfall fully deducted safety passed");
