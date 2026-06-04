import fs from "fs";

const pagePath = "app/matter/[id]/page.tsx";
const page = fs.readFileSync(pagePath, "utf8");

const failures = [];

function requireIncludes(label, needle) {
  if (!page.includes(needle)) failures.push(`${label}: missing ${JSON.stringify(needle)}`);
}

function requireExcludes(label, needle) {
  if (page.includes(needle)) failures.push(`${label}: forbidden ${JSON.stringify(needle)}`);
}

requireIncludes("Claim Information heading", "Claim Information");
requireIncludes("Claim Status heading", "Claim Status");
requireIncludes("Status divider", 'borderLeft: "1px solid #94a3b8"');
requireIncludes("Status divider spacing", "paddingLeft: 14");
requireIncludes("Status divider fixed summary height", "height: 470");
requireIncludes("Claim status column class", "barsh-direct-claim-status-column");
requireIncludes("Claim Amount column alignment", 'className="barsh-direct-summary-column" style={{ paddingTop: 28 }}');

requireExcludes("Status divider must not stretch to workspace", 'alignSelf: "stretch"');
requireExcludes("Status divider must not use full workspace height", 'height: "100%"');

const claimInfoIndex = page.indexOf("Claim Information");
const patientIndex = page.indexOf("<span>Patient</span>");
const claimAmountIndex = page.indexOf("<span>Claim Amount</span>", claimInfoIndex);
const claimAmountAlignedColumnIndex = page.indexOf('className="barsh-direct-summary-column" style={{ paddingTop: 28 }}', claimInfoIndex);
const statusHeadingIndex = page.indexOf("Claim Status");
const statusLabelIndex = page.indexOf("<span>Status</span>", statusHeadingIndex);
const finalStatusIndex = page.indexOf("<span>Final Status</span>", statusHeadingIndex);
const closedReasonIndex = page.indexOf("<span>Closed Reason</span>", statusHeadingIndex);

if (!(claimInfoIndex >= 0 && patientIndex >= 0 && claimInfoIndex < patientIndex)) {
  failures.push("Claim Information heading must appear before Patient summary card.");
}

if (!(claimAmountAlignedColumnIndex >= 0 && claimAmountIndex > claimAmountAlignedColumnIndex)) {
  failures.push("Claim Amount summary column must have alignment padding before the Claim Amount label.");
}

if (!(statusHeadingIndex >= 0 && statusLabelIndex >= 0 && statusHeadingIndex < statusLabelIndex)) {
  failures.push("Claim Status heading must appear before Status summary card.");
}

if (!(statusLabelIndex >= 0 && finalStatusIndex > statusLabelIndex && closedReasonIndex > finalStatusIndex)) {
  failures.push("Status, Final Status, and Closed Reason must remain grouped in that order.");
}

const finalStatusWindow = page.slice(Math.max(0, finalStatusIndex - 400), Math.min(page.length, finalStatusIndex + 500));
const closedReasonWindow = page.slice(Math.max(0, closedReasonIndex - 400), Math.min(page.length, closedReasonIndex + 500));

if (/onClick=\{[^}]*Final/i.test(finalStatusWindow) || /<button[\s\S]*Final Status/i.test(finalStatusWindow)) {
  failures.push("Final Status appears to have gained an edit button or click handler.");
}

if (/onClick=\{[^}]*Closed/i.test(closedReasonWindow) || /<button[\s\S]*Closed Reason/i.test(closedReasonWindow)) {
  failures.push("Closed Reason appears to have gained an edit button or click handler.");
}

if (failures.length) {
  console.error("FAIL: direct claim/status section layout safety");
  for (const failure of failures) console.error(" - " + failure);
  process.exit(1);
}

console.log("PASS: direct claim/status section layout safety");
