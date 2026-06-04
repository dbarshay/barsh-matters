import fs from "fs";

const page = fs.readFileSync("app/matters/page.tsx", "utf8");
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));

let failed = false;

function pass(label) {
  console.log(`PASS: ${label}`);
}

function fail(label) {
  console.error(`FAIL: ${label}`);
  failed = true;
}

function mustContain(label, needle) {
  if (page.includes(needle)) pass(label);
  else fail(`${label} missing ${JSON.stringify(needle)}`);
}

mustContain("master status helper reads detailed status", "function masterDetailedStatusDisplayValue()");
mustContain("master status helper reads final status", "function masterFinalStatusDisplayValue()");
mustContain("master status helper reads closed reason", "function masterClosedReasonDisplayValue()");
mustContain("master header badge reads Final Status", "masterFinalStatusDisplayValue()");
mustContain("master header badge colors Closed red", 'masterFinalStatusDisplayValue() === "Closed" ? "#dc2626"');
mustContain("master title pill background colors Closed red", 'masterFinalStatusDisplayValue() === "Closed" ? "#fee2e2"');
mustContain("master title pill border colors Closed red", 'masterFinalStatusDisplayValue() === "Closed" ? "2px solid #dc2626"');
mustContain("master title pill text colors Closed red", 'masterFinalStatusDisplayValue() === "Closed" ? "#991b1b"');
mustContain("master status section marker exists", 'data-barsh-master-status-section="true"');
mustContain("master Status card exists", "<span style={masterSummaryCardTitleStyle}>Status</span>");
mustContain("master Status card is editable", 'openMasterInfoEditDialog("status", "Status", masterDetailedStatusDisplayValue())');
mustContain("master Status edit uses canonical status list", "BARSH_MATTER_STATUS_OPTIONS");
mustContain("master Status persists locally", 'field === "status"');
mustContain("master Status persists matterStatus alias", "payload.matterStatus = after");
mustContain("master final status card exists", "<span style={masterSummaryCardTitleStyle}>Final Status</span>");
mustContain("master closed reason card exists", "<span style={masterSummaryCardTitleStyle}>Closed Reason</span>");
mustContain("master Lawsuit Status heading exists", "Lawsuit Status");
mustContain("master right-side divider container is relative", 'position: "relative"');
mustContain("master right-side divider line is independent", 'background: "#94a3b8"');
mustContain("master right-side divider line moved left", "left: -18");

const statusSectionIndex = page.indexOf('data-barsh-master-status-section="true"');
const statusCardIndex = page.indexOf("<span style={masterSummaryCardTitleStyle}>Status</span>", statusSectionIndex);
const finalStatusIndex = page.indexOf("<span style={masterSummaryCardTitleStyle}>Final Status</span>", statusSectionIndex);
const closedReasonIndex = page.indexOf("<span style={masterSummaryCardTitleStyle}>Closed Reason</span>", statusSectionIndex);

if (!(statusSectionIndex >= 0 && statusCardIndex > statusSectionIndex && finalStatusIndex > statusCardIndex && closedReasonIndex > finalStatusIndex)) {
  fail("master Status section must contain all three status cards in order");
} else {
  pass("master Status section contains all three status cards in order");
}

if (page.includes('openMasterInfoEditDialog("finalStatus"') || page.includes('openMasterInfoEditDialog("closeReason"') || page.includes('openMasterInfoEditDialog("closedReason"')) {
  fail("master Final Status / Closed Reason must not be directly editable");
} else {
  pass("master Final Status / Closed Reason must not be directly editable");
}

if (!pkg.scripts?.["verify:master-status-section-safety"]) {
  fail("package.json registers verify:master-status-section-safety");
} else {
  pass("package.json registers verify:master-status-section-safety");
}

if (failed) process.exit(1);

console.log("RESULT: verify master Status / Final Status / Closed Reason display section safety");
