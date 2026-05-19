import fs from "node:fs";

let failures = 0;

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function pass(message) {
  console.log(`PASS: ${message}`);
}

function fail(message) {
  failures += 1;
  console.error(`FAIL: ${message}`);
}

function mustContain(label, text, needle) {
  if (text.includes(needle)) pass(`${label}: found ${needle}`);
  else fail(`${label}: missing ${needle}`);
}

function mustNotContain(label, text, needle) {
  if (!text.includes(needle)) pass(`${label}: does not contain ${needle}`);
  else fail(`${label}: must not contain ${needle}`);
}

const routePath = "app/api/documents/clio-master-matter-preview/route.ts";
const packagePath = "package.json";

const route = read(routePath);
const packageJson = read(packagePath);

console.log("=== CLIO MASTER MATTER PREVIEW SAFETY VERIFICATION ===");

mustContain(routePath, route, "export async function GET");
mustContain(routePath, route, 'action: "clio-master-matter-create-preview"');
mustContain(routePath, route, "previewOnly: true");
mustContain(routePath, route, "createsClioMatter: false");
mustContain(routePath, route, "clioRecordsChanged: false");
mustContain(routePath, route, "databaseRecordsChanged: false");
mustContain(routePath, route, "documentsUploaded: false");
mustContain(routePath, route, "documentsDownloaded: false");
mustContain(routePath, route, "MASTER LAWSUIT -");
mustContain(routePath, route, "TO_BE_ASSIGNED_BY_CLIO_BRLXXXXX");
mustContain(routePath, route, "mustNotUseMasterLawsuitIdAsClioDisplayNumber: true");
mustContain(routePath, route, "clioAssignsBrlDisplayNumber: true");
mustContain(routePath, route, "typedConfirmationRequired");
mustContain(routePath, route, "POST /api/v4/matters.json");

mustNotContain(routePath, route, "export async function POST");
mustNotContain(routePath, route, "export async function PATCH");
mustNotContain(routePath, route, "export async function DELETE");
mustNotContain(routePath, route, "clioFetch(");
mustNotContain(routePath, route, 'method: "POST"');
mustNotContain(routePath, route, 'method: "PATCH"');
mustNotContain(routePath, route, 'method: "DELETE"');
mustNotContain(routePath, route, "prisma.lawsuit.update");
mustNotContain(routePath, route, "prisma.claimIndex.update");
mustNotContain(routePath, route, "prisma.documentFinalization.create");

if (packageJson.includes('"verify:clio-master-matter-preview-safety"')) {
  pass("package.json: verifier registered");
} else {
  fail("package.json: verifier not registered");
}

if (failures) {
  console.error(`=== CLIO MASTER MATTER PREVIEW SAFETY FAILED: ${failures} failure(s) ===`);
  process.exit(1);
}

console.log("=== CLIO MASTER MATTER PREVIEW SAFETY PASSED ===");
