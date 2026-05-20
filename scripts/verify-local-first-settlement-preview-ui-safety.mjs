import fs from "node:fs";

let failures = 0;

function read(path) {
  try {
    return fs.readFileSync(path, "utf8");
  } catch {
    failures += 1;
    console.error(`FAIL: missing ${path}`);
    return "";
  }
}

function mustContain(label, text, needle) {
  if (text.includes(needle)) console.log(`PASS: ${label}: found ${needle}`);
  else {
    failures += 1;
    console.error(`FAIL: ${label}: missing ${needle}`);
  }
}

const page = read("app/matters/page.tsx");
const packageJson = read("package.json");

console.log("=== LOCAL-FIRST SETTLEMENT PREVIEW UI SAFETY VERIFICATION ===");

[
  "masterSettlementLocalPreview",
  "masterSettlementLocalPreviewLoading",
  "runMasterSettlementLocalPreview",
  "/api/settlements/local-preview",
  "Preview Local Settlement",
  "data-barsh-local-settlement-preview-panel",
  "Local-First Settlement Calculation Preview",
  "Local Settlement Record Payload Preview",
  "data-barsh-local-settlement-record-payload-preview",
  "settlementRecordPayload",
  "future Barsh Matters local settlement record",
  "No database record is created here",
  "does not write Clio, write the database, generate documents, print, queue, or close matters",
  "providerNetTotal",
  "principalFeeTotal",
  "interestFeeTotal",
].forEach((needle) => mustContain("app/matters/page.tsx", page, needle));

mustContain("package.json", packageJson, '"verify:local-first-settlement-preview-ui-safety"');

if (failures) {
  console.error(`=== LOCAL-FIRST SETTLEMENT PREVIEW UI SAFETY FAILED: ${failures} failure(s) ===`);
  process.exit(1);
}

console.log("=== LOCAL-FIRST SETTLEMENT PREVIEW UI SAFETY PASSED ===");
