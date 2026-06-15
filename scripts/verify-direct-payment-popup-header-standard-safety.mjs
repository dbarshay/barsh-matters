import fs from "fs";

const page = fs.readFileSync("app/matter/[id]/page.tsx", "utf8");
const failures = [];

const start = page.indexOf("{paymentFormOpen && (");
const end = page.indexOf("{paymentApplyResult?.ok && (", start);
const region = start >= 0 && end > start ? page.slice(start, end) : "";

if (!region) failures.push("could not isolate direct payment popup region");

for (const token of [
  'data-barsh-direct-payment-header-standard="true"',
  'Post Individual Matter Payment',
  'display: "flex"',
  'justifyContent: "center"',
  'background: "#1e3a8a"',
  'borderBottom: "1px solid #1e3a8a"',
  'color: "#ffffff"',
  'textAlign: "center"',
  '<span>Transaction Type',
  '<span>Transaction Status</span>',
  '<span>Transaction Date</span>',
  '<span>Amount</span>',
  '<span>Check Date</span>',
  '<span>Check Number</span>',
  'Cancel',
  'Clear',
  '{paymentApplyLoading ? "Posting..." : "Post Payment"}',
]) {
  if (!region.includes(token)) failures.push("missing direct payment header token: " + token);
}

for (const forbidden of [
  'aria-label="Close payment form"',
  '×',
  'color: "#14532d"',
  'background: "#f0fdf4"',
  'gridTemplateColumns: "38px minmax(0, 1fr) 38px"',
]) {
  if (region.includes(forbidden)) failures.push("direct payment popup header still has old token: " + forbidden);
}

if (failures.length) {
  console.error("FAIL: direct payment popup header standard safety");
  for (const failure of failures) console.error("- " + failure);
  process.exit(1);
}

console.log("PASS: direct payment popup header standard safety");
