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

const routePath = "app/api/documents/clio-maildrop-inspect/route.ts";
const packagePath = "package.json";

const route = read(routePath);
const packageJson = read(packagePath);

console.log("=== CLIO MAILDROP INSPECTION SAFETY VERIFICATION ===");

mustContain(routePath, route, "export async function GET");
mustContain(routePath, route, 'action: "clio-maildrop-inspection"');
mustContain(routePath, route, "readOnly: true");
mustContain(routePath, route, "clioRecordsChanged: false");
mustContain(routePath, route, "databaseRecordsChanged: false");
mustContain(routePath, route, "findMaildropCandidates");
mustContain(routePath, route, "maildrop_address");
mustContain(routePath, route, "maildrop");
mustContain(routePath, route, "maildrop_email");
mustContain(routePath, route, "mappedMasterMatter");
mustContain(routePath, route, "clioMasterMatterId");

mustNotContain(routePath, route, "export async function POST");
mustNotContain(routePath, route, "export async function PATCH");
mustNotContain(routePath, route, "export async function DELETE");
mustNotContain(routePath, route, 'method: "POST"');
mustNotContain(routePath, route, 'method: "PATCH"');
mustNotContain(routePath, route, 'method: "DELETE"');
mustNotContain(routePath, route, "prisma.lawsuit.update");
mustNotContain(routePath, route, "prisma.claimIndex.update");
mustNotContain(routePath, route, "custom_field_values: [");

if (packageJson.includes('"verify:clio-maildrop-inspection-safety"')) {
  pass("package.json: verifier registered");
} else {
  fail("package.json: verifier not registered");
}

if (failures) {
  console.error(`=== CLIO MAILDROP INSPECTION SAFETY FAILED: ${failures} failure(s) ===`);
  process.exit(1);
}

console.log("=== CLIO MAILDROP INSPECTION SAFETY PASSED ===");
