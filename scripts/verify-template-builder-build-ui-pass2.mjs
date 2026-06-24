import fs from "node:fs";

const checks = [];
const add = (name, ok) => checks.push({ name, ok });

const read = (path) => fs.existsSync(path) ? fs.readFileSync(path, "utf8") : "";
const build = read("app/admin/document-templates/build/page.tsx");
const mergeLibrary = read("src/lib/templates/template-builder-merge-field-library.ts");

for (const token of [
  "selectedFormats",
  "toggleFormat",
  "appliedFormatsFor",
  "withFormats",
  "aria-pressed={checked}",
  "TEMPLATE_BUILDER_SUPPORTED_FORMAT_MODIFIERS",
  "Formats for copy",
  "Action",
  "TrashIcon",
  "Delete Field",
  "Delete",
  "Cancel",
  "setDeleteCandidate",
  "confirmDeleteField",
  "field.exampleOutput",
]) {
  add(`Build Template pass 2 contains ${token}`, build.includes(token));
}

for (const token of [
  "\"bold\"",
  "\"italic\"",
  "\"underline\"",
]) {
  add(`Shared merge-field library contains modifier ${token}`, mergeLibrary.includes(token));
}

for (const removed of [
  "Phase 3 locks the searchable merge-field library",
  "from \" + exampleMatter",
  "from BRL_202600003",
  "Format for copy\\n          <select",
]) {
  add(`Build Template pass 2 removes ${removed}`, !build.includes(removed));
}

add("Example output no longer appends example matter", !build.includes("field.exampleOutput + \" from \""));
add("Multi-format UI uses buttons instead of single select", build.includes("Formats for copy") && !build.includes("<select value={format}"));
add("Delete confirmation is modal-like dialog", build.includes("role=\"dialog\"") && build.includes("aria-modal=\"true\""));
add("Copy icon remains next to merge token", build.includes("<code style={{ fontFamily: \"monospace\" }}>{token}</code>") && build.includes("<CopyIcon />"));
add("Delete action appears left of Category column", build.includes("<th style={{ ...headerStyle, width: \"78px\" }}>Action</th>") && build.indexOf("Action</th>") < build.indexOf("Category <span>"));

const pkg = JSON.parse(read("package.json"));
add("Package has UI pass 2 verifier script", pkg.scripts && pkg.scripts["verify:template-builder-build-ui-pass2"] === "node scripts/verify-template-builder-build-ui-pass2.mjs");

const failed = checks.filter((check) => check.ok === false);
for (const check of checks) {
  const color = check.ok ? "\\x1b[32mPASS\\x1b[0m" : "\\x1b[31mFAIL\\x1b[0m";
  console.log(`${color}: ${check.name}`);
}
if (failed.length > 0) {
  console.error(`\\n${failed.length} Build Template UI pass 2 checks failed.`);
  process.exit(1);
}
console.log("\\nPASS: Build Template UI pass 2 verified.");
