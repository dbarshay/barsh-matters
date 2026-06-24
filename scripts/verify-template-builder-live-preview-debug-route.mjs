import fs from "node:fs";

const checks = [];
const add = (name, ok) => checks.push({ name, ok });

const read = (path) => fs.existsSync(path) ? fs.readFileSync(path, "utf8") : "";
const route = read("app/api/admin/document-templates/example-preview-debug/route.ts");
const pkg = JSON.parse(read("package.json"));

add("Debug route exists", route.includes("example-preview-debug") || route.includes("resolveTemplateBuilderExamplePreview"));
add("Debug route calls live resolver", route.includes("resolveTemplateBuilderExamplePreview(matter)"));
add("Debug route defaults to 2026.06.00011", route.includes("2026.06.00011"));
add("Debug route returns diagnostics", route.includes("diagnostics"));
add("Debug route returns resolved keys", route.includes("resolvedKeys"));
add("Package has debug route verifier", pkg.scripts && pkg.scripts["verify:template-builder-live-preview-debug-route"] === "node scripts/verify-template-builder-live-preview-debug-route.mjs");

const failed = checks.filter((check) => check.ok === false);
for (const check of checks) {
  const color = check.ok ? "\\x1b[32mPASS\\x1b[0m" : "\\x1b[31mFAIL\\x1b[0m";
  console.log(color + ": " + check.name);
}
if (failed.length > 0) {
  console.error(String.fromCharCode(10) + failed.length + " live preview debug route checks failed.");
  process.exit(1);
}
console.log(String.fromCharCode(10) + "PASS: Template Builder live preview debug route verified.");
