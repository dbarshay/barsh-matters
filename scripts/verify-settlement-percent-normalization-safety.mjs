import { readFileSync } from "node:fs";
import fs from "node:fs";

const mattersPage = readFileSync("app/matters/page.tsx", "utf8");



function assertNotIncludes(haystack, needle, message) {
  if (haystack.includes(needle)) {
    console.error(`FAIL: ${message}`);
    console.error(`Unexpected text found: ${needle}`);
    process.exit(1);
  }
  console.log(`PASS: ${message}`);
}

function assertIncludes(haystack, needle, message) {
  if (!haystack.includes(needle)) {
    console.error(`FAIL: ${message}`);
    console.error(`Missing expected text: ${needle}`);
    process.exit(1);
  }
  console.log(`PASS: ${message}`);
}


const page = fs.readFileSync("app/matters/page.tsx", "utf8");
const historyRoute = readFileSync("app/api/settlements/local-history/route.ts", "utf8");
const previewRoute = readFileSync("app/api/settlements/local-preview/route.ts", "utf8");
const checks = [
  {
    label: "shared under-101 threshold helper exists",
    ok:
      page.includes("function masterSettlementAmountOrPercentShouldUsePercent(value: string): boolean") &&
      page.includes("n >= 0 && n < 101"),
  },
  {
    label: "bare numeric settlement principal under 101 is treated as percent",
    ok:
      page.includes("function masterSettlementAmountOrPercentValue(value: string): number") &&
      page.includes("masterSettlementAmountOrPercentShouldUsePercent(raw)") &&
      page.includes("return (masterSettlementBasisAmountValue() * percentage) / 100;"),
  },
  {
    label: "settlement principal display formatter uses shared threshold rule",
    ok:
      page.includes("function formatMasterSettlementAmountOrPercentInput(value: string): string") &&
      page.includes('const percentRaw = raw.endsWith("%") ? raw : `${raw}%`;') &&
      page.includes('`${formatMasterSettlementPercentInput(String(percentage))}%`'),
  },
  {
    label: "settlement interest percent value uses shared threshold rule",
    ok:
      page.includes("function masterSettlementInterestSettlementPercentValue(): number") &&
      page.includes("const interestBasis = masterSettlementSimpleInterestAmountValue();") &&
      page.includes("(settledInterestAmount / interestBasis) * 100"),
  },
  {
    label: "settlement calculated interest uses direct dollars above threshold",
    ok:
      page.includes("function masterSettlementCalculatedSettledInterestValue(): number") &&
      page.includes("return masterSettlementLooseNumericValue(raw);"),
  },
  {
    label: "settlement popup normalizes principal and interest amount fields on open",
    ok:
      page.includes("data-barsh-normalize-settlement-amount-percent-threshold-open-effect") &&
      page.includes("setMasterSettlementGrossInput((current) =>") &&
      page.includes("setMasterSettlementInterestAmountInput((current) =>"),
  },
];

let failed = 0;
for (const check of checks) {
  if (check.ok) {
    console.log(`PASS: ${check.label}`);
  } else {
    failed += 1;
    console.error(`FAIL: ${check.label}`);
  }
}

if (failed) {
  console.error(`\nSettlement percent normalization verifier failed: ${failed} check(s).`);
  process.exit(1);
}


assertIncludes(
  historyRoute,
  "principalSettlementDisplay",
  "local settlement history exposes original principal settlement display"
);

assertIncludes(
  historyRoute,
  "interestSettlementDisplay",
  "local settlement history exposes original interest settlement display"
);

assertIncludes(
  mattersPage,
  "Principal Settlement",
  "settlement history displays original principal settlement value"
);

assertIncludes(
  mattersPage,
  "Interest Settlement",
  "settlement history displays original interest settlement value"
);




assertIncludes(
  historyRoute,
  "costsAmount",
  "local settlement history exposes settlement costs amount"
);

assertIncludes(
  historyRoute,
  "totalSettlementAmount",
  "local settlement history exposes settlement grand total"
);

assertIncludes(
  historyRoute,
  "settlementTotal",
  "local settlement history exposes row settlement total"
);

assertIncludes(
  mattersPage,
  ">Costs<",
  "settlement history displays costs column/card"
);

assertIncludes(
  mattersPage,
  "row.settlementTotal",
  "settlement history row total replaces provider net display column"
);


assertIncludes(
  mattersPage,
  "Gross Total",
  "settlement history row table displays gross total footer"
);

assertIncludes(
  mattersPage,
  "colSpan={7}",
  "settlement history gross total aligns under total column"
);

assertNotIncludes(
  mattersPage,
  ">Principal Allocated<",
  "settlement history top summary omits principal allocated card"
);

assertNotIncludes(
  mattersPage,
  ">Interest Allocated<",
  "settlement history top summary omits interest allocated card"
);

assertNotIncludes(
  mattersPage,
  ">Provider Net<",
  "settlement history top summary/table omits provider net display"
);

assertNotIncludes(
  mattersPage,
  ">Rows<",
  "settlement history top summary omits rows card"
);


assertIncludes(
  mattersPage,
  "formatSettlementHistoryDate",
  "settlement history normalizes recorded settlement dates"
);

assertIncludes(
  mattersPage,
  "Column Totals",
  "settlement history table shows per-column totals before gross total"
);

assertIncludes(
  mattersPage,
  "formatSettlementHistoryMoney(record.allocatedSettlementTotal || 0)",
  "settlement history footer totals principal column"
);

assertIncludes(
  mattersPage,
  "formatSettlementHistoryMoney(record.interestAmountTotal || 0)",
  "settlement history footer totals interest column"
);

assertIncludes(
  mattersPage,
  "formatSettlementHistoryMoney(record.costsAmount || 0)",
  "settlement history footer totals costs column"
);

assertIncludes(
  mattersPage,
  "formatSettlementHistoryMoney(record.totalFee || 0)",
  "settlement history footer totals fee column"
);


assertIncludes(
  historyRoute,
  "derivedPrincipalPercent",
  "settlement history derives legacy principal percent when raw input is missing"
);

assertIncludes(
  historyRoute,
  "combinedSettlementDisplay",
  "settlement history displays settlement amount with percentage parenthetical"
);

assertIncludes(
  mattersPage,
  "principalSettlementInput: masterSettlementGrossInput",
  "settlement preview request preserves raw principal percent input"
);

assertIncludes(
  mattersPage,
  "interestSettlementInput: masterSettlementInterestAmountInput",
  "settlement preview request preserves raw interest percent input"
);

assertIncludes(
  previewRoute,
  "principalSettlementInput: clean(body.principalSettlementInput)",
  "settlement preview snapshot preserves raw principal input"
);

assertIncludes(
  previewRoute,
  "interestSettlementInput: clean(body.interestSettlementInput)",
  "settlement preview snapshot preserves raw interest input"
);


assertIncludes(
  historyRoute,
  "function displayMoney",
  "settlement history combined amount display uses currency formatter"
);

assertIncludes(
  historyRoute,
  "const amountDisplay = displayMoney(amount)",
  "settlement history parenthetical display formats amount as currency"
);


assertIncludes(
  historyRoute,
  "rowIndex === 0 ? costsAmount : 0",
  "settlement history allocates settlement costs to the first row when row snapshot lacks costs"
);


assertIncludes(
  mattersPage,
  "{masterCourtCostsDisplayValue()}",
  "master sidebar costs display uses shared court costs display value"
);

assertIncludes(
  mattersPage,
  "masterSettlementCostDefaultValue() -",
  "master sidebar balance uses shared court costs numeric value"
);

console.log("\nSettlement percent normalization verifier passed.");
