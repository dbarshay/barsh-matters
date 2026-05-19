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

const routePath = "app/api/documents/clio-maildrop-resolve/route.ts";
const helperPath = "lib/documents/delivery.ts";
const directPath = "app/matter/[id]/page.tsx";
const masterPath = "app/matters/page.tsx";
const packagePath = "package.json";

const route = read(routePath);
const helper = read(helperPath);
const direct = read(directPath);
const master = read(masterPath);
const packageJson = read(packagePath);

console.log("=== CLIO MAILDROP DELIVERY SAFETY VERIFICATION ===");

mustContain(routePath, route, "export async function GET");
mustContain(routePath, route, 'action: "clio-maildrop-resolve"');
mustContain(routePath, route, "readOnly: true");
mustContain(routePath, route, "maildrop_address");
mustContain(routePath, route, "maildropLabel");
mustContain(routePath, route, "MailDrop-");
mustContain(routePath, route, "formattedCc");
mustContain(routePath, route, "source === \"master_lawsuit\"");

mustNotContain(routePath, route, "export async function POST");
mustNotContain(routePath, route, "export async function PATCH");
mustNotContain(routePath, route, "export async function DELETE");
mustNotContain(routePath, route, 'method: "POST"');
mustNotContain(routePath, route, 'method: "PATCH"');
mustNotContain(routePath, route, 'method: "DELETE"');
mustNotContain(routePath, route, "prisma.lawsuit.update");
mustNotContain(routePath, route, "prisma.claimIndex.update");

mustContain(helperPath, helper, "clioMaildropLabel?: string");
mustContain(helperPath, helper, "formatEmailRecipient");
mustContain(helperPath, helper, "formatEmailRecipient(context.clioMaildropLabel, context.clioMaildropEmail)");

mustContain(directPath, direct, "resolveMatterMaildropForDelivery");
mustContain(directPath, direct, "source=direct_matter");
mustContain(directPath, direct, "clioMaildropEmail: json.maildropEmail");
mustContain(directPath, direct, "clioMaildropLabel: json.maildropLabel");

mustContain(masterPath, master, "resolveMasterMaildropForDelivery");
mustContain(masterPath, master, "source=master_lawsuit");
mustContain(masterPath, master, "clioMaildropEmail: json.maildropEmail");
mustContain(masterPath, master, "clioMaildropLabel: json.maildropLabel");

if (packageJson.includes('"verify:clio-maildrop-delivery-safety"')) {
  pass("package.json: verifier registered");
} else {
  fail("package.json: verifier not registered");
}

if (failures) {
  console.error(`=== CLIO MAILDROP DELIVERY SAFETY FAILED: ${failures} failure(s) ===`);
  process.exit(1);
}

console.log("=== CLIO MAILDROP DELIVERY SAFETY PASSED ===");
