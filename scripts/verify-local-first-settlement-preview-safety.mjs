import fs from "node:fs";

let failures = 0;

function read(path) {
  try {
    return fs.readFileSync(path, "utf8");
  } catch {
    console.error(`FAIL: missing ${path}`);
    failures += 1;
    return "";
  }
}

function pass(message) {
  console.log(`PASS: ${message}`);
}

function fail(message) {
  console.error(`FAIL: ${message}`);
  failures += 1;
}

function mustContain(label, text, needle) {
  if (text.includes(needle)) pass(`${label}: found ${needle}`);
  else fail(`${label}: missing ${needle}`);
}

function mustNotContain(label, text, needle) {
  if (!text.includes(needle)) pass(`${label}: does not contain ${needle}`);
  else fail(`${label}: must not contain ${needle}`);
}

const routePath = "app/api/settlements/local-preview/route.ts";
const packagePath = "package.json";

const route = read(routePath);
const packageJson = read(packagePath);

console.log("=== LOCAL-FIRST SETTLEMENT PREVIEW SAFETY VERIFICATION ===");

[
  "export async function POST",
  'action: "settlement-local-preview"',
  "previewOnly: true",
  "localFirst: true",
  'sourceOfTruth: "barsh-matters-local-claimindex"',
  "prisma.claimIndex.findMany",
  "master_lawsuit_id",
  "allocatedSettlement",
  "interestAmount",
  "principalFee",
  "interestFee",
  "totalFee",
  "providerNet",
  "providerPrincipalNet",
  "providerInterestNet",
  "clioRecordsChanged: false",
  "databaseRecordsChanged: false",
  "documentsGenerated: false",
  "printQueueChanged: false",
  "mattersClosed: false",
  "settlementWritebackPerformed: false",
].forEach((needle) => mustContain(routePath, route, needle));

[
  "clioFetch(",
  "previewSettlementWritebackToClio",
  "writeSettlementToClio",
  "method: \"PATCH\"",
  "method: \"POST\",",
  "method: \"DELETE\"",
  ".create(",
  ".update(",
  ".delete(",
  "prisma.settlementWriteback.create",
  "upsertClaimIndexFromMatter",
].forEach((needle) => mustNotContain(routePath, route, needle));

mustContain(packagePath, packageJson, '"verify:local-first-settlement-preview-safety"');

if (failures > 0) {
  console.error(`=== LOCAL-FIRST SETTLEMENT PREVIEW SAFETY FAILED: ${failures} failure(s) ===`);
  process.exit(1);
}

console.log("=== LOCAL-FIRST SETTLEMENT PREVIEW SAFETY PASSED ===");
