import fs from "node:fs";

const checks = [];
const add = (name, ok, detail = "") => checks.push({ name, ok, detail });

const read = (path) => fs.existsSync(path) ? fs.readFileSync(path, "utf8") : "";

const library = read("src/lib/templates/template-builder-merge-field-library.ts");
add("Merge-field library exists", library.length > 0);

for (const token of [
  "TemplateBuilderMergeFieldKind",
  "canonical",
  "signatureHeader",
  "customManual",
  "TemplateBuilderFieldType",
  "Text",
  "Date",
  "Amount",
  "Number",
  "TEMPLATE_BUILDER_STARTING_CATEGORIES",
  "Matter",
  "People",
  "Signature/Header",
  "General",
  "TEMPLATE_BUILDER_SUPPORTED_FORMAT_MODIFIERS",
  "upper",
  "lower",
  "title",
  "date:MM/DD/YYYY",
  "date:Month D, YYYY",
  "currency",
  "bold",
  "italic",
  "underline",
  "TEMPLATE_BUILDER_CANONICAL_MERGE_FIELDS",
  "{{matter.fileNumber}}",
  "{{matter.providerName}}",
  "{{matter.patientName}}",
  "{{matter.claimNumber}}",
  "{{matter.dateOfService}}",
  "{{matter.billedAmount}}",
  "{{signature.phoneLine}}",
  "{{signature.faxNumber}}",
  "{{signature.email}}",
  "{{signature.image}}",
  "{{signature.name}}",
  "{{signature.block}}",
  "Not marked Recommended",
  "TEMPLATE_BUILDER_CUSTOM_PLACEHOLDER_FIELDS",
  "Prompt shown during document generation",
  "templateBuilderTokenForCustomLabel",
  "templateBuilderIsCustomToken",
  "templateBuilderCustomTokenConflicts",
  "templateBuilderMoveDeletedCategoryFieldsToGeneral",
]) {
  add(`Merge-field library contains ${token}`, library.includes(token));
}

const build = read("app/admin/document-templates/build/page.tsx");
for (const token of [
  "TEMPLATE_BUILDER_CANONICAL_MERGE_FIELDS",
  "TEMPLATE_BUILDER_SUPPORTED_FORMAT_MODIFIERS",
  "Search merge fields",
  "Example matter",
  "Formats for copy",
  "toggleSort",
  "CopyIcon",
  "TrashIcon",
  "Delete Field",
]) {
  add(`Build page contains ${token}`, build.includes(token));
}
for (const removed of [
  "Phase 3 locks",
  "Category readiness",
  "Custom manual placeholder readiness",
  "Production DOCX upload, token mutation, and matter-side Generate Documents remain intentionally unwired",
]) {
  add(`Build page no longer exposes removed readiness text ${removed}`, !build.includes(removed));
}

const doc = read("docs/templates/template-builder-phase3-merge-field-library-readiness.md");
for (const token of [
  "Template Builder Phase 3",
  "does not implement production DOCX upload",
  "General is fixed",
  "Search covers category",
  "Signature/header fields show usage notes",
  "Supported modifiers",
  "{{signature.phoneLine}}",
  "{{signature.block}} is not marked Recommended",
  "Custom manual placeholders are global/reusable",
  "Tokens use {{custom...}}",
  "Duplicate custom tokens must be blocked",
  "Update token in all affected templates automatically",
  "run the normal token scan after update",
]) {
  add(`Phase 3 doc contains ${token}`, doc.includes(token));
}

const pkg = JSON.parse(read("package.json"));
add("Package has Phase 3 verifier script", pkg.scripts && pkg.scripts["verify:template-builder-phase3"] === "node scripts/verify-template-builder-phase3-readiness.mjs");

const failed = checks.filter((check) => check.ok === false);
for (const check of checks) {
  const color = check.ok ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m";
  console.log(`${color}: ${check.name}${check.detail ? " - " + check.detail : ""}`);
}
if (failed.length > 0) {
  console.error(`\n${failed.length} Template Builder Phase 3 readiness checks failed.`);
  process.exit(1);
}
console.log("\nPASS: Template Builder Phase 3 merge-field library and custom placeholder readiness verified.");
