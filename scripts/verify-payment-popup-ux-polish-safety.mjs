import fs from "fs";

const matter = fs.readFileSync("app/matter/[id]/page.tsx", "utf8");
const matters = fs.readFileSync("app/matters/page.tsx", "utf8");
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));

let failures = 0;

function pass(message) {
  console.log(`PASS: ${message}`);
}

function fail(message) {
  failures += 1;
  console.error(`FAIL: ${message}`);
}

function mustContain(label, text, needle) {
  if (!text.includes(needle)) fail(`${label} missing ${JSON.stringify(needle)}`);
  else pass(`${label} contains ${JSON.stringify(needle)}`);
}

function mustNotContain(label, text, needle) {
  if (text.includes(needle)) fail(`${label} still contains ${JSON.stringify(needle)}`);
  else pass(`${label} does not contain ${JSON.stringify(needle)}`);
}

console.log("RESULT: verify payment popup UX polish safety");

mustNotContain(
  "direct payment popup",
  matter,
  "Post Payment records a local check payment, updates Barsh Matters local payment totals, and updates Balance."
);
mustNotContain("direct payment popup", matter, "This posts only to BRL");
mustContain("direct payment popup header", matter, "Post Individual Matter Payment");
mustContain("direct payment popup header centered", matter, 'gridTemplateColumns: "38px minmax(0, 1fr) 38px"');
mustContain("direct payment popup header centered", matter, 'textAlign: "center"');
mustContain("direct payment popup header green", matter, 'background: "#f0fdf4"');
mustNotContain("direct payment popup header", matter, ">Post Payment<");

mustNotContain(
  "lawsuit payment popup",
  matters,
  "This posts local Barsh Matters payment receipts to the child bill matters."
);

for (const label of [
  "<div>Payment Amount:",
  "Allocated to Child Matters:",
  "Remaining to Allocate:",
  "Expected Payments Posted:",
  "Expected Balance Presuit:",
  "Selected Child Matters Only",
  "Selected Child matters only",
]) {
  mustNotContain("lawsuit payment popup", matters, label);
}

mustContain(
  "lawsuit attorney-fee handler",
  matters,
  'setMasterPaymentTransactionStatusInput("Do Not Show on Remittance");\n      return;\n    }\n    setMasterPaymentTransactionStatusInput("Show on Remittance");'
);

mustContain("lawsuit payment popup", matters, "Allocate Equally by Percentage");
mustContain("lawsuit payment popup", matters, "Allocate Manually");
mustContain("lawsuit payment lower content gated", matters, 'display: masterPaymentRequiredFieldsComplete() ? "grid" : "none"');
mustContain("lawsuit payment allocation preview gated", matters, 'display: masterPaymentRequiredFieldsComplete() ? "block" : "none"');
mustContain("lawsuit payment allocation preview still present", matters, "Allocation Preview ·");
mustContain("lawsuit payment post button gated", matters, 'display: masterPaymentRequiredFieldsComplete() ? "inline-flex" : "none"');
mustContain("lawsuit payment popup header", matters, "Post Lawsuit Payment");
mustContain("lawsuit payment popup header centered", matters, 'gridTemplateColumns: "38px minmax(0, 1fr) 38px"');
mustContain("lawsuit payment popup header centered", matters, 'textAlign: "center"');
mustNotContain("lawsuit payment popup header", matters, "Lawsuit Payment Preview");
mustNotContain("lawsuit payment popup header", matters, "Master Lawsuit Payment · Local child-bill receipts.");
mustContain("lawsuit payment popup", matters, "Remaining Balance");
mustContain("lawsuit payment popup", matters, 'masterPaymentAllocationMethodInput !== "manual" && (');
mustNotContain("lawsuit payment popup", matters, "Expected Balance");

mustContain("lawsuit allocation method selector", matters, 'background: "#f8fafc"');
mustContain("lawsuit allocation method selector", matters, 'border: "1px solid #94a3b8"');
mustContain("lawsuit allocation method selector", matters, 'width: "min(340px, 100%)"');
mustContain("lawsuit allocation method selector", matters, 'background: "#ffffff"');

mustContain(
  "package.json scripts",
  JSON.stringify(pkg.scripts || {}),
  "verify:payment-popup-ux-polish-safety"
);

if (failures) {
  console.error(`FAILURES=${failures}`);
  process.exit(1);
}

console.log("PASS: payment popup UX polish safety verifier passed.");
