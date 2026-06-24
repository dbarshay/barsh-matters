import fs from "node:fs";

const checks = [];
const add = (name, ok, detail = "") => checks.push({ name, ok, detail });

const read = (path) => fs.existsSync(path) ? fs.readFileSync(path, "utf8") : "";

const schema = read("prisma/schema.prisma");
for (const model of ["DocumentTemplate", "DocumentTemplateVersion", "DocumentTemplateMergeField"]) {
  add(`Prisma model ${model}`, schema.includes(`model ${model}`));
}

const doc = read("docs/templates/template-builder-phase1-admin-ui-cloud-readiness.md");
for (const token of [
  "Template Builder Phase 1",
  "templates.manage",
  "templates/active/",
  "templates/inactive/",
  "templates/archived/",
  "templates/deleted/",
  "Templates must never be stored in Clio",
  "All includes Active, Inactive, and Archived",
  "All excludes Deleted",
  "General is fixed"
]) {
  add(`Readiness doc contains ${token}`, doc.includes(token));
}

const landing = read("app/admin/document-templates/page.tsx");
add("Document Templates landing exists", landing.includes("Build Template") && landing.includes("View Templates"));
add("Landing states BM cloud only and not Clio", landing.includes("BM cloud storage only, never in Clio"));
add("Landing references templates.manage", landing.includes("templates.manage"));

const build = read("app/admin/document-templates/build/page.tsx");
const mergeLibrary = read("src/lib/templates/template-builder-merge-field-library.ts");
for (const token of ["Search merge fields", "Category", "Field Label", "Merge Field", "Example Output", "Copy", "Matter"]) {
  add(`Build Template page contains ${token}`, build.includes(token));
}
for (const token of ["People", "Signature/Header", "General", "{{signature.phoneLine}}", "{{signature.block}}", "templateBuilderTokenForCustomLabel", "{{custom"]) {
  add(`Build Template shared library contains ${token}`, mergeLibrary.includes(token));
}

const view = read("app/admin/document-templates/view/page.tsx");
for (const token of ["Name", "Status", "Last Edited", "Last Edited By", "Default Signature", "Actions", "All", "Active", "Inactive", "Archived", "Deleted", "Make Active", "Restore"]) {
  add(`View Templates page contains ${token}`, view.includes(token));
}
add("View Templates All filter excludes Deleted", view.includes(`row.status !== "Deleted"`));
add("View Templates Deleted has Restore only", view.includes(`if (status === "Deleted") return ["Restore"]`));

const failed = checks.filter((check) => check.ok === false);
for (const check of checks) {
  const color = check.ok ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m";
  console.log(`${color}: ${check.name}${check.detail ? " - " + check.detail : ""}`);
}
if (failed.length > 0) {
  console.error(`\n${failed.length} Template Builder Phase 1 readiness checks failed.`);
  process.exit(1);
}
console.log("\nPASS: Template Builder Phase 1 admin UI and cloud repository readiness verified.");
