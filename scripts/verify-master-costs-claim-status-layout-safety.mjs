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

function mustNotContain(label, needle) {
  if (!page.includes(needle)) pass(label);
  else fail(`${label} should not contain ${JSON.stringify(needle)}`);
}

mustContain("master full left/right layout marker", 'data-barsh-master-claim-lawsuit-costs-notes-status-layout="true"');
mustContain("master left information column marker", 'data-barsh-master-left-info-column="true"');
mustContain("master costs section marker", 'data-barsh-master-costs-section="true"');
mustContain("master status section marker preserved", 'data-barsh-master-status-section="true"');
mustContain("master status renamed Lawsuit Status", "Lawsuit Status");
mustContain("master status divider container is relative", 'position: "relative"');
mustContain("master status divider line is independent", 'background: "#94a3b8"');
mustContain("master status divider line moved left", "left: -18");
mustContain("master status column is vertical", 'gridTemplateColumns: "1fr"');
mustContain("master costs section uses three columns", 'gridTemplateColumns: "repeat(3, minmax(0, 1fr))"');
mustContain("master costs section has Index Fee", "<span style={masterSummaryCardTitleStyle}>Index Fee</span>");
mustContain("master costs section has Service Fee", "<span style={masterSummaryCardTitleStyle}>Service Fee</span>");
mustContain("master costs section has Other Court Costs", "<span style={masterSummaryCardTitleStyle}>Other Court Costs</span>");
mustNotContain("old partial split layout marker removed", 'data-barsh-master-lawsuit-costs-status-layout="true"');

const layoutIndex = page.indexOf('data-barsh-master-claim-lawsuit-costs-notes-status-layout="true"');
const leftColumnIndex = page.indexOf('data-barsh-master-left-info-column="true"', layoutIndex);
const claimInfoIndex = page.indexOf("Claim Information", leftColumnIndex);
const lawsuitInfoIndex = page.indexOf("Lawsuit Information", leftColumnIndex);
const costsSectionIndex = page.indexOf('data-barsh-master-costs-section="true"', leftColumnIndex);
const notesIndex = page.indexOf("Notes", leftColumnIndex);
const statusSectionIndex = page.indexOf('data-barsh-master-status-section="true"', leftColumnIndex);

if (!(layoutIndex >= 0 && leftColumnIndex > layoutIndex)) {
  fail("Left column must be inside the master left/right layout.");
} else {
  pass("Left column is inside the master left/right layout");
}

if (!(claimInfoIndex > leftColumnIndex && lawsuitInfoIndex > claimInfoIndex && costsSectionIndex > lawsuitInfoIndex && notesIndex > costsSectionIndex)) {
  fail("Left column must contain Claim Information, Lawsuit Information, Costs, and Notes in order.");
} else {
  pass("Left column contains Claim Information, Lawsuit Information, Costs, and Notes in order");
}

if (!(statusSectionIndex > notesIndex)) {
  fail("Lawsuit Status section must be the right-side section after the left-column source block.");
} else {
  pass("Lawsuit Status section is separated after the left-column source block");
}

const indexFeeIndex = page.indexOf("<span style={masterSummaryCardTitleStyle}>Index Fee</span>");
const serviceFeeIndex = page.indexOf("<span style={masterSummaryCardTitleStyle}>Service Fee</span>");
const otherCostsIndex = page.indexOf("<span style={masterSummaryCardTitleStyle}>Other Court Costs</span>");

if (!(indexFeeIndex > costsSectionIndex && serviceFeeIndex > costsSectionIndex && otherCostsIndex > costsSectionIndex)) {
  fail("Cost cards must appear inside/after the Costs section, not in the Lawsuit Information card group.");
} else {
  pass("Cost cards are moved into the Costs section");
}

const statusCardIndex = page.indexOf("<span style={masterSummaryCardTitleStyle}>Status</span>", statusSectionIndex);
const finalStatusCardIndex = page.indexOf("<span style={masterSummaryCardTitleStyle}>Final Status</span>", statusSectionIndex);
const closedReasonCardIndex = page.indexOf("<span style={masterSummaryCardTitleStyle}>Closed Reason</span>", statusSectionIndex);

if (!(statusCardIndex > statusSectionIndex && finalStatusCardIndex > statusCardIndex && closedReasonCardIndex > finalStatusCardIndex)) {
  fail("Lawsuit Status section must keep Status, Final Status, and Closed Reason grouped in order.");
} else {
  pass("Lawsuit Status section keeps Status, Final Status, and Closed Reason grouped in order");
}

if (page.includes('openMasterInfoEditDialog("finalStatus"') || page.includes('openMasterInfoEditDialog("closeReason"') || page.includes('openMasterInfoEditDialog("closedReason"')) {
  fail("Final Status / Closed Reason must remain non-editable from the summary cards.");
} else {
  pass("Final Status / Closed Reason remain non-editable from the summary cards");
}

if (!pkg.scripts?.["verify:master-costs-claim-status-layout-safety"]) {
  fail("package.json must register verify:master-costs-claim-status-layout-safety.");
} else {
  pass("package.json registers verify:master-costs-claim-status-layout-safety");
}

if (failed) process.exit(1);
