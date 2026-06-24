import fs from "node:fs";

const checks = [];
const add = (name, ok) => checks.push({ name, ok });

const read = (path) => fs.existsSync(path) ? fs.readFileSync(path, "utf8") : "";
const library = read("src/lib/templates/template-builder-merge-field-library.ts");
const build = read("app/admin/document-templates/build/page.tsx");

const removedTokens = [
  "{{patient.dateOfBirth}}",
  "{{patient.hidden_street}}",
  "{{treatingProvider.hidden_street}}",
  "{{patient.hidden_zipcode}}",
  "{{treatingProvider.hidden_zipcode}}",
  "{{provider.name}}",
  "{{matter.id}}",
  "{{matter.displayNumber}}",
  "{{matter.closedReason}}",
  "{{patient.firstName}}",
  "{{patient.name}}",
  "{{matter.type}}",
  "{{patient.hidden_city}}",
  "{{treatingProvider.hidden_city}}",
  "{{matter.caseType}}",
  "{{patient.hidden_state}}",
  "{{treatingProvider.hidden_state}}",
  "{{matter.finalStatus}}",
];

for (const token of removedTokens) {
  add("Removed non-template-facing field " + token, !library.includes(token));
}

const keptTokens = [
  "{{provider.taxId}}",
  "{{treatingProvider.name}}",
  "{{insurer.name}}",
  "{{insurer.hidden_street}}",
  "{{insurer.hidden_city}}",
  "{{insurer.hidden_state}}",
  "{{insurer.hidden_zipcode}}",
  "{{claim.number}}",
  "{{claim.dateOfLoss}}",
  "{{claim.dateOfService}}",
  "{{claim.amount}}",
  "{{claim.denialReason}}",
  "{{lawsuit.indexNumber}}",
  "{{lawsuit.court}}",
  "{{lawsuit.adversaryAttorney}}",
  "{{lawsuit.dateFiled}}",
  "{{lawsuit.amount}}",
  "{{lawsuit.balance}}",
  "{{cost.indexFee}}",
  "{{cost.serviceFee}}",
  "{{cost.otherCourtCosts}}",
];

for (const token of keptTokens) {
  add("Kept approved available field " + token, library.includes(token));
}

const mergeFieldCount = library.split(String.fromCharCode(10)).filter((line) => line.trim().startsWith("mergeField:")).length;
add("Curated field count remains controlled after removals", mergeFieldCount >= 40 && mergeFieldCount <= 70);
add("Build Template still uses shared field library", build.includes("TEMPLATE_BUILDER_CANONICAL_MERGE_FIELDS"));

const pkg = JSON.parse(read("package.json"));
add("Package has extra-field removal verifier script", pkg.scripts && pkg.scripts["verify:template-builder-remove-extra-fields"] === "node scripts/verify-template-builder-remove-extra-fields.mjs");

const failed = checks.filter((check) => check.ok === false);
for (const check of checks) {
  const color = check.ok ? "\\x1b[32mPASS\\x1b[0m" : "\\x1b[31mFAIL\\x1b[0m";
  console.log(color + ": " + check.name);
}
console.log("MERGE_FIELD_COUNT=" + mergeFieldCount);
if (failed.length > 0) {
  console.error(String.fromCharCode(10) + failed.length + " Template Builder extra-field removal checks failed.");
  process.exit(1);
}
console.log(String.fromCharCode(10) + "PASS: Template Builder extra non-template-facing fields removed.");
