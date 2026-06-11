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

console.log("=== VERIFY SCENARIO 6: SHORTFALL FULLY DEDUCTED WITHIN 25% CAP ===");

mustContain(
  "scenario 6 computes current shortfall",
  previewRoute,
  "const currentPeriodNegativeCostBalance = moneyNumber(Math.max(0, -costBalanceThisRemittancePeriod));"
);

mustMatch(
  "scenario 6 computes 25 percent cap in background",
  previewRoute,
  /const costBalanceDeductionCap = moneyNumber\([^;]*baseNetRemitToProvider\s*\*\s*0\.25[^;]*\);/,
  "costBalanceDeductionCap based on baseNetRemitToProvider * 0.25"
);

mustContain(
  "scenario 6 caps deduction at lesser of total recoverable negative balance and 25 percent cap",
  previewRoute,
  "const costBalanceDeductionApplied = moneyNumber(Math.min(totalRecoverableNegativeCostBalance, costBalanceDeductionCap));"
);

mustContain(
  "scenario 6 carries forward only unrecovered current shortfall after current-shortfall deduction",
  previewRoute,
  "const costBalanceAddedToLedger = moneyNumber(Math.max(0, currentPeriodNegativeCostBalance - currentShortfallDeductionApplied));"
);

mustContain(
  "scenario 6 final net remit includes deduction",
  previewRoute,
  "const netRemitToProviderTotal = moneyNumber(baseNetRemitToProvider + costBalanceAdjustmentToNetRemit);"
);

mustContain("scenario 6 background totals include deduction cap", previewRoute, "costBalanceDeductionCap,");
mustContain("scenario 6 background totals include deduction applied", previewRoute, "costBalanceDeductionApplied,");
mustContain("scenario 6 background totals include carried-forward shortfall amount", previewRoute, "costBalanceAddedToLedger,");
mustContain("scenario 6 background totals include ledger after", previewRoute, "costBalanceLedgerAfter,");
mustContain("scenario 6 background totals include final net remit", previewRoute, "netRemitToProviderTotal,");

mustContain(
  "create route freezes scenario 6 totals snapshot",
  createRoute,
  "totalsSnapshot: jsonOrNull(totals)"
);

mustContain(
  "create route persists scenario 6 deduction cap column",
  createRoute,
  "costBalanceDeductionCap: moneyNumber(totals?.costBalanceDeductionCap)"
);

mustContain(
  "create route persists scenario 6 ledger after column",
  createRoute,
  "costBalanceLedgerAfter: moneyNumber(totals?.costBalanceLedgerAfter)"
);

mustContain(
  "create route persists scenario 6 final net remit column",
  createRoute,
  "netRemitToProviderTotal: moneyNumber(totals?.netRemitToProviderTotal)"
);

mustContain(
  "printable Scenario 6 cap row is conditional on cost deduction applied",
  invoicePage,
  "const printableCostDeductionCapHtml = isNonZeroMoneyValue(printableCostSummary.costBalanceDeductionApplied)"
);

mustContain(
  "on-screen Scenario 6 cap row is conditional on cost deduction applied",
  invoicePage,
  "isNonZeroMoneyValue(summary.costBalanceDeductionApplied) && <div><strong>25% Deduction Cap</strong><br />{money(summary.costBalanceDeductionCap)}</div>"
);

mustContain(
  "printable Scenario 6 deduction applied is emphasized/red",
  invoicePage,
  "<div class=\"summary-emphasis\"><span>Cost Deduction Applied</span><span class=\"negative-remit-adjustment\">${safeHtml(money(printableCostSummary.costBalanceDeductionApplied))}</span></div>"
);

mustContain(
  "on-screen Scenario 6 deduction applied is emphasized/red",
  invoicePage,
  "isNonZeroMoneyValue(summary.costBalanceDeductionApplied) && <div style={{ paddingLeft: 28, fontWeight: 950 }}><strong>Cost Deduction Applied</strong><br /><span style={{ color: \"#b91c1c\", fontWeight: 900 }}>{money(summary.costBalanceDeductionApplied)}</span></div>"
);

mustNotContain(
  "on-screen Scenario 6 old cap display rule",
  invoicePage,
  "summary.costBalanceThisRemittancePeriod < 0 && <div><strong>25% Deduction Cap</strong><br />{money(summary.costBalanceDeductionCap)}</div>"
);

const expectedScript = "node scripts/verify-scenario-6-shortfall-fully-deducted-within-cap-safety.mjs";
if (pkg.scripts?.["verify:scenario-6-shortfall-fully-deducted-within-cap-safety"] === expectedScript) {
  pass("package.json registers verify:scenario-6-shortfall-fully-deducted-within-cap-safety");
} else {
  fail("package.json missing verify:scenario-6-shortfall-fully-deducted-within-cap-safety registration");
}

if (failures) {
  console.error(`\nRESULT: scenario 6 shortfall fully deducted within cap safety FAILED (${failures})`);
  process.exit(1);
}

console.log("\nPASS: scenario 6 shortfall fully deducted within cap safety passed");
