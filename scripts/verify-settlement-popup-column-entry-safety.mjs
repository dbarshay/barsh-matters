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
  "repeat(2, minmax(240px, 1fr))",
  "formattedMoney ? `$${formattedMoney}`",
  "Principal: {money(masterSettlementGrossValue())}",
  "Interest: {money(masterSettlementInterestValue())}",
  "$ amount or % of Lawsuit Amount",
  "setMasterSettlementPaymentExpectedDateInput(addDaysToDateInput(nextDate, 45))",
  `gridTemplateColumns: "1fr 1fr 1fr"`,
].forEach((needle) => mustContain("app/matters/page.tsx", page, needle));

if (failures) {
  console.error(`=== SETTLEMENT POPUP COLUMN ENTRY SAFETY FAILED: ${failures} failure(s) ===`);
  process.exit(1);
}

console.log("=== SETTLEMENT POPUP COLUMN ENTRY SAFETY PASSED ===");
