const fs = require("fs");
const path = require("path");

let failed = false;
const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const exists = (p) => fs.existsSync(path.join(root, p));
const pass = (m) => console.log("PASS: " + m);
const fail = (m) => { failed = true; console.error("FAIL: " + m); };
const contains = (label, text, token) => text.includes(token) ? pass(label) : fail(`${label} missing token: ${token}`);
const notContains = (label, text, token) => !text.includes(token) ? pass(label) : fail(`${label} contains forbidden token: ${token}`);

const docPath = "docs/template-generation-refactor/phase47a-production-template-creation-plan.md";
const pkgPath = "package.json";

for (const p of [docPath, pkgPath, "app/api/documents/templates/route.ts", "app/api/documents/working-docx/route.ts"]) {
  exists(p) ? pass(`required file exists: ${p}`) : fail(`missing required file: ${p}`);
}

const doc = exists(docPath) ? read(docPath) : "";
const pkg = exists(pkgPath) ? JSON.parse(read(pkgPath)) : { scripts: {} };
const templatesRoute = exists("app/api/documents/templates/route.ts") ? read("app/api/documents/templates/route.ts") : "";
const workingDocx = exists("app/api/documents/working-docx/route.ts") ? read("app/api/documents/working-docx/route.ts") : "";

for (const token of [
  "Planning/decision checkpoint only",
  "DocumentTemplate",
  "DocumentTemplateVersion",
  "DocumentTemplateMergeField",
  "Category: `lawsuit`",
  "Category: `direct_matter`",
  "Category: `settlement`",
  "Category: `payment`",
  "Category: `general`",
  "Template keys should be stable, lowercase, hyphenated, and workflow-prefixed",
  "{{camelCaseFieldName}}",
  "Required decisions before Phase 47B",
  "First production template to build",
  "Whether `general` templates should ever appear",
  "Phase 47B should be a decision implementation phase",
]) {
  contains(`plan contains ${token}`, doc, token);
}

contains("templates route hides fallback by default", templatesRoute, "codeRegistryFallbackHiddenByDefault: true");
contains("templates route requires fallback opt-in", templatesRoute, "codeRegistryFallbackRequiresExplicitOptIn: true");
contains("working-docx hard-fails unavailable requested key", workingDocx, "Requested document key is not available for this matter/template context.");

if (pkg.scripts && pkg.scripts["verify:phase47a-production-template-creation-plan-safety"] === "node scripts/verify-phase47a-production-template-creation-plan-safety.cjs") {
  pass("package Phase 47A verifier script registered");
} else {
  fail("package Phase 47A verifier script missing");
}

for (const token of [
  "documentTemplate.create(",
  "documentTemplate.update(",
  "documentTemplate.delete",
  "documentTemplateVersion.create(",
  "documentTemplateMergeField.create",
  "confirmUpload: true",
  "CONFIRM_LIVE_TERMINAL_FINALIZE=YES",
  "uploadBufferToClioMatterDocuments(",
  "documentPrintQueueItem.create(",
  "sendMail"
]) {
  notContains(`plan no side-effect marker ${token}`, doc, token);
}

if (failed) {
  console.error("FAIL: Phase 47A production template creation plan safety verifier failed");
  process.exit(1);
}

console.log("PASS: Phase 47A production template creation plan safety verifier passed");
