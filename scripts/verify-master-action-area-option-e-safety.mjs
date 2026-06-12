import fs from "fs";
const page = fs.readFileSync("app/matters/page.tsx", "utf8");
const failures = [];
const required = [
  "data-barsh-master-action-area-option-e=\"true\"",
  "data-barsh-master-actions-section-heading=\"true\"",
  "data-barsh-master-action-panel=\"true\"",
  "data-barsh-master-action-tab={key}",
  "Payments",
  "Post Payment",
  "data-barsh-master-view-payments-button=\"true\"",
  "View Payments",
  "data-barsh-master-payments-panel=\"true\"",
  "Recent Receipts",
  "Settlement",
  "Record Settlement",
  "data-barsh-master-view-settlements-button=\"true\"",
  "View Settlements",
  "Documents",
  "data-barsh-master-view-documents-button=\"true\"",
  "View Documents",
  "data-barsh-master-view-emails-button=\"true\"",
  "View Emails",
  "data-barsh-master-generate-documents-button=\"true\"",
  "Generate Documents",
  "Court Dates",
  "Add New Court Date",
  "View / Edit Court Dates",
  "data-barsh-master-close-under-balance=\"true\"",
];
for (const token of required) {
  if (page.includes(token) === false) failures.push("missing " + token);
}
if (page.includes("Lawsuit Actions")) failures.push("old Lawsuit Actions heading still present");
if (page.includes("Payment controls: Active")) failures.push("old payment controls status text still present");
if (page.includes("data-barsh-master-action-section=\"closing\"")) failures.push("Close Lawsuit should not be a top action group");
\nfor (const token of ['data-barsh-master-actions-outer-section=\\"true\\"', 'background: \\"transparent\\"', 'boxShadow: \\"none\\"', 'data-barsh-master-add-new-court-date-placeholder=\\"true\\">Add New Court Date</button>', 'data-barsh-master-view-edit-court-dates-placeholder=\\"true\\">View / Edit Court Dates</button>', 'background: \\"#fff7ed\\", color: \\"#c2410c\\"']) {\n  if (!page.includes(token)) failures.push(`master Actions heading outside bordered card / orange Court Dates fills missing token: ${token}`);\n}\n\nif (failures.length) {
  console.error("FAIL: master action area option E safety");
  for (const failure of failures) console.error("- " + failure);
  process.exit(1);
}
console.log("PASS: master action area option E safety");
