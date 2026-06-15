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

const route = read("app/api/matters/apply-payment/route.ts");
const matterPage = read("app/matter/[id]/page.tsx");
const mattersPage = read("app/matters/page.tsx");

mustInclude("direct UI uses Post Payment button", matterPage, 'paymentFormOpen ? "Close Payment" : "Post Payment"');
mustInclude("direct UI requires Check Date", matterPage, "<span>Check Date</span>");
mustInclude("direct UI requires Check Number", matterPage, "<span>Check Number</span>");
mustInclude("direct UI aggregated disabled explanation", matterPage, 'Payments must be posted in Lawsuit Screen');
mustInclude("direct UI has aggregation payment helper", matterPage, "function matterIsAggregatedForPayment()");
mustInclude("direct UI blocks aggregated submit", matterPage, 'error: "Payments must be posted in Lawsuit Screen"');
mustInclude("direct UI posts direct context", matterPage, 'postingContext: "direct-matter"');
mustInclude("direct UI submit says Post Payment", matterPage, '{paymentApplyLoading ? "Posting..." : "Post Payment"}');
mustInclude("direct UI has required-field completion helper", matterPage, "function paymentFormRequiredFieldsComplete()");
mustInclude("direct UI defaults transaction type to Voluntary Payment", matterPage, 'useState("Voluntary Payment")');
mustInclude("direct UI allows Interest transaction type", matterPage, '"Interest"');
mustNotInclude("direct UI excludes Collection Payment transaction type", matterPage, '"Collection Payment"');
mustInclude("direct UI disables submit until required fields complete", matterPage, "disabled={paymentFormSubmitDisabled()}");
mustInclude("direct UI explains disabled submit", matterPage, "Complete all required payment fields before posting.");
mustNotInclude("direct UI no Apply Payment wording", matterPage, "Apply Payment");
mustNotInclude("direct UI no PATCH payment submit", matterPage, 'method: editingReceipt ? "PATCH" : "POST"');
mustNotInclude("direct UI no active edit receipt click", matterPage, "onClick={() => beginEditPaymentReceipt(receipt)}");
mustInclude("direct UI edit function disabled", matterPage, "Posted payments cannot be edited. Void the payment and post a corrected payment.");
mustNotInclude("direct UI no edit-payment confirmation branch", matterPage, 'paymentApplyResult?.action === "edit-payment"');

mustInclude("route has lawsuit allocation context helper", route, "function isLawsuitAllocationContext");
mustInclude("route checks ClaimIndex master lawsuit aggregation", route, "async function matterHasLawsuitAggregation");
mustInclude("route rejects aggregated direct posting", route, "Payments must be posted in Lawsuit Screen");
mustInclude("route requires Transaction Type", route, "Transaction Type is required.");
mustInclude("route requires Transaction Status", route, "Transaction Status is required.");
mustInclude("route requires Transaction Date", route, "Transaction Date is required.");
mustInclude("route requires Check Date", route, "Check Date is required.");
mustInclude("route requires Check Number", route, "Check Number is required.");
mustInclude("route blocks non-cost-recovery overpayment against current Balance", route, "!isCostRecoveryPayment && claimAmount > 0 && paymentAmount > before.balancePresuit + 0.005");
mustNotInclude("route no clamped after-balance overpayment check", route, "after.balancePresuit < -0.005");
mustInclude("route PATCH disabled", route, "export async function PATCH()");
mustInclude("route PATCH correction instruction", route, "Void the payment and post a corrected payment.");
mustNotInclude("route no payment.edit audit action", route, 'action: "payment.edit"');
mustNotInclude("route no edit-payment response action", route, 'action: "edit-payment"');

mustInclude("lawsuit allocation passes explicit context", mattersPage, 'postingContext: "lawsuit-allocation"');
mustInclude("lawsuit screen uses Post Payment wording", mattersPage, "Post Payment");
mustInclude("lawsuit UI routes cost recovery to first child", mattersPage, "costRecoveryTargetRowKey");
mustInclude("lawsuit UI distinguishes interest from cost recovery", mattersPage, "isMasterPaymentCostRecoveryTransactionType");

if (process.exitCode) process.exit(process.exitCode);
console.log("PASS: direct Post Payment workflow safety checks passed.");
