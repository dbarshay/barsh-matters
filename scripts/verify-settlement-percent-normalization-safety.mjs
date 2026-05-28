import fs from "node:fs";

const page = fs.readFileSync("app/matters/page.tsx", "utf8");

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

console.log("\nSettlement percent normalization verifier passed.");
