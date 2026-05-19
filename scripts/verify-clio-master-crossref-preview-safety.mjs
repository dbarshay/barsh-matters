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

const routePath = "app/api/documents/clio-master-crossref-preview/route.ts";
const packagePath = "package.json";

const route = read(routePath);
const packageJson = read(packagePath);

console.log("=== CLIO MASTER CROSSREF PREVIEW SAFETY VERIFICATION ===");

mustContain(routePath, route, "export async function GET");
mustContain(routePath, route, 'action: "clio-master-crossref-preview"');
mustContain(routePath, route, "previewOnly: true");
mustContain(routePath, route, "clioRecordsChanged: false");
mustContain(routePath, route, "databaseRecordsChanged: false");
mustContain(routePath, route, "MATTER_CF.MASTER_LAWSUIT_ID");
mustContain(routePath, route, "MATTER_CF.LAWSUIT_MATTERS");
mustContain(routePath, route, "MATTER_CF.LAWSUIT_MATTER_BRL_NUMBERS");
mustContain(routePath, route, "WRITE CLIO CROSSREF");
mustContain(routePath, route, "readyForConfirm");
mustContain(routePath, route, "masterLawsuitDisplayValue");
mustContain(routePath, route, "${masterLawsuitId} / ${clean(lawsuit.clioMasterDisplayNumber)}");
mustContain(routePath, route, "readClioMatter");
mustContain(routePath, route, "custom_field_values{id,value,custom_field}");
mustNotContain(routePath, route, "custom_field_values{id,value,custom_field{id,name}}");

mustNotContain(routePath, route, "export async function POST");
mustNotContain(routePath, route, "export async function PATCH");
mustNotContain(routePath, route, "export async function DELETE");
mustNotContain(routePath, route, 'method: "POST"');
mustNotContain(routePath, route, 'method: "PATCH"');
mustNotContain(routePath, route, 'method: "DELETE"');
mustNotContain(routePath, route, "prisma.lawsuit.update");
mustNotContain(routePath, route, "prisma.claimIndex.update");
mustNotContain(routePath, route, "custom_field_values: [");

if (packageJson.includes('"verify:clio-master-crossref-preview-safety"')) {
  pass("package.json: verifier registered");
} else {
  fail("package.json: verifier not registered");
}

if (failures) {
  console.error(`=== CLIO MASTER CROSSREF PREVIEW SAFETY FAILED: ${failures} failure(s) ===`);
  process.exit(1);
}

console.log("=== CLIO MASTER CROSSREF PREVIEW SAFETY PASSED ===");
