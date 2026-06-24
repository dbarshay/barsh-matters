import fs from "node:fs";

const removeTokens = [
  "{{patient.lastName}}",
  "{{provider.hidden_street}}",
  "{{provider.hidden_city}}",
  "{{provider.hidden_state}}",
  "{{provider.hidden_zipcode}}",
  "{{matter.dateOfService}}",
  "{{claim.dosStart}}",
  "{{claim.dosEnd}}",
];

const checks = [];
const add = (name, ok) => checks.push({ name, ok });
const read = (path) => fs.existsSync(path) ? fs.readFileSync(path, "utf8") : "";

const library = read("src/lib/templates/template-builder-merge-field-library.ts");
const resolver = read("src/lib/templates/template-builder-live-example-preview.ts");
const build = read("app/admin/document-templates/build/page.tsx");
const pkg = JSON.parse(read("package.json"));

for (const token of removeTokens) {
  add("Removed from merge-field library " + token, !library.includes(token));
  add("Removed from live preview resolver " + token, !resolver.includes(token));
}

add("Build Template still uses shared field library", build.includes("TEMPLATE_BUILDER_CANONICAL_MERGE_FIELDS"));
add("Dash behavior remains unchanged", build.includes("return exampleOutputMap[field.mergeField] || \"—\";"));
add("Package has additional-field removal verifier", pkg.scripts && pkg.scripts["verify:template-builder-remove-additional-fields"] === "node scripts/verify-template-builder-remove-additional-fields.mjs");

const failed = checks.filter((check) => check.ok === false);
for (const check of checks) {
  const color = check.ok ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m";
  console.log(color + ": " + check.name);
}
if (failed.length > 0) {
  console.error(String.fromCharCode(10) + failed.length + " Template Builder additional field-removal checks failed.");
  process.exit(1);
}
console.log(String.fromCharCode(10) + "PASS: Template Builder additional fields removed and dash behavior preserved.");
