import fs from "node:fs";

const checks = [];
const add = (name, ok) => checks.push({ name, ok });

const read = (path) => fs.existsSync(path) ? fs.readFileSync(path, "utf8") : "";
const build = read("app/admin/document-templates/build/page.tsx");
const pkg = JSON.parse(read("package.json"));

add("Build Template imports useEffect", build.includes("useEffect"));
add("Build Template has live example output map state", build.includes("exampleOutputMap"));
add("Build Template has live preview status state", build.includes("examplePreviewStatus"));
add("Build Template fetches live preview API", build.includes("/api/admin/document-templates/example-preview?matter="));
add("Build Template fetch uses selected exampleMatter", build.includes("encodeURIComponent(exampleMatter)"));
add("Build Template stores resolved preview map", build.includes("setExampleOutputMap(payload?.resolved || {})"));
add("Build Template renders live example output map", build.includes("Object.prototype.hasOwnProperty.call(exampleOutputMap, field.mergeField)"));
add("Build Template table uses exampleOutputFor", build.includes("{exampleOutputFor(field)}"));
add("Build Template no longer embeds static example fixture", !build.includes("TEMPLATE_BUILDER_EXAMPLE_MATTER_OUTPUTS"));
add("Build Template no longer renders static field.exampleOutput directly", !build.includes("<span>{field.exampleOutput}</span>"));
add("Package has live client verifier script", pkg.scripts && pkg.scripts["verify:template-builder-live-example-preview-client"] === "node scripts/verify-template-builder-live-example-preview-client.mjs");

const failed = checks.filter((check) => check.ok === false);
for (const check of checks) {
  const color = check.ok ? "\\x1b[32mPASS\\x1b[0m" : "\\x1b[31mFAIL\\x1b[0m";
  console.log(color + ": " + check.name);
}
if (failed.length > 0) {
  console.error(String.fromCharCode(10) + failed.length + " live example preview client checks failed.");
  process.exit(1);
}
console.log(String.fromCharCode(10) + "PASS: Template Builder live example preview client wiring verified.");
