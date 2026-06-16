import fs from "node:fs";

const page = fs.readFileSync("app/matters/page.tsx", "utf8");
const packageJson = fs.readFileSync("package.json", "utf8");

const expectedOrder = [
  "Collection Payment",
  "Interest",
  "Index Fee",
  "Service Fee",
  "Other Court Costs",
  "PreC to Provider",
  "Attorney Fee",
];

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exitCode = 1;
}

function pass(message) {
  console.log(`PASS: ${message}`);
}

const arrayMatch = page.match(/const\s+fallbackMasterPaymentTransactionTypeOptions\s*=\s*\[([\s\S]*?)\];/m);
if (!arrayMatch) {
  fail("fallbackMasterPaymentTransactionTypeOptions array missing");
} else {
  const values = [...arrayMatch[1].matchAll(/["']([^"']+)["']/g)].map((match) => match[1]);

  if (JSON.stringify(values) !== JSON.stringify(expectedOrder)) {
    fail(`lawsuit payment transaction order mismatch. Found: ${JSON.stringify(values)} Expected: ${JSON.stringify(expectedOrder)}`);
  } else {
    pass("lawsuit payment transaction type order is exact");
  }

  if (values[0] !== "Collection Payment") {
    fail("Collection Payment internal value is not first/default-position option");
  } else {
    pass("Collection display value is first/default-position option");
  }

  if (values.some((value) => !expectedOrder.includes(value))) {
    fail(`lawsuit dropdown contains unexpected transaction type(s): ${values.filter((value) => !expectedOrder.includes(value)).join(", ")}`);
  } else {
    pass("lawsuit dropdown contains only approved transaction types");
  }
}

if (!page.includes('useState("Collection Payment")')) {
  fail("lawsuit payment state no longer defaults to Collection Payment");
} else {
  pass("lawsuit payment state defaults to Collection Payment");
}

if (!page.includes('setMasterPaymentTransactionTypeInput("Collection Payment")')) {
  fail("lawsuit payment reset no longer resets transaction type to Collection Payment");
} else {
  pass("lawsuit payment reset keeps Collection Payment default");
}

if (!page.includes("handleMasterPaymentTransactionTypeChange")) {
  fail("lawsuit payment transaction type dropdown no longer uses attorney-fee status handler");
} else {
  pass("lawsuit payment transaction type dropdown uses attorney-fee status handler");
}

if (!page.includes('setMasterPaymentTransactionStatusInput("Do Not Show on Remittance")')) {
  fail("Attorney Fee no longer defaults transaction status to Do Not Show on Remittance");
} else {
  pass("Attorney Fee defaults transaction status to Do Not Show on Remittance");
}

if (!page.includes("masterPaymentTransactionTypeDropdownOptions().map")) {
  fail("lawsuit payment dropdown no longer renders from masterPaymentTransactionTypeDropdownOptions()");
} else {
  pass("lawsuit payment dropdown renders from masterPaymentTransactionTypeDropdownOptions()");
}

if (!packageJson.includes("verify:lawsuit-payment-transaction-order-safety")) {
  fail("package.json missing verify:lawsuit-payment-transaction-order-safety script");
} else {
  pass("package.json registers lawsuit payment transaction order verifier");
}

if (process.exitCode) process.exit(process.exitCode);

console.log("PASS: lawsuit payment transaction order safety verifier passed.");
