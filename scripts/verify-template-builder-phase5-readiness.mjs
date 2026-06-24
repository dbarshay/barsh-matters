import fs from "node:fs";

const checks = [];
const add = (name, ok, detail = "") => checks.push({ name, ok, detail });

const read = (path) => fs.existsSync(path) ? fs.readFileSync(path, "utf8") : "";

const contract = read("src/lib/templates/template-builder-template-creation-readiness.ts");
const sharedReadinessContract = read("src/lib/templates/template-builder-readiness-contract.ts");
const combinedContract = contract + "\n" + sharedReadinessContract;
add("Template creation readiness contract exists", contract.length > 0);
for (const token of [
  "TEMPLATE_BUILDER_TEMPLATE_CREATION_PERMISSION",
  "TEMPLATE_BUILDER_PERMISSION",
  "templates.manage",
  "TEMPLATE_BUILDER_TEMPLATE_CREATION_REQUIRED_FIELDS",
  "BM display name",
  "local DOCX file picker",
  "default signature mode",
  "TEMPLATE_BUILDER_DEFAULT_SIGNATURE_MODES",
  "Firm",
  "User Selects",
  "TEMPLATE_BUILDER_TEMPLATE_CREATION_DEFAULT_STATUS",
  "Inactive",
  "TEMPLATE_BUILDER_TEMPLATE_CREATION_STORAGE_PREFIX",
  "templates/inactive/",
  "TEMPLATE_BUILDER_TEMPLATE_FILENAME_UNIQUENESS_SCOPE",
  "TEMPLATE_REPOSITORY_STORAGE_PREFIXES",
  "TEMPLATE_BUILDER_TEMPLATE_CREATION_AUDIT_ACTIONS",
  "template created/seeded",
  "DOCX stored in BM cloud template repository",
  "initial token scan completed",
  "templateBuilderCreationShowsStoredPathInRoutineUi",
  "templateBuilderCreationStoresTemplatesInClio",
  "templateBuilderCreationWritesMatterSideGenerateDocuments",
  "templateBuilderCreationRequiresTokenScanBeforeSave",
  "templateBuilderCreationUpdatesLastEdited",
  "templateBuilderIsSupportedTemplateDocxFilename",
  "templateBuilderNormalizeUploadedTemplateFilename",
  "templateBuilderFilenameAvailableAcrossRepository",
  "templateBuilderCreationReadinessCheck",
  "templateBuilderCreationReadyForImplementationSummary",
]) {
  add(`Template creation/shared contract contains ${token}`, combinedContract.includes(token));
}

const doc = read("docs/templates/template-builder-phase5-template-creation-readiness.md");
for (const token of [
  "Template Builder Phase 5",
  "final readiness gate before actual template creation",
  "does not create templates",
  "BM display name",
  "local DOCX file picker",
  "default signature mode",
  "New templates default to Inactive",
  "Templates are stored only in BM cloud storage and never in Clio",
  "templates/inactive/",
  "uploaded local DOCX filename must be checked across all template folders",
  "Creation accepts DOCX only",
  "Creation must run the token scan before save",
  "Creating a template updates Last Edited and Last Edited By",
  "templates.manage",
  "Ready-for-template-creation definition",
  "Prisma DocumentTemplate and DocumentTemplateVersion creation",
]) {
  add(`Phase 5 doc contains ${token}`, doc.includes(token));
}

const landing = read("app/admin/document-templates/page.tsx");
add("Landing contains template creation readiness gate", landing.includes("Template creation readiness gate"));
add("Landing confirms no creation or upload wired", landing.includes("No template creation or upload is wired yet"));

const build = read("app/admin/document-templates/build/page.tsx");
add("Build page keeps functional merge-field table after visible readiness panels were removed", build.includes("Search merge fields") && build.includes("Merge Field") && build.includes("CopyIcon"));
add("Build page does not expose Create Template readiness panel", !build.includes("Ready for Create Template implementation"));

const view = read("app/admin/document-templates/view/page.tsx");
add("View page confirms new templates default Inactive", view.includes("New templates default Inactive"));

const pkg = JSON.parse(read("package.json"));
add("Package has Phase 5 verifier script", pkg.scripts && pkg.scripts["verify:template-builder-phase5"] === "node scripts/verify-template-builder-phase5-readiness.mjs");

const failed = checks.filter((check) => check.ok === false);
for (const check of checks) {
  const color = check.ok ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m";
  console.log(`${color}: ${check.name}${check.detail ? " - " + check.detail : ""}`);
}
if (failed.length > 0) {
  console.error(`\n${failed.length} Template Builder Phase 5 readiness checks failed.`);
  process.exit(1);
}
console.log("\nPASS: Template Builder Phase 5 template creation readiness gate verified.");
