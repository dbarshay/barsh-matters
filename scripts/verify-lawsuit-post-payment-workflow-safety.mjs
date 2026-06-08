#!/usr/bin/env node
import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function mustInclude(label, text, needle) {
  if (!text.includes(needle)) {
    console.error(`FAIL: ${label} missing ${JSON.stringify(needle)}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS: ${label}`);
  }
}

function mustNotInclude(label, text, needle) {
  if (text.includes(needle)) {
    console.error(`FAIL: ${label} must not include ${JSON.stringify(needle)}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS: ${label}`);
  }
}

const page = read("app/matters/page.tsx");

const typeStart = page.indexOf("const fallbackMasterPaymentTransactionTypeOptions = [");
const typeEnd = page.indexOf("];", typeStart);
const typeBlock = typeStart >= 0 && typeEnd > typeStart ? page.slice(typeStart, typeEnd) : "";

mustInclude("lawsuit payment defaults to Collection Payment", page, 'useState("Collection Payment")');
mustInclude("lawsuit payment reset defaults to Collection Payment", page, 'setMasterPaymentTransactionTypeInput("Collection Payment")');
mustInclude("lawsuit transaction dropdown is locked to fallback list", page, "return fallbackMasterPaymentTransactionTypeOptions;");
mustNotInclude("lawsuit transaction dropdown does not use loaded transaction types", page, "return loaded.length ? loaded : fallbackMasterPaymentTransactionTypeOptions;");

[
  "Attorney Fee",
  "Collection Payment",
  "Filing Fee Billed",
  "Filing Fee Collected",
  "Index Fee Billed",
  "Index Fee Collected",
  "Interest",
  "Other Court Fees Billed",
  "Other Court Fees Collected",
  "PreC to Provider",
  "Service Fee Billed",
  "Service Fee Collected",
  "Voluntary Payment",
].forEach((transactionType) => {
  mustInclude(`lawsuit transaction type allows ${transactionType}`, typeBlock, `"${transactionType}"`);
});

mustNotInclude("lawsuit transaction type excludes Settlement Payment", typeBlock, '"Settlement Payment"');

mustInclude("lawsuit payment has required field helper", page, "function masterPaymentRequiredFieldsComplete()");
mustInclude("lawsuit payment has allocation completion helper", page, "function masterPaymentAllocationComplete()");
mustInclude("lawsuit payment has submit disabled helper", page, "function masterPaymentSubmitDisabled()");
mustInclude("lawsuit payment requires Transaction Type", page, "!!String(masterPaymentTransactionTypeInput ||");
mustInclude("lawsuit payment requires Transaction Status", page, "!!String(masterPaymentTransactionStatusInput ||");
mustInclude("lawsuit payment requires Transaction Date", page, "!!String(masterPaymentDateInput ||");
mustInclude("lawsuit payment requires Check Date", page, "!!String(masterPaymentCheckDateInput ||");
mustInclude("lawsuit payment requires Check Number", page, "!!String(masterPaymentCheckNumberInput ||");
mustInclude("lawsuit payment post validates required fields", page, "Complete all required payment fields before posting.");
mustInclude("lawsuit payment post validates full allocation", page, "Allocate the full payment amount before posting.");
mustInclude("lawsuit payment submit is disabled by helper", page, "disabled={masterPaymentSubmitDisabled()}");
mustInclude("lawsuit payment allocation uses master workspace bill rows", page, "const rows = masterWorkspaceBillRows(masterSettlementDetailRows);");
mustNotInclude("lawsuit payment allocation does not reference out-of-scope billRows", page, "const rows = Array.isArray(billRows) ? billRows : [];");
mustNotInclude("lawsuit payment allocation does not reference out-of-scope selectedMatterRows", page, "const rows = Array.isArray(selectedMatterRows) ? selectedMatterRows : [];");
mustInclude("lawsuit payment allocation preview renders item row shape", page, "const row = item;");
mustNotInclude("lawsuit payment allocation preview does not render removed nested row", page, "const row = item.row;");
mustInclude("lawsuit payment allocation supports proportional current-balance base", page, '"current-balance"');
mustInclude("lawsuit payment allocation supports manual base", page, '"manual"');
mustInclude("lawsuit payment allocation percent uses current balance", page, "item.currentBalance / totalEligibleBalance");
mustInclude("lawsuit allocation passes explicit context", page, 'postingContext: "lawsuit-allocation"');
mustInclude("lawsuit screen uses Post Payment wording", page, "Post Payment");


mustInclude("lawsuit payment has allocation method state", page, "masterPaymentAllocationMethodInput");
mustInclude("lawsuit payment defaults allocation method to proportional by balance", page, 'useState("proportional_by_balance")');
mustInclude("lawsuit payment has manual allocation option", page, '<option value="manual">Manual Allocation</option>');
mustInclude("lawsuit payment has proportional allocation option", page, '<option value="proportional_by_balance">Proportional by Balance</option>');
mustInclude("lawsuit payment has selected child matters option", page, "Selected Child Matters Only");
mustInclude("lawsuit payment has selected row state", page, "masterPaymentSelectedRowIds");
mustInclude("lawsuit payment has manual allocation input state", page, "masterPaymentManualAllocationInputs");
mustInclude("lawsuit payment validates allocation overage", page, "One or more allocations exceed the child matter");
mustInclude("lawsuit payment disables submit on allocation validation message", page, "masterPaymentAllocationValidationMessage()");
mustInclude("lawsuit payment manual allocation uses editable input", page, 'inputMode="decimal"');
mustInclude("lawsuit payment selected-only limits eligible rows", page, "(!masterPaymentSelectedOnlyInput || selected)");
mustInclude("lawsuit payment allocation column renamed", page, ">Allocation</th>");


mustInclude("lawsuit bills table has Lawsuit Payment column", page, ">Lawsuit Payment</th>");
mustInclude("lawsuit bills table calculates lawsuit payment from receipts", page, "function masterLawsuitPaymentAmountForRow");
mustInclude("lawsuit bills table separates lawsuit payment from pre-suit payment", page, "const preSuitPaymentAmount = Math.max(totalPaymentAmount - lawsuitPaymentAmount, 0);");
mustInclude("lawsuit payment opens close prompt after post", page, "setMasterPaymentClosePromptOpen(true);");
mustInclude("lawsuit payment close prompt asks closing question", page, "Payment activity was saved. Do you want to review closing this lawsuit now?");
mustInclude("lawsuit payment close prompt can navigate to close workflow", page, 'setActiveMasterWorkspaceTab("close_paid_settlements")');


mustInclude("lawsuit bills table has original bill amount helper", page, "function masterLawsuitBillAmountForRow");
mustInclude("lawsuit bills table has balance helper", page, "function masterLawsuitBalanceAmountForRow");
mustInclude("lawsuit bills rows use original bill amount helper", page, "const billAmount = masterLawsuitBillAmountForRow(row);");
mustInclude("lawsuit bills rows use balance helper", page, "const balanceAmount = masterLawsuitBalanceAmountForRow(row);");
mustInclude("lawsuit bills total uses original bill amount helper", page, "return sum + masterLawsuitBillAmountForRow(row);");
mustInclude("lawsuit bills total uses lawsuit payment helper", page, "return sum + masterLawsuitPaymentAmountForRow(row);");
mustInclude("lawsuit bills total uses balance helper", page, "return sum + masterLawsuitBalanceAmountForRow(row);");


mustInclude("lawsuit payment summary has static lawsuit amount helper", page, "function masterStaticLawsuitAmountValue()");
mustInclude("lawsuit payment summary uses static lawsuit amount", page, "const lawsuitAmount = masterStaticLawsuitAmountValue();");
mustNotInclude("lawsuit payment summary does not derive lawsuit amount from current bill total", page, "const lawsuitAmount = masterWorkspaceBillTotal(masterSettlementDetailRows);");
mustInclude("lawsuit payment summary reads Lawsuit amountSought", page, 'masterLocalMetadataValue("amountSought")');


mustNotInclude("lawsuit payment summary has no guessed masterLocalLawsuit variable", page, "masterLocalLawsuit ||");
mustNotInclude("lawsuit payment summary has no missing masterLocalMetadata dependency", page, "masterLocalMetadata]");
mustNotInclude("lawsuit payment summary has no missing masterLocalLawsuitOptions function", page, "masterLocalLawsuitOptions()");
mustInclude("lawsuit payment summary calls actual masterLawsuitOptions helper", page, "const options = masterLawsuitOptions();");

if (process.exitCode) {
  process.exit(process.exitCode);
}

console.log("PASS: lawsuit/master Post Payment workflow safety checks passed.");
