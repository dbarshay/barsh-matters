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

const routePath = "app/api/documents/clio-master-matter-confirm/route.ts";
const packagePath = "package.json";

const route = read(routePath);
const packageJson = read(packagePath);

console.log("=== CLIO MASTER MATTER CONFIRM SAFETY VERIFICATION ===");

mustContain(routePath, route, "export async function POST");
mustContain(routePath, route, 'action: "clio-master-matter-create-confirm"');
mustContain(routePath, route, "requiresTypedConfirmation: true");
mustContain(routePath, route, "CREATE CLIO MASTER");
mustContain(routePath, route, "loadPreview(req, masterLawsuitId)");
mustContain(routePath, route, "blockingWarnings.length > 0");
mustContain(routePath, route, "Refusing to create a duplicate Clio master matter");
mustContain(routePath, route, "clioFetch(`/api/v4/matters.json");
mustContain(routePath, route, "findClientFromChildClioMatters");
mustContain(routePath, route, "client_id: params.clientId");
mustContain(routePath, route, "childClient");
mustContain(routePath, route, 'method: "POST"');
mustContain(routePath, route, "prisma.lawsuit.update");
mustContain(routePath, route, "clioMasterMatterId: created.matterId");
mustContain(routePath, route, "clioMasterDisplayNumber: created.displayNumber");
mustContain(routePath, route, "clioMasterMatterDescription");
mustContain(routePath, route, "clioMasterMappedAt: new Date()");
mustContain(routePath, route, "clioRecordsChanged: true");
mustContain(routePath, route, "databaseRecordsChanged: true");
mustContain(routePath, route, "documentsUploaded: false");
mustContain(routePath, route, "documentsDownloaded: false");

mustNotContain(routePath, route, "export async function GET");
mustNotContain(routePath, route, "export async function PATCH");
mustNotContain(routePath, route, "export async function DELETE");
mustNotContain(routePath, route, "uploadBufferToClioMatterDocuments");
mustNotContain(routePath, route, "prisma.claimIndex.update");
mustNotContain(routePath, route, "prisma.documentFinalization.create");
mustNotContain(routePath, route, "/sendMail");
mustNotContain(routePath, route, "messages.send");
mustNotContain(routePath, route, "createUploadSession");

if (packageJson.includes('"verify:clio-master-matter-confirm-safety"')) {
  pass("package.json: verifier registered");
} else {
  fail("package.json: verifier not registered");
}

if (failures) {
  console.error(`=== CLIO MASTER MATTER CONFIRM SAFETY FAILED: ${failures} failure(s) ===`);
  process.exit(1);
}

console.log("=== CLIO MASTER MATTER CONFIRM SAFETY PASSED ===");
