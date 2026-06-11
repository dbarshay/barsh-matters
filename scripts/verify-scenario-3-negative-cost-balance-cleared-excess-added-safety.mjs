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

console.log("=== VERIFY SCENARIO 3: PRIOR NEGATIVE COST BALANCE CLEARED + EXCESS ADDED TO NET REMIT ===");

mustContain(
  "scenario 3 applies current excess to prior negative balance first",
  previewRoute,
  "const costBalanceAppliedToLedger = moneyNumber(Math.min(currentPeriodPositiveCostBalance, costBalanceLedgerBefore));"
);

mustContain(
  "scenario 3 computes remaining excess after prior negative balance",
  previewRoute,
  "const costBalanceReimbursementToProvider = moneyNumber(Math.max(0, currentPeriodPositiveCostBalance - costBalanceAppliedToLedger));"
);

mustContain(
  "scenario 3 clears negative cost balance after applied excess",
  previewRoute,
  "const costBalanceLedgerAfter = moneyNumber(Math.max(0, costBalanceLedgerBefore - costBalanceAppliedToLedger - priorBalanceDeductionApplied + costBalanceAddedToLedger));"
);

mustContain(
  "scenario 3 adds remaining excess to net remit",
  previewRoute,
  "const costBalanceAdjustmentToNetRemit = moneyNumber(costBalanceReimbursementToProvider - costBalanceDeductionApplied);"
);

mustContain(
  "scenario 3 final net remit includes excess reimbursement",
  previewRoute,
  "const netRemitToProviderTotal = moneyNumber(baseNetRemitToProvider + costBalanceAdjustmentToNetRemit);"
);

mustContain("scenario 3 totals snapshot includes applied amount", previewRoute, "costBalanceAppliedToLedger,");
mustContain("scenario 3 totals snapshot includes excess added to net remit", previewRoute, "costBalanceReimbursementToProvider,");
mustContain("scenario 3 totals snapshot includes ledger before", previewRoute, "costBalanceLedgerBefore,");
mustContain("scenario 3 totals snapshot includes ledger after", previewRoute, "costBalanceLedgerAfter,");
mustContain("scenario 3 totals snapshot includes final net remit", previewRoute, "netRemitToProviderTotal,");

mustContain(
  "create route persists scenario 3 totals snapshot",
  createRoute,
  "totalsSnapshot: jsonOrNull(totals)"
);

mustContain(
  "create route persists scenario 3 ledger before column",
  createRoute,
  "costBalanceLedgerBefore: moneyNumber(totals?.costBalanceLedgerBefore)"
);

mustContain(
  "create route persists scenario 3 ledger after column",
  createRoute,
  "costBalanceLedgerAfter: moneyNumber(totals?.costBalanceLedgerAfter)"
);

mustContain(
  "create route persists scenario 3 final net remit column",
  createRoute,
  "netRemitToProviderTotal: moneyNumber(totals?.netRemitToProviderTotal)"
);

mustContain(
  "printable summary red negative remit adjustment CSS",
  invoicePage,
  ".negative-remit-adjustment { color: #b91c1c; font-weight: 900; }"
);

mustContain(
  "printable summary scenario 3 prior negative balance",
  invoicePage,
  "Negative Cost Balance Before This Remittance</span><span>${safeHtml(money(printableCostSummary.costBalanceLedgerBefore))}</span>"
);

mustContain(
  "printable summary scenario 3 applied amount is red",
  invoicePage,
  "Cost Excess Applied to Negative Cost Balance</span><span class=\"negative-remit-adjustment\">${safeHtml(money(printableCostSummary.costBalanceAppliedToLedger))}</span>"
);

mustContain(
  "printable summary scenario 3 excess added to net remit",
  invoicePage,
  "<div class=\"summary-emphasis\"><span>Cost Excess Added to Net Remit</span><span>${safeHtml(money(printableCostSummary.costBalanceReimbursementToProvider))}</span></div>"
);

mustContain(
  "on-screen summary scenario 3 prior negative balance",
  invoicePage,
  'hasPriorNegativeBalance && <Row label="Negative Cost Balance Before This Remittance" value={summary.costBalanceLedgerBefore} />'
);

mustContain(
  "on-screen summary scenario 3 applied amount",
  invoicePage,
  'hasCostExcessApplied && <Row label="Cost Excess Applied to Negative Cost Balance" value={summary.costBalanceAppliedToLedger} variant="red" />'
);

mustContain(
  "on-screen summary scenario 3 excess added to net remit",
  invoicePage,
  'hasCostExcessAdded && <Row label="Cost Excess Added to Net Remit" value={summary.costBalanceReimbursementToProvider} variant="blue" />'
);

assertOrder(
  "on-screen scenario 3 row order",
  invoicePage,
  [
    '<Row label="Cost Excess / Shortfall This Remittance" value={summary.costBalanceThisRemittancePeriod} variant="shaded" />',
    '<Row label="Negative Cost Balance Before This Remittance" value={summary.costBalanceLedgerBefore} />',
    '<Row label="Cost Excess Applied to Negative Cost Balance" value={summary.costBalanceAppliedToLedger} variant="red" />',
    '<Row label="Cost Excess Added to Net Remit" value={summary.costBalanceReimbursementToProvider} variant="blue" />',
    '<div>Final Net Remit to Provider</div>',
  ]
);

assertOrder(
  "printable scenario 3 row order",
  invoicePage,
  [
    '${printableNegativeCostBalanceBeforeHtml}',
    '${printableCostBalanceAppliedToLedgerHtml}',
    '${printableNegativeCostBalanceAfterHtml}',
    '${printableCostExcessAddedToNetRemitHtml}',
    '${printableCostDeductionAppliedHtml}',
  ]
);

mustNotContain("scenario 3 stale label", invoicePage, "Cost Balance Applied to Ledger");
mustNotContain("scenario 3 stale label", invoicePage, "Prior Cost Shortfall Balance");
mustNotContain("scenario 3 stale label", invoicePage, "Cost Shortfall Balance After This Remittance");
mustNotContain("scenario 3 stale label", invoicePage, "Cost Balance Added to Net Remit");

const expectedScript = "node scripts/verify-scenario-3-negative-cost-balance-cleared-excess-added-safety.mjs";
if (pkg.scripts?.["verify:scenario-3-negative-cost-balance-cleared-excess-added-safety"] === expectedScript) {
  pass("package.json registers verify:scenario-3-negative-cost-balance-cleared-excess-added-safety");
} else {
  fail("package.json missing verify:scenario-3-negative-cost-balance-cleared-excess-added-safety registration");
}

if (failures) {
  console.error(`\nRESULT: scenario 3 negative cost balance cleared excess added safety FAILED (${failures})`);
  process.exit(1);
}

console.log("\nPASS: scenario 3 negative cost balance cleared excess added safety passed");
