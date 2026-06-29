import fs from "node:fs";

const page = fs.readFileSync("app/admin/document-templates/[key]/page.tsx", "utf8");
const route = fs.readFileSync("app/api/documents/templates/text-edit-version/route.ts", "utf8");
const failures = [];
const must = (condition, message) => { if (!condition) failures.push(message); };

must(page.includes('data-barsh-admin-document-template-text-editor="true"'), "missing Template Text Editor panel");
must(page.includes('data-barsh-admin-document-template-load-text-button="true"'), "missing load template text button");
must(page.includes('data-barsh-admin-document-template-text-editor-current-text="true"'), "missing current text viewer");
must(page.includes('data-barsh-admin-document-template-text-editor-find="true"'), "missing find text editor");
must(page.includes('data-barsh-admin-document-template-text-editor-replace="true"'), "missing replace text editor");
must(page.includes('data-barsh-admin-document-template-preview-text-edit-button="true"'), "missing Preview Text Edit button");
must(page.includes('data-barsh-admin-document-template-confirm-text-edit-button="true"'), "missing Confirm Text Edit Version button");
must(page.includes("loadTemplateTextEditor"), "missing loadTemplateTextEditor function");
must(page.includes("previewTemplateTextEdit"), "missing previewTemplateTextEdit function");
must(page.includes("confirmTemplateTextEdit"), "missing confirmTemplateTextEdit function");
must(page.includes('/api/documents/templates/text-edit-version'), "page does not call text edit route");
must(page.includes("creates a new DocumentTemplateVersion"), "page must explain new version behavior");
must(page.includes("preserves prior versions"), "page must explain prior version preservation");
must(page.includes("does not generate documents, upload to Clio, send email, create drafts, print, or queue documents"), "page missing side-effect safety language");

must(route.includes('action: "document-template-text-edit-version"'), "route missing action marker");
must(route.includes("JSZip.loadAsync"), "route must read DOCX zip");
must(route.includes("docxTextPartName"), "route must limit editable DOCX parts");
must(route.includes("replaceTextAcrossTextNodes"), "route must replace across DOCX text nodes");
must(route.includes("renderTextWithBreaks"), "route must preserve user line breaks as DOCX breaks");
must(route.includes("tx.documentTemplateVersion.create"), "route must create new version");
must(route.includes("currentVersionId: version.id"), "route must update currentVersionId");
must(route.includes("preservesPriorVersions: true"), "route safety must preserve prior versions");
must(route.includes("clioWrites: false"), "route safety must block Clio writes");
must(route.includes("graphWrites: false"), "route safety must block Graph writes");
must(route.includes("emailsSent: false"), "route safety must block emails");
must(route.includes("printQueued: false"), "route safety must block print queue");
must(route.includes("documentsGenerated: false"), "route safety must block generation side effects");

if (failures.length) {
  console.error("FAILURES=" + failures.length);
  for (const failure of failures) console.error("FAIL=" + failure);
  process.exit(1);
}

console.log("PASS: template text editor UI and route are wired safely");
