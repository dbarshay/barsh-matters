#!/usr/bin/env node
import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function mustContain(label, text, needle) {
  if (!text.includes(needle)) {
    console.error(`FAIL: ${label}: missing ${needle}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS: ${label}`);
  }
}

function mustNotContain(label, text, needle) {
  if (text.includes(needle)) {
    console.error(`FAIL: ${label}: unexpected ${needle}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS: ${label}`);
  }
}

console.log("RESULT: verify master Status / Final Status / Closed Reason display section safety");

const page = read("app/matters/page.tsx");
const pkg = JSON.parse(read("package.json"));

mustContain("master status helper reads detailed status", page, "function masterDetailedStatusDisplayValue(): string");
mustContain("master status helper reads final status", page, 'function masterFinalStatusDisplayValue(): "Open" | "Closed"');
mustContain("master status helper reads closed reason", page, "function masterClosedReasonDisplayValue(): string");

mustContain("master header badge reads Final Status", page, "{masterFinalStatusDisplayValue()}");
mustContain("master header badge colors Closed red", page, 'masterFinalStatusDisplayValue() === "Closed" ? "#dc2626" : "#16a34a"');

mustContain("master title pill background colors Closed red", page, 'masterFinalStatusDisplayValue() === "Closed" ? "#fee2e2" : "#dcfce7"');
mustContain("master title pill border colors Closed red", page, 'masterFinalStatusDisplayValue() === "Closed" ? "2px solid #dc2626" : "2px solid #16a34a"');
mustContain("master title pill text colors Closed red", page, 'masterFinalStatusDisplayValue() === "Closed" ? "#991b1b" : "#14532d"');



mustContain("master status section marker exists", page, 'data-barsh-master-status-section="true"');
mustContain("master status card exists", page, "<span style={masterSummaryCardTitleStyle}>Status</span>");

mustContain("master Status card is editable", page, 'openMasterInfoEditDialog("status", "Status", masterDetailedStatusDisplayValue())');
mustContain("master Status edit uses canonical status list", page, "BARSH_MATTER_STATUS_OPTIONS.map");
mustContain("master Status persists locally", page, 'payload.status = after;');
mustContain("master Status persists matterStatus alias", page, 'payload.matterStatus = after;');

mustContain("master final status card exists", page, "<span style={masterSummaryCardTitleStyle}>Final Status</span>");
mustContain("master closed reason card exists", page, "<span style={masterSummaryCardTitleStyle}>Closed Reason</span>");

const statusSectionIndex = page.indexOf('data-barsh-master-status-section="true"');
const statusCardIndex = page.indexOf("<span style={masterSummaryCardTitleStyle}>Status</span>", statusSectionIndex);
const finalStatusCardIndex = page.indexOf("<span style={masterSummaryCardTitleStyle}>Final Status</span>", statusSectionIndex);
const closedReasonCardIndex = page.indexOf("<span style={masterSummaryCardTitleStyle}>Closed Reason</span>", statusSectionIndex);
const notesHeaderIndex = page.indexOf("Notes", statusSectionIndex);

if (statusSectionIndex < 0) {
  console.error("FAIL: master Status section marker missing.");
  process.exitCode = 1;
} else {
  console.log("PASS: master Status section marker found");
}

if (
  statusCardIndex < 0 ||
  finalStatusCardIndex < 0 ||
  closedReasonCardIndex < 0
) {
  console.error("FAIL: master Status section must contain Status, Final Status, and Closed Reason cards.");
  process.exitCode = 1;
} else {
  console.log("PASS: master Status section contains all three status cards");
}

if (
  statusSectionIndex < 0 ||
  notesHeaderIndex < 0 ||
  statusSectionIndex > notesHeaderIndex
) {
  console.error("FAIL: master Status section must appear before Notes section.");
  process.exitCode = 1;
} else {
  console.log("PASS: master Status section appears before Notes section");
}

mustNotContain("master Final Status must not be directly editable", page, 'openMasterInfoEditDialog("finalStatus"');
mustNotContain("master Close Reason must not be directly editable", page, 'openMasterInfoEditDialog("closeReason"');
mustNotContain("master Closed Reason must not be directly editable", page, 'openMasterInfoEditDialog("closedReason"');

if (pkg.scripts?.["verify:master-status-section-safety"] !== "node scripts/verify-master-status-section-safety.mjs") {
  console.error("FAIL: package.json registers verify:master-status-section-safety");
  process.exitCode = 1;
} else {
  console.log("PASS: package.json registers verify:master-status-section-safety");
}

if (process.exitCode) {
  console.error("FAILURES=1");
  process.exit(1);
}

console.log("FAILURES=0");
