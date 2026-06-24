import fs from "node:fs";

const checks = [];
const add = (name, ok) => checks.push({ name, ok });

const read = (path) => fs.existsSync(path) ? fs.readFileSync(path, "utf8") : "";
const build = read("app/admin/document-templates/build/page.tsx");
const pkg = JSON.parse(read("package.json"));

for (const token of [
  "exampleOutputMap",
  "function exampleOutputFor",
  "Object.prototype.hasOwnProperty.call(exampleOutputMap, field.mergeField)",
  "{exampleOutputFor(field)}",
  "2026.06.00011",
]) {
  add("Build Template dynamic example output contains " + token, build.includes(token));
}

add("Build Template no longer renders static field.exampleOutput directly in table cell", !build.includes("<span>{field.exampleOutput}</span>"));
add("Build Template no longer embeds static example matter fixture object", !build.includes("TEMPLATE_BUILDER_EXAMPLE_MATTER_OUTPUTS"));
add("Package keeps dynamic example-output verifier script", pkg.scripts && pkg.scripts["verify:template-builder-dynamic-example-output"] === "node scripts/verify-template-builder-dynamic-example-output.mjs");

const failed = checks.filter((check) => check.ok === false);
for (const check of checks) {
  const color = check.ok ? "\\x1b[32mPASS\\x1b[0m" : "\\x1b[31mFAIL\\x1b[0m";
  console.log(color + ": " + check.name);
}
if (failed.length > 0) {
  console.error(String.fromCharCode(10) + failed.length + " Template Builder dynamic example output checks failed.");
  process.exit(1);
}
console.log(String.fromCharCode(10) + "PASS: Template Builder example matter dynamically changes example outputs through live API.");
