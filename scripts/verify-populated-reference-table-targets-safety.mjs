import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exitCode = 1;
}

function mustContain(label, text, needle) {
  if (!text.includes(needle)) fail(`${label} missing ${needle}`);
}

function mustNotContain(label, text, needle) {
  if (text.includes(needle)) fail(`${label} must not contain ${needle}`);
}

const identityRoute = read("app/api/matters/identity-field/route.ts");
const mattersPage = read("app/matters/page.tsx");
const referenceData = read("lib/referenceData.ts");
const packageJson = read("package.json");

const populatedTypes = [
  "provider_client",
  "insurer_company",
  "treating_provider",
  "court_venue",
  "service_type",
  "denial_reason",
  "closed_reason",
];

const intentionallyUnenforcedEmptyTypes = [
  "patient",
  "adversary_attorney",
  "transaction_type",
  "transaction_status",
];

for (const type of populatedTypes) {
  mustContain("referenceData helper", referenceData, `"${type}"`);
}

for (const type of intentionallyUnenforcedEmptyTypes) {
  mustContain("referenceData helper empty type still exists", referenceData, `"${type}"`);
}

mustContain("identity route provider reference", identityRoute, 'client_name: {');
mustContain("identity route provider reference", identityRoute, 'referenceType: "provider_client"');

mustContain("identity route insurer reference", identityRoute, 'insurer_name: {');
mustContain("identity route insurer reference", identityRoute, 'referenceType: "insurer_company"');

mustContain("identity route treating provider reference", identityRoute, 'treating_provider: {');
mustContain("identity route treating provider reference", identityRoute, 'referenceType: "treating_provider"');

mustContain("identity route patient remains present", identityRoute, 'patient_name: {');
mustContain("identity route patient label", identityRoute, 'label: "Patient"');
mustNotContain("identity route patient not enforced yet", identityRoute, 'referenceType: "patient"');

mustContain("identity route enforcement still exists", identityRoute, "must match an active local reference-data record");

mustContain(
  "matters page contact type signature",
  mattersPage,
  'function masterInfoContactType(field: string): "person" | "insurer_company" | "provider_client" | "all"',
);
mustContain("matters page patient still generic person", mattersPage, 'if (field === "patient") return "person"');
mustContain("matters page insurer canonical", mattersPage, 'if (field === "insurer") return "insurer_company"');
mustContain("matters page provider canonical", mattersPage, 'if (field === "provider") return "provider_client"');
mustNotContain("matters page insurer no generic company", mattersPage, 'if (field === "insurer") return "company"');

mustContain("package.json", packageJson, "verify:populated-reference-table-targets-safety");

if (process.exitCode) {
  process.exit();
}

console.log("Populated reference table target safety verifier passed.");
