import fs from "node:fs";

const removedTokens = [
  "{{patient.lastName}}",
  "{{provider.hidden_street}}",
  "{{provider.hidden_city}}",
  "{{provider.hidden_state}}",
  "{{provider.hidden_zipcode}}",
  "{{matter.dateOfService}}",
  "{{claim.dosStart}}",
  "{{claim.dosEnd}}"
];

const checks = [];
const add = (name, ok) => checks.push({ name, ok });
const read = (path) => fs.existsSync(path) ? fs.readFileSync(path, "utf8") : "";

const library = read("src/lib/templates/template-builder-merge-field-library.ts");
const build = read("app/admin/document-templates/build/page.tsx");
const pkg = JSON.parse(read("package.json"));

const mergeFieldValues = [...library.matchAll(/mergeField:\s*"([^"]*)"/g)].map((match) => match[1]);
const blanks = mergeFieldValues.filter((value) => value.trim() === "");
const duplicates = mergeFieldValues.filter((value, index) => value && mergeFieldValues.indexOf(value) !== index);

add("No blank mergeField values remain", blanks.length === 0);
add("No duplicate mergeField values remain", duplicates.length === 0);
for (const token of removedTokens) {
  add("Removed token absent from merge-field library " + token, !library.includes(token));
}
add("Build Template visibleFields map receives fieldIndex", build.includes("visibleFields.map((field, fieldIndex) =>"));
add("Build Template field row key cannot be blank", build.includes("key={field.mergeField || `field-${fieldIndex}`}"));
add("Package has blank-key verifier script", pkg.scripts && pkg.scripts["verify:template-builder-no-blank-field-keys"] === "node scripts/verify-template-builder-no-blank-field-keys.mjs");

const failed = checks.filter((check) => check.ok === false);
for (const check of checks) {
  const color = check.ok ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m";
  console.log(color + ": " + check.name);
}
if (failed.length > 0) {
  console.error(String.fromCharCode(10) + failed.length + " Template Builder blank-key checks failed.");
  if (blanks.length) console.error("Blank merge fields: " + JSON.stringify(blanks));
  if (duplicates.length) console.error("Duplicate merge fields: " + JSON.stringify([...new Set(duplicates)]));
  process.exit(1);
}
console.log(String.fromCharCode(10) + "PASS: Template Builder has no blank/duplicate field keys.");
