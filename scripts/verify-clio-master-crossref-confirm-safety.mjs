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

const routePath = "app/api/documents/clio-master-crossref-confirm/route.ts";
const packagePath = "package.json";

const route = read(routePath);
const packageJson = read(packagePath);

console.log("=== CLIO MASTER CROSSREF CONFIRM SAFETY VERIFICATION ===");

mustContain(routePath, route, "export async function POST");
mustContain(routePath, route, 'action: "clio-master-crossref-confirm"');
mustContain(routePath, route, "requiresTypedConfirmation: true");
mustContain(routePath, route, "WRITE CLIO CROSSREF");
mustContain(routePath, route, "loadPreview(req, masterLawsuitId)");
mustContain(routePath, route, "preview.readyForConfirm");
mustContain(routePath, route, "writeCrossrefTarget");
mustContain(routePath, route, "custom_field_values: customFieldValues");
mustContain(routePath, route, 'method: "PATCH"');
mustContain(routePath, route, "clioRecordsChanged: true");
mustContain(routePath, route, "databaseRecordsChanged: false");
mustContain(routePath, route, "documentsUploaded: false");
mustContain(routePath, route, "documentsDownloaded: false");

mustNotContain(routePath, route, "export async function GET");
mustNotContain(routePath, route, "export async function DELETE");
mustNotContain(routePath, route, "prisma.");
mustNotContain(routePath, route, "uploadBufferToClioMatterDocuments");
mustNotContain(routePath, route, "/sendMail");
mustNotContain(routePath, route, "messages.send");
mustNotContain(routePath, route, "createUploadSession");

if (packageJson.includes('"verify:clio-master-crossref-confirm-safety"')) {
  pass("package.json: verifier registered");
} else {
  fail("package.json: verifier not registered");
}

if (failures) {
  console.error(`=== CLIO MASTER CROSSREF CONFIRM SAFETY FAILED: ${failures} failure(s) ===`);
  process.exit(1);
}

console.log("=== CLIO MASTER CROSSREF CONFIRM SAFETY PASSED ===");
