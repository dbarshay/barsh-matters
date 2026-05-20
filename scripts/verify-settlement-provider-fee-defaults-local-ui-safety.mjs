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

function mustNotContain(label, text, needle) {
  if (!text.includes(needle)) console.log(`PASS: ${label}: does not contain ${needle}`);
  else {
    failures += 1;
    console.error(`FAIL: ${label}: must not contain ${needle}`);
  }
}

const route = read("app/api/settlements/local-provider-fee-defaults/route.ts");
const page = read("app/matters/page.tsx");
const packageJson = read("package.json");

console.log("=== SETTLEMENT PROVIDER FEE DEFAULTS LOCAL UI SAFETY VERIFICATION ===");

[
  'action: "local-provider-fee-defaults"',
  'sourceOfTruth: "barsh-matters-local-reference-data"',
  'type: "provider_client"',
  "Retainer Principal NF",
  "Retainer Interest",
  "clioRecordsChanged: false",
  "databaseRecordsChanged: false",
].forEach((needle) => mustContain("app/api/settlements/local-provider-fee-defaults/route.ts", route, needle));

[
  "masterSettlementProviderFeeDefaults",
  "loadMasterSettlementProviderFeeDefaults",
  "/api/settlements/local-provider-fee-defaults",
  "<span>Principal *</span>",
  "Fee defaults source:",
  "Payment Due Date",
].forEach((needle) => mustContain("app/matters/page.tsx", page, needle));

[
  "clioFetch(",
  "prisma.claimIndex.update",
  "writeSettlementToClio",
].forEach((needle) => mustNotContain("app/api/settlements/local-provider-fee-defaults/route.ts", route, needle));

mustContain("package.json", packageJson, '"verify:settlement-provider-fee-defaults-local-ui-safety"');

if (failures) {
  console.error(`=== SETTLEMENT PROVIDER FEE DEFAULTS LOCAL UI SAFETY FAILED: ${failures} failure(s) ===`);
  process.exit(1);
}

console.log("=== SETTLEMENT PROVIDER FEE DEFAULTS LOCAL UI SAFETY PASSED ===");
