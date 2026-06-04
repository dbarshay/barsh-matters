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
requireIncludes("Claim status column class", "barsh-direct-claim-status-column");
requireIncludes("Claim Amount column alignment", 'className="barsh-direct-summary-column" style={{ paddingTop: 28 }}');

requireIncludes("Direct detail grid keeps payment area as right column", 'gridTemplateColumns: "minmax(0, 1fr) 520px"');
requireIncludes("Direct left claim/status layout exists", "barsh-direct-claim-info-status-layout");
requireIncludes("Direct left info column exists", "barsh-direct-left-info-column");
requireIncludes("Direct left info uses two columns", 'gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)"');
requireIncludes("Direct claim/status layout has status width", 'gridTemplateColumns: "minmax(0, 1fr) 340px"');

requireIncludes("Direct status column is relative", 'position: "relative"');
requireIncludes("Direct status width matches master", "width: 340");
requireIncludes("Direct status max width matches master", 'maxWidth: "100%"');
requireIncludes("Direct status padding matches master", 'padding: "12px 0 0 12"');
requireIncludes("Direct status independent divider line", 'background: "#94a3b8"');
requireIncludes("Direct status divider line centered between left/right boxes", "left: -7");
requireIncludes("Direct status fixed summary height", "height: 470");

requireExcludes("Status divider must not use old border-left", 'borderLeft: "1px solid #94a3b8"');
requireExcludes("Status divider must not use old paddingLeft", "paddingLeft: 14");
requireExcludes("Status column must not use transform-only positioning", 'transform: "translateX(340px)"');
requireExcludes("Status divider must not use full workspace height", 'height: "100%"');

const claimInfoIndex = page.indexOf("Claim Information");
const patientIndex = page.indexOf("<span>Patient</span>");
const claimAmountIndex = page.indexOf("<span>Claim Amount</span>", claimInfoIndex);
const claimAmountAlignedColumnIndex = page.indexOf('className="barsh-direct-summary-column" style={{ paddingTop: 28 }}', claimInfoIndex);
const statusHeadingIndex = page.indexOf("Claim Status");
const statusLabelIndex = page.indexOf("<span>Status</span>", statusHeadingIndex);
const finalStatusIndex = page.indexOf("<span>Final Status</span>", statusHeadingIndex);
const closedReasonIndex = page.indexOf("<span>Closed Reason</span>", statusHeadingIndex);
const financialBubbleIndex = page.indexOf('className="barsh-direct-financial-bubble"');

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

if (!(financialBubbleIndex > closedReasonIndex)) {
  failures.push("Payment/financial bubble must remain after the grouped Claim Status section.");
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
