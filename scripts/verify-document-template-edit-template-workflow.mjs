import fs from "node:fs";

const page = fs.readFileSync("app/admin/document-templates/[key]/page.tsx", "utf8");
const route = fs.readFileSync("app/api/documents/templates/edit-working-docx/route.ts", "utf8");
const helper = fs.readFileSync("lib/documents/graphWorkingDocuments.ts", "utf8");
const failures = [];
const must = (condition, message) => { if (!condition) failures.push(message); };

must(page.includes('data-barsh-admin-document-template-edit-template-workflow="true"'), "missing Edit Template workflow panel");
must(page.includes('data-barsh-admin-document-template-edit-template-button="true"'), "missing Edit Template button");
must(page.includes('data-barsh-admin-document-template-save-edited-template-button="true"'), "missing Save Edited Template button");
must(page.includes("async function launchEditTemplate()"), "missing launchEditTemplate function");
must(page.includes("async function saveEditedTemplate()"), "missing saveEditedTemplate function");
must(page.includes('fetch("/api/documents/templates/edit-working-docx"'), "page does not call edit-working-docx route");
must(page.includes('mode: "launch"'), "page missing launch mode");
must(page.includes('mode: "save"'), "page missing save mode");
must(page.includes("window.open(openUrl"), "Edit Template should open Word/Graph URL");
must(page.includes("json?.workingDocument?.webUrl || json?.workingDocument?.desktopWordFileUrl || json?.workingDocument?.msWordEditUrl"), "Edit Template should prefer Graph webUrl over desktop Word deep link");
must(page.includes("Editable DOCX launched in Word Online"), "Edit Template message should explain Word Online launch");
must(page.includes("bmConfirm("), "Save Edited Template should confirm before repository write");
must(page.includes("Prior versions are preserved"), "page must explain prior version preservation");

must(route.includes('action: "document-template-edit-working-docx"'), "route missing action marker");
must(route.includes("uploadWorkingDocxToGraph"), "route must upload current repo DOCX to Graph");
must(route.includes("downloadWorkingDocxFromGraph"), "route must download edited DOCX from Graph");
must(route.includes("mode === \"launch\""), "route missing launch mode");
must(route.includes("mode === \"save\""), "route missing save mode");
must(route.includes("tx.documentTemplateVersion.create"), "save mode must create new DocumentTemplateVersion");
must(route.includes("currentVersionId: version.id"), "save mode must update currentVersionId");
must(route.includes("preservesPriorVersions: true"), "route safety must preserve prior versions");
must(route.includes("clioWrites: false"), "route safety must block Clio writes");
must(route.includes("emailsSent: false"), "route safety must block emails");
must(route.includes("printQueued: false"), "route safety must block print queue");
must(route.includes("documentsGenerated: false"), "route safety must block generation side effects");
must(helper.includes("msWordEditUrl"), "Graph helper must provide msWordEditUrl");
must(helper.includes("downloadWorkingDocxFromGraph"), "Graph helper must provide DOCX download");

if (failures.length) {
  console.error("FAILURES=" + failures.length);
  for (const failure of failures) console.error("FAIL=" + failure);
  process.exit(1);
}
console.log("PASS: document template Edit Template launch/save-back workflow is wired safely");
