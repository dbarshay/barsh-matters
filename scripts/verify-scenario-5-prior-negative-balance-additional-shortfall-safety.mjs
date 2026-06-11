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

console.log("=== VERIFY SCENARIO 5: PRIOR NEGATIVE BALANCE + ADDITIONAL SHORTFALL + 25% DEDUCTION ===");

mustContain(
  "scenario 5 computes current shortfall",
  previewRoute,
  "const currentPeriodNegativeCostBalance = moneyNumber(Math.max(0, -costBalanceThisRemittancePeriod));"
);

mustMatch(
  "scenario 5 computes 25 percent cap",
  previewRoute,
  /const costBalanceDeductionCap = moneyNumber\([^;]*baseNetRemitToProvider\s*\*\s*0\.25[^;]*\);/,
  "costBalanceDeductionCap based on baseNetRemitToProvider * 0.25"
);

mustContain(
  "scenario 5 caps deduction at lesser of total recoverable negative balance and 25 percent cap",
  previewRoute,
  "const costBalanceDeductionApplied = moneyNumber(Math.min(totalRecoverableNegativeCostBalance, costBalanceDeductionCap));"
);

mustContain(
  "scenario 5 carries unrecovered current shortfall forward after current-shortfall deduction",
  previewRoute,
  "const costBalanceAddedToLedger = moneyNumber(Math.max(0, currentPeriodNegativeCostBalance - currentShortfallDeductionApplied));"
);

mustContain(
  "scenario 5 updates prior negative balance after current excess, prior-balance deduction, and unrecovered current shortfall",
  previewRoute,
  "const costBalanceLedgerAfter = moneyNumber(Math.max(0, costBalanceLedgerBefore - costBalanceAppliedToLedger - priorBalanceDeductionApplied + costBalanceAddedToLedger));"
);

mustContain(
  "scenario 5 deducts applied amount from net remit",
  previewRoute,
  "const costBalanceAdjustmentToNetRemit = moneyNumber(costBalanceReimbursementToProvider - costBalanceDeductionApplied);"
);

mustContain(
  "scenario 5 final net remit includes deduction",
  previewRoute,
  "const netRemitToProviderTotal = moneyNumber(baseNetRemitToProvider + costBalanceAdjustmentToNetRemit);"
);

mustContain("scenario 5 totals snapshot includes ledger before", previewRoute, "costBalanceLedgerBefore,");
mustContain("scenario 5 totals snapshot includes deduction cap", previewRoute, "costBalanceDeductionCap,");
mustContain("scenario 5 totals snapshot includes deduction applied", previewRoute, "costBalanceDeductionApplied,");
mustContain("scenario 5 totals snapshot includes amount added to negative balance", previewRoute, "costBalanceAddedToLedger,");
mustContain("scenario 5 totals snapshot includes ledger after", previewRoute, "costBalanceLedgerAfter,");
mustContain("scenario 5 totals snapshot includes final net remit", previewRoute, "netRemitToProviderTotal,");

mustContain(
  "create route freezes scenario 5 totals snapshot",
  createRoute,
  "totalsSnapshot: jsonOrNull(totals)"
);

mustContain(
  "create route persists scenario 5 ledger before column",
  createRoute,
  "costBalanceLedgerBefore: moneyNumber(totals?.costBalanceLedgerBefore)"
);

mustContain(
  "create route persists scenario 5 deduction cap column",
  createRoute,
  "costBalanceDeductionCap: moneyNumber(totals?.costBalanceDeductionCap)"
);

mustContain(
  "create route persists scenario 5 ledger after column",
  createRoute,
  "costBalanceLedgerAfter: moneyNumber(totals?.costBalanceLedgerAfter)"
);

mustContain(
  "create route persists scenario 5 final net remit column",
  createRoute,
  "netRemitToProviderTotal: moneyNumber(totals?.netRemitToProviderTotal)"
);

mustContain(
  "printable Scenario 5 prior negative balance",
  invoicePage,
  "Negative Cost Balance Before This Remittance</span><span>${safeHtml(money(printableCostSummary.costBalanceLedgerBefore))}</span>"
);

mustContain(
  "printable Scenario 5 deduction cap",
  invoicePage,
  "25% Deduction Cap</span><span>${safeHtml(money(printableCostSummary.costBalanceDeductionCap))}</span>"
);

mustContain(
  "printable Scenario 5 after balance",
  invoicePage,
  "Negative Cost Balance After This Remittance</span><span>${safeHtml(money(printableCostSummary.costBalanceLedgerAfter))}</span>"
);

mustContain(
  "printable Scenario 5 deduction applied is emphasized/red",
  invoicePage,
  "<div class=\"summary-emphasis\"><span>Cost Deduction Applied</span><span class=\"negative-remit-adjustment\">${safeHtml(money(printableCostSummary.costBalanceDeductionApplied))}</span></div>"
);

mustContain(
  "on-screen Scenario 5 prior negative balance",
  invoicePage,
  'hasPriorNegativeBalance && <Row label="Negative Cost Balance Before This Remittance" value={summary.costBalanceLedgerBefore} />'
);

mustContain(
  "on-screen Scenario 5 deduction cap",
  invoicePage,
  'hasDeduction && <Row label="25% Deduction Cap" value={summary.costBalanceDeductionCap} variant="blue" />'
);

mustContain(
  "on-screen Scenario 5 after balance",
  invoicePage,
  'hasAfterNegativeBalance && <Row label="Negative Cost Balance After This Remittance" value={summary.costBalanceLedgerAfter} />'
);

mustContain(
  "on-screen Scenario 5 deduction applied is emphasized/red",
  invoicePage,
  'hasDeduction && <Row label="Cost Deduction Applied" value={summary.costBalanceDeductionApplied} variant="red" />'
);

assertOrder(
  "on-screen Scenario 5 deduction-to-final order",
  invoicePage,
  [
    '<Row label="Negative Cost Balance After This Remittance" value={summary.costBalanceLedgerAfter} />',
    '<Row label="Cost Deduction Applied" value={summary.costBalanceDeductionApplied} variant="red" />',
    '<div>Final Net Remit to Provider</div>',
  ]
);

mustNotContain("scenario 5 stale label", invoicePage, "Cost Balance Applied to Ledger");
mustNotContain("scenario 5 stale label", invoicePage, "Prior Cost Shortfall Balance");
mustNotContain("scenario 5 stale label", invoicePage, "Cost Shortfall Balance After This Remittance");
mustNotContain("scenario 5 stale label", invoicePage, "Cost Balance Added to Net Remit");

const expectedScript = "node scripts/verify-scenario-5-prior-negative-balance-additional-shortfall-safety.mjs";
if (pkg.scripts?.["verify:scenario-5-prior-negative-balance-additional-shortfall-safety"] === expectedScript) {
  pass("package.json registers verify:scenario-5-prior-negative-balance-additional-shortfall-safety");
} else {
  fail("package.json missing verify:scenario-5-prior-negative-balance-additional-shortfall-safety registration");
}

if (failures) {
  console.error(`\nRESULT: scenario 5 prior negative balance additional shortfall safety FAILED (${failures})`);
  process.exit(1);
}

console.log("\nPASS: scenario 5 prior negative balance additional shortfall safety passed");
