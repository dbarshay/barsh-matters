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

console.log("=== VERIFY SCENARIO 4: NO PRIOR NEGATIVE BALANCE + COST SHORTFALL + 25% DEDUCTION ===");

mustContain(
  "scenario 4 computes current shortfall",
  previewRoute,
  "const currentPeriodNegativeCostBalance = moneyNumber(Math.max(0, -costBalanceThisRemittancePeriod));"
);

mustMatch(
  "scenario 4 computes 25 percent cap",
  previewRoute,
  /const costBalanceDeductionCap = moneyNumber\([^;]*baseNetRemitToProvider\s*\*\s*0\.25[^;]*\);/,
  "costBalanceDeductionCap based on baseNetRemitToProvider * 0.25"
);

mustContain(
  "scenario 4 caps deduction at lesser of shortfall and 25 percent cap",
  previewRoute,
  "const costBalanceDeductionApplied = moneyNumber(Math.min(currentPeriodNegativeCostBalance, costBalanceDeductionCap));"
);

mustContain(
  "scenario 4 carries excess shortfall forward",
  previewRoute,
  "const costBalanceAddedToLedger = moneyNumber(Math.max(0, currentPeriodNegativeCostBalance - costBalanceDeductionApplied));"
);

mustContain(
  "scenario 4 updates after balance",
  previewRoute,
  "const costBalanceLedgerAfter = moneyNumber(Math.max(0, costBalanceLedgerBefore - costBalanceAppliedToLedger + costBalanceAddedToLedger));"
);

mustContain(
  "scenario 4 deducts from final net remit",
  previewRoute,
  "const costBalanceAdjustmentToNetRemit = moneyNumber(costBalanceReimbursementToProvider - costBalanceDeductionApplied);"
);

mustContain(
  "scenario 4 final net remit includes deduction",
  previewRoute,
  "const netRemitToProviderTotal = moneyNumber(baseNetRemitToProvider + costBalanceAdjustmentToNetRemit);"
);

mustContain("scenario 4 totals snapshot includes deduction cap", previewRoute, "costBalanceDeductionCap,");
mustContain("scenario 4 totals snapshot includes deduction applied", previewRoute, "costBalanceDeductionApplied,");
mustContain("scenario 4 totals snapshot includes amount added to negative balance", previewRoute, "costBalanceAddedToLedger,");
mustContain("scenario 4 totals snapshot includes ledger after", previewRoute, "costBalanceLedgerAfter,");
mustContain("scenario 4 totals snapshot includes final net remit", previewRoute, "netRemitToProviderTotal,");

mustContain(
  "create route freezes scenario 4 totals snapshot",
  createRoute,
  "totalsSnapshot: jsonOrNull(totals)"
);

mustContain(
  "create route persists scenario 4 deduction cap column",
  createRoute,
  "costBalanceDeductionCap: moneyNumber(totals?.costBalanceDeductionCap)"
);

mustContain(
  "create route persists scenario 4 ledger after column",
  createRoute,
  "costBalanceLedgerAfter: moneyNumber(totals?.costBalanceLedgerAfter)"
);

mustContain(
  "create route persists scenario 4 final net remit column",
  createRoute,
  "netRemitToProviderTotal: moneyNumber(totals?.netRemitToProviderTotal)"
);

mustContain(
  "printable Scenario 4 deduction cap",
  invoicePage,
  "25% Deduction Cap</span><span>${safeHtml(money(printableCostSummary.costBalanceDeductionCap))}</span>"
);

mustContain(
  "printable Scenario 4 after balance",
  invoicePage,
  "Negative Cost Balance After This Remittance</span><span>${safeHtml(money(printableCostSummary.costBalanceLedgerAfter))}</span>"
);

mustContain(
  "printable Scenario 4 deduction applied is emphasized/red",
  invoicePage,
  "<div class=\"summary-emphasis\"><span>Cost Deduction Applied</span><span class=\"negative-remit-adjustment\">${safeHtml(money(printableCostSummary.costBalanceDeductionApplied))}</span></div>"
);

mustContain(
  "on-screen Scenario 4 deduction cap",
  invoicePage,
  "isNonZeroMoneyValue(summary.costBalanceAddedToLedger) && <div><strong>25% Deduction Cap</strong><br />{money(summary.costBalanceDeductionCap)}</div>"
);

mustContain(
  "on-screen Scenario 4 after balance",
  invoicePage,
  "isNonZeroMoneyValue(summary.costBalanceLedgerAfter) && <div><strong>Negative Cost Balance After This Remittance</strong><br />{money(summary.costBalanceLedgerAfter)}</div>"
);

mustContain(
  "on-screen Scenario 4 deduction applied is emphasized/red",
  invoicePage,
  "isNonZeroMoneyValue(summary.costBalanceDeductionApplied) && <div style={{ paddingLeft: 28, fontWeight: 950 }}><strong>Cost Deduction Applied</strong><br /><span style={{ color: \"#b91c1c\", fontWeight: 900 }}>{money(summary.costBalanceDeductionApplied)}</span></div>"
);

assertOrder(
  "on-screen Scenario 4 deduction-to-final order",
  invoicePage,
  [
    "<strong>Negative Cost Balance After This Remittance</strong><br />{money(summary.costBalanceLedgerAfter)}",
    "<strong>Cost Deduction Applied</strong><br /><span style={{ color: \"#b91c1c\", fontWeight: 900 }}>{money(summary.costBalanceDeductionApplied)}</span>",
    "<strong>Final Net Remit to Provider</strong><br />{money(summary.netRemitToProviderTotal)}",
  ]
);

mustNotContain("scenario 4 stale label", invoicePage, "Cost Balance Applied to Ledger");
mustNotContain("scenario 4 stale label", invoicePage, "Prior Cost Shortfall Balance");
mustNotContain("scenario 4 stale label", invoicePage, "Cost Shortfall Balance After This Remittance");
mustNotContain("scenario 4 stale label", invoicePage, "Cost Balance Added to Net Remit");

const expectedScript = "node scripts/verify-scenario-4-cost-shortfall-25-percent-deduction-safety.mjs";
if (pkg.scripts?.["verify:scenario-4-cost-shortfall-25-percent-deduction-safety"] === expectedScript) {
  pass("package.json registers verify:scenario-4-cost-shortfall-25-percent-deduction-safety");
} else {
  fail("package.json missing verify:scenario-4-cost-shortfall-25-percent-deduction-safety registration");
}

if (failures) {
  console.error(`\nRESULT: scenario 4 cost shortfall 25 percent deduction safety FAILED (${failures})`);
  process.exit(1);
}

console.log("\nPASS: scenario 4 cost shortfall 25 percent deduction safety passed");
