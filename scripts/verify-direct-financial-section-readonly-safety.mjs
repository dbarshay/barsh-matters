import fs from "fs";

const page = fs.readFileSync("app/matter/[id]/page.tsx", "utf8");

let failed = false;

function requireText(label, haystack, needle) {
  if (!haystack.includes(needle)) {
    console.error(`FAIL: missing ${label}`);
    failed = true;
  } else {
    console.log(`PASS: ${label}`);
  }
}

function forbidText(label, haystack, needle) {
  if (haystack.includes(needle)) {
    console.error(`FAIL: forbidden ${label}`);
    failed = true;
  } else {
    console.log(`PASS: forbidden ${label} absent`);
  }
}

requireText("direct claim amount helper exists", page, "function directMatterClaimAmountValue(matter: any): number {");
requireText("direct claim amount helper supports snake_case", page, "matter?.claimAmount ?? matter?.claim_amount");
requireText("direct posted payment helper exists", page, "function directMatterPaymentPostedValue(matter: any): number {");
requireText("direct posted payment helper supports paymentVoluntary", page, "matter?.paymentVoluntary ??");
requireText("direct posted payment helper supports payment_voluntary", page, "matter?.payment_voluntary ??");
requireText("direct posted payment helper supports payment_amount", page, "matter?.payment_amount");
requireText("direct balance uses claim helper", page, "const claimAmount = directMatterClaimAmountValue(matter);");
requireText("direct balance uses payment helper", page, "const paymentVoluntary = directMatterPaymentPostedValue(matter);");
requireText("direct balance is derived", page, "return Math.max(claimAmount - paymentVoluntary, 0);");
requireText("lower claim amount uses helper", page, "<strong>{money(directMatterClaimAmountValue(matter))}</strong>");
requireText("lower payments uses helper", page, "<strong>{money(directMatterPaymentPostedValue(matter))}</strong>");
requireText("lower balance uses derived helper", page, "<strong>{money(currentDirectMatterBalancePresuit(matter))}</strong>");
forbidText("old stored-balance fallback", page, "const clioBalance = num(raw)");

const financialAnchor = page.indexOf("<strong>{money(directMatterClaimAmountValue(matter))}</strong>");
const balanceAnchor = page.indexOf("<strong>{money(currentDirectMatterBalancePresuit(matter))}</strong>", financialAnchor);
const financialStart = financialAnchor >= 0 ? Math.max(0, page.lastIndexOf("<div", financialAnchor)) : -1;
const financialEnd = balanceAnchor >= 0 ? page.indexOf("</div>", balanceAnchor) : -1;
const financialBlock = financialStart >= 0 && financialEnd > financialStart ? page.slice(financialStart, financialEnd + 6) : "";

requireText("financial section block located", financialBlock, '<span>Claim Amount</span>');
requireText("financial section includes Payments row", financialBlock, '<span>Payments</span>');
requireText("financial section includes Balance row", financialBlock, '<span>Balance</span>');
forbidText("financial section input", financialBlock, "<input");
forbidText("financial section select", financialBlock, "<select");
forbidText("financial section textarea", financialBlock, "<textarea");
forbidText("financial section edit button", financialBlock, "Edit");

if (failed) process.exit(1);

console.log("PASS: direct matter financial section is read-only and derives balance from local Claim Amount minus local Payments.");
