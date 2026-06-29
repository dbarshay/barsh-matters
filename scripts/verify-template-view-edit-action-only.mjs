import fs from "node:fs";

const view = fs.readFileSync("app/admin/document-templates/view/page.tsx", "utf8");
const detail = fs.readFileSync("app/admin/document-templates/[key]/page.tsx", "utf8");
const route = fs.readFileSync("app/api/documents/templates/edit-working-docx/route.ts", "utf8");
const failures = [];
const must = (condition, message) => { if (!condition) failures.push(message); };

must(view.includes("Edit Template"), "View Templates row must expose Edit Template action");
must(view.includes('/admin/document-templates/" + encodeURIComponent(template.key)'), "Edit Template action must route to template detail page");
must(!view.includes(">View</a>"), "View label should not remain as row action");
must(!view.includes("Download DOCX"), "View Templates row-level Download DOCX action should be removed");
must(view.includes("Stored DOCX"), "Stored DOCX status column should remain");
must(view.includes("template.currentVersion?.hasStoredDocx"), "Stored DOCX yes/no status should remain");

must(detail.includes('data-barsh-admin-document-template-edit-template-workflow="true"'), "detail page must keep Edit Template workflow");
must(detail.includes('data-barsh-admin-document-template-edit-template-button="true"'), "detail page must keep Edit Template button");
must(detail.includes('data-barsh-admin-document-template-save-edited-template-button="true"'), "detail page must keep Save Edited Template button");
must(route.includes("uploadWorkingDocxToGraph"), "Edit Template route must launch editable Graph DOCX");
must(route.includes("downloadWorkingDocxFromGraph"), "Edit Template route must save edited Graph DOCX back");
must(route.includes("tx.documentTemplateVersion.create"), "Edit Template save must create new version");
must(route.includes("currentVersionId: version.id"), "Edit Template save must make edited version current");

if (failures.length) {
  console.error("FAILURES=" + failures.length);
  for (const failure of failures) console.error("FAIL=" + failure);
  process.exit(1);
}
console.log("PASS: View Templates exposes Edit Template action and removes row-level Download DOCX");
