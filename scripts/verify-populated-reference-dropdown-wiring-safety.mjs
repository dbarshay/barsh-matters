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

const optionsRoute = read("app/api/reference-data/options/route.ts");
const adminTicklers = read("app/admin/ticklers/page.tsx");
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
  "transaction_type",
  "transaction_status",
];

for (const type of populatedTypes) {
  mustContain("referenceData helper", referenceData, `"${type}"`);
  mustContain("options route", optionsRoute, type);
}

mustContain("options route insurer alias", optionsRoute, 'insurer: "insurer_company"');
mustContain("options route insurers alias", optionsRoute, 'insurers: "insurer_company"');
mustContain("options route company alias", optionsRoute, 'company: "insurer_company"');
mustContain("options route label", optionsRoute, 'insurer_company: "Insurers / Companies"');
mustNotContain("options route must not use obsolete insurer table", optionsRoute, 'insurer: "insurer",');
mustNotContain("options route must not label obsolete insurer table", optionsRoute, 'insurer: "Insurers / Companies"');

mustContain("admin ticklers provider table", adminTicklers, 'provider: "provider_client"');
mustContain("admin ticklers insurer table", adminTicklers, 'insurer: "insurer_company"');
mustContain("admin ticklers service table", adminTicklers, 'serviceType: "service_type"');
mustContain("admin ticklers denial table", adminTicklers, 'denialReason: "denial_reason"');
mustContain("admin ticklers closed table", adminTicklers, 'closedReason: "closed_reason"');
mustContain("admin ticklers court table", adminTicklers, 'court: "court_venue"');
mustContain("admin ticklers treating provider table", adminTicklers, 'treatingProvider: "treating_provider"');

mustContain("admin ticklers provider datalist", adminTicklers, 'list="admin-tickler-provider-options"');
mustContain("admin ticklers insurer datalist", adminTicklers, 'list="admin-tickler-insurer-options"');
mustContain("admin ticklers service datalist", adminTicklers, 'list="admin-tickler-service-type-options"');
mustContain("admin ticklers treating provider datalist", adminTicklers, 'list="admin-tickler-treating-provider-options"');
mustContain("admin ticklers denial datalist", adminTicklers, 'list="admin-tickler-denial-reason-options"');
mustContain("admin ticklers closed datalist", adminTicklers, 'list="admin-tickler-closed-reason-options"');
mustContain("admin ticklers court datalist", adminTicklers, 'list="admin-tickler-court-options"');

mustNotContain("admin ticklers patient must remain free text for now", adminTicklers, 'list="admin-tickler-patient-options"');
mustNotContain("admin ticklers must not point insurer to obsolete table", adminTicklers, 'insurer: "insurer",');
mustContain(
  "admin ticklers referenceOptionTypes block has no stray extra brace",
  adminTicklers,
  `const referenceOptionTypes = {
  provider: "provider_client",
  insurer: "insurer_company",
  serviceType: "service_type",
  denialReason: "denial_reason",
  closedReason: "closed_reason",
  court: "court_venue",
  treatingProvider: "treating_provider",
};

function optionText`,
);

mustContain("package.json", packageJson, "verify:populated-reference-dropdown-wiring-safety");

if (process.exitCode) {
  process.exit();
}

console.log("Populated reference dropdown wiring safety verifier passed.");
