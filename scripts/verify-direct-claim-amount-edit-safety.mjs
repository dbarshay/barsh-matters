import fs from "fs";

const page = fs.readFileSync("app/matter/[id]/page.tsx", "utf8");
const route = fs.readFileSync("app/api/matters/update-direct-field/route.ts", "utf8");

let failed = false;

function requireText(label, haystack, needle) {
  if (!haystack.includes(needle)) {
    console.error(`FAIL: missing ${label}`);
    failed = true;
  } else {
    console.log(`PASS: ${label}`);
  }
}

requireText("direct modal union includes claimAmount", page, '"claimAmount" | "dos" | "denialReason" | "status"');
requireText("claim amount input state exists", page, "const [claimAmountInput, setClaimAmountInput] = useState(\"\");");
requireText("open claim amount dialog exists", page, "function openClaimAmountEditDialog()");
requireText("save claim amount dialog exists", page, "async function saveClaimAmountEditDialog()");
requireText("claim amount uses update-direct-field", page, 'field: "claimAmount"');
requireText("claim amount card inserted", page, 'title="Edit Claim Amount."');

requireText("route direct field includes claimAmount", route, 'type DirectField = "claimAmount" | "dos" | "denialReason" | "status";');
requireText("route label includes claim amount", route, 'if (field === "claimAmount") return "Claim Amount";');
requireText("route parses claim amount", route, 'if (field === "claimAmount") {');
requireText("route updates claim_amount", route, "claim_amount: claimAmount");
requireText("route updates balance_presuit", route, "balance_presuit: balance");
requireText("route updates balance_amount", route, "balance_amount: balance");
requireText("route supported fields includes claimAmount", route, '["claimAmount", "dos", "denialReason", "status"]');

requireText("Final Status is displayed read-only", page, "<span>Final Status</span>");
requireText("Closed Reason is displayed read-only", page, "<span>Closed Reason</span>");

if (page.includes('openPicklistEditDialog("finalStatus")')) {
  console.error("FAIL: Final Status must not be directly editable from summary cards.");
  process.exit(1);
}
console.log("PASS: Final Status is not directly editable from summary cards");

if (page.includes('openPicklistEditDialog("closedReason")')) {
  console.error("FAIL: Closed Reason must not be directly editable from summary cards.");
  process.exit(1);
}
console.log("PASS: Closed Reason is not directly editable from summary cards");

if (route.includes('"finalStatus"') || route.includes('"closedReason"')) {
  console.error("FAIL: update-direct-field must not support Final Status or Closed Reason direct edits.");
  process.exit(1);
}
console.log("PASS: update-direct-field direct edit route excludes Final Status and Closed Reason");


const claimAmountSpanIndex = page.indexOf('<span>Claim Amount</span>');
const dateOfServiceSpanIndex = page.indexOf('<span>Date of Service</span>');
const claimAmountEditIndex = page.indexOf('title="Edit Claim Amount."');
const dateOfServiceEditIndex = page.indexOf('title="Edit Date of Service."');

if (
  claimAmountSpanIndex === -1 ||
  dateOfServiceSpanIndex === -1 ||
  claimAmountEditIndex === -1 ||
  dateOfServiceEditIndex === -1 ||
  claimAmountSpanIndex > dateOfServiceSpanIndex ||
  claimAmountEditIndex > dateOfServiceEditIndex
) {
  console.error("FAIL: Claim Amount edit card is not before Date of Service");
  failed = true;
} else {
  console.log("PASS: Claim Amount edit card is before Date of Service");
}

const claimAmountBlockEnd =
  dateOfServiceSpanIndex > claimAmountSpanIndex ? dateOfServiceSpanIndex : claimAmountSpanIndex + 1600;

const claimAmountBlock =
  claimAmountSpanIndex >= 0 ? page.slice(Math.max(0, claimAmountSpanIndex - 900), claimAmountBlockEnd) : "";

if (!claimAmountBlock.includes('className="barsh-direct-summary-label"')) {
  console.error("FAIL: Claim Amount card does not use barsh-direct-summary-label");
  failed = true;
} else {
  console.log("PASS: Claim Amount card uses barsh-direct-summary-label");
}

if (
  !claimAmountBlock.includes('display: "flex"') ||
  !claimAmountBlock.includes('justifyContent: "space-between"') ||
  !claimAmountBlock.includes('alignItems: "center"') ||
  !claimAmountBlock.includes("gap: 8")
) {
  console.error("FAIL: Claim Amount card does not align label/edit button like other cards");
  failed = true;
} else {
  console.log("PASS: Claim Amount card aligns label/edit button like other cards");
}

if (!claimAmountBlock.includes('<div className="barsh-direct-summary-value">')) {
  console.error("FAIL: Claim Amount card does not use direct summary value styling");
  failed = true;
} else {
  console.log("PASS: Claim Amount card uses direct summary value styling");
}

if (!claimAmountBlock.includes("{money(num(matter?.claimAmount))}")) {
  console.error("FAIL: Claim Amount card does not display formatted claimAmount");
  failed = true;
} else {
  console.log("PASS: Claim Amount card displays formatted claimAmount");
}

if (failed) process.exit(1);

console.log("PASS: direct matter Claim Amount editable card and route are wired safely.");
