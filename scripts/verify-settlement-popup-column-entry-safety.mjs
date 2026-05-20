import fs from "node:fs";

let failures = 0;

function read(path) {
  try {
    return fs.readFileSync(path, "utf8");
  } catch {
    failures += 1;
    console.error(`FAIL: missing ${path}`);
    return "";
  }
}

function mustContain(label, text, needle) {
  if (text.includes(needle)) console.log(`PASS: ${label}: found ${needle}`);
  else {
    failures += 1;
    console.error(`FAIL: ${label}: missing ${needle}`);
  }
}

const page = read("app/matters/page.tsx");

console.log("=== SETTLEMENT POPUP COLUMN ENTRY SAFETY VERIFICATION ===");

[
  "handleMasterSettlementEntryKeyDown",
  "data-master-settlement-entry-field",
  "masterSettlementAmountOrPercentValue",
  "formatMasterSettlementAmountOrPercentInput",
  "masterSettlementLawsuitAmountValue",
  "addDaysToDateInput",
  "Payment Due Date",
  "Costs",
  "alignItems: \"start\"",
  "allocationRatio",
  "settledCosts",
  "settledInterest",
  "Settled Costs",
  "masterSettlementInterestDaysValue",
  "Interest Days",
  "masterSettlementBasisAmountValue() * dailyRate * masterSettlementInterestDaysValue()",
  "masterSettlementSimpleInterestAmountValue() * (masterSettlementInterestSettlementPercentValue() / 100)",
  "placeholder=\"%\"",
  "gridTemplateColumns: \"0.65fr auto auto auto 0.85fr\"",
  "value={masterSettlementSettledInterestInput || money(masterSettlementCalculatedSettledInterestValue())}",
  "Editable settled interest amount",
  "fontSize: 18",
  "setMasterSettlementSettledInterestInput",
  "masterSettlementCalculatedSettledInterestValue",
  "masterSettlementSettledInterestInput",
  "money(masterSettlementSimpleInterestAmountValue())",
  ">=</span>",
  ">of</span>",
  "masterSettlementInterestSettlementPercentValue",
  "masterSettlementSimpleInterestAmountValue",
  "flexWrap: \"wrap\"",
  "display: \"flex\"",
  "Math.min((settledPrincipal + settledInterest) * 0.2, 1360 * allocationRatio)",
  "defaultSettledAttorneyFee",
  "masterSettlementAttorneyFeeOverrides",
  "Settled Attorney Fee",
  "width: \"min(1480px, 98vw)\"",
  "minWidth: 1180",
  "minWidth: 980",
  "totalSettlementTotal",
  "totalSettlement",
  "Total Settlement",
  "fontSize: 12",
  "margin: \"0 18px 10px\"",
  "minHeight: 132",
  "gridTemplateColumns: \"1fr 1fr 1fr\"",
  "$ amount or % of selected basis",
  "Settled Interest",
  "applyMasterSettlementBasisAmount",
  "masterSettlementCostDefaultValue",
  "masterSettlementCostsValue",
  "masterSettlementCostsInput",
  "Custom Amount",
  "Fee Schedule Amount",
  "Settlement Based on",
  "Retainer Principal",
  "Retainer Interest",
  "masterSettlementWholePercentLabel",
  "Fee defaults source:",
  "formattedMoney ? `$${formattedMoney}`",
  "setMasterSettlementPaymentExpectedDateInput(addDaysToDateInput(nextDate, 45))",
  `gridTemplateColumns: "1fr 1fr 1fr"`,
].forEach((needle) => mustContain("app/matters/page.tsx", page, needle));

if (failures) {
  console.error(`=== SETTLEMENT POPUP COLUMN ENTRY SAFETY FAILED: ${failures} failure(s) ===`);
  process.exit(1);
}

console.log("=== SETTLEMENT POPUP COLUMN ENTRY SAFETY PASSED ===");
