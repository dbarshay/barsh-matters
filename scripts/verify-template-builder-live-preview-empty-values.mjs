import fs from "node:fs";

const checks = [];
const add = (name, ok) => checks.push({ name, ok });

const read = (path) => fs.existsSync(path) ? fs.readFileSync(path, "utf8") : "";
const build = read("app/admin/document-templates/build/page.tsx");
const pkg = JSON.parse(read("package.json"));

add("Build Template uses live map ownership check", build.includes("Object.prototype.hasOwnProperty.call(exampleOutputMap, field.mergeField)"));
add("Build Template renders em dash for empty live preview values", build.includes("return exampleOutputMap[field.mergeField] || \"—\";"));
add("Build Template does not fall back from empty live value to static example", !build.includes("return exampleOutputMap[field.mergeField] || field.exampleOutput;"));
add("Build Template still has static fallback only before live payload arrives", build.includes("return field.exampleOutput;"));
add("Package has empty-value verifier script", pkg.scripts && pkg.scripts["verify:template-builder-live-preview-empty-values"] === "node scripts/verify-template-builder-live-preview-empty-values.mjs");

const failed = checks.filter((check) => check.ok === false);
for (const check of checks) {
  const color = check.ok ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m";
  console.log(color + ": " + check.name);
}
if (failed.length > 0) {
  console.error(String.fromCharCode(10) + failed.length + " Template Builder live preview empty-value checks failed.");
  process.exit(1);
}
console.log(String.fromCharCode(10) + "PASS: Template Builder live preview now controls populated and empty example outputs.");
