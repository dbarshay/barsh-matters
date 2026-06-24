import fs from "node:fs";

const checks = [];
const add = (name, ok) => checks.push({ name, ok });

const read = (path) => fs.existsSync(path) ? fs.readFileSync(path, "utf8") : "";
const build = read("app/admin/document-templates/build/page.tsx");
const library = read("src/lib/templates/template-builder-merge-field-library.ts");

const mergeFieldMatches = [];
for (const line of library.split(String.fromCharCode(10))) {
  const trimmed = line.trim();
  if (!trimmed.startsWith("mergeField:")) continue;
  const first = trimmed.indexOf(String.fromCharCode(34));
  const last = trimmed.lastIndexOf(String.fromCharCode(34));
  if (first >= 0 && last > first) mergeFieldMatches.push(trimmed.slice(first + 1, last));
}
const uniqueMergeFields = Array.from(new Set(mergeFieldMatches));

for (const token of [
  "{{patient.lastName}}",
  "{{provider.hidden_street}}",
  "{{provider.hidden_city}}",
  "{{provider.hidden_state}}",
  "{{provider.hidden_zipcode}}",
  "{{treatingProvider.name}}",
  "{{insurer.name}}",
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
]) {
  add("Curated library includes " + token, uniqueMergeFields.includes(token));
}

for (const blocked of [
  "{{adminUser.passwordHash}}",
  "{{adminUser.twoFactorPhone}}",
  "{{adminUserPermissionOverride.permissionKey}}",
  "{{documentTemplate.storagePath}}",
  "{{adminRolePermission.permissionKey}}",
  "{{provider.name}}",
  "{{patient.name}}",
  "{{patient.firstName}}",
  "{{patient.dateOfBirth}}",
  "{{matter.id}}",
  "{{matter.displayNumber}}",
  "{{matter.type}}",
  "{{matter.caseType}}",
  "{{matter.finalStatus}}",
  "{{matter.closedReason}}",
]) {
  add("Curated library excludes blocked token " + blocked, !uniqueMergeFields.includes(blocked));
}

add("Curated field count is controlled, not schema-wide", uniqueMergeFields.length >= 40 && uniqueMergeFields.length <= 70);
add("Merge-field library merge fields are unique", uniqueMergeFields.length === mergeFieldMatches.length);
add("Build Template no longer shows field kind/type descriptions", !build.includes("{field.kind} · {field.fieldType}") && !build.includes("signatureHeader · Text"));

const pkg = JSON.parse(read("package.json"));
add("Package has curated-field verifier script", pkg.scripts && pkg.scripts["verify:template-builder-curated-fields"] === "node scripts/verify-template-builder-curated-fields.mjs");

const failed = checks.filter((check) => check.ok === false);
for (const check of checks) {
  const color = check.ok ? "\\x1b[32mPASS\\x1b[0m" : "\\x1b[31mFAIL\\x1b[0m";
  console.log(color + ": " + check.name);
}
console.log("MERGE_FIELD_COUNT=" + uniqueMergeFields.length);
if (failed.length > 0) {
  console.error(String.fromCharCode(10) + failed.length + " Template Builder curated-field checks failed.");
  process.exit(1);
}
console.log(String.fromCharCode(10) + "PASS: Template Builder curated UI/hidden field library verified.");
