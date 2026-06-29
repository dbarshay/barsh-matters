import fs from "node:fs";

const page = fs.readFileSync("app/admin/document-templates/[key]/page.tsx", "utf8");
const failures = [];
const must = (condition, message) => { if (!condition) failures.push(message); };

must(page.includes('data-barsh-admin-document-template-settings-actions="true"'), "missing normal settings action row");
must(page.includes('data-barsh-admin-document-template-save-settings-button="true"'), "missing save settings button anchor");
must(page.includes('gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end"'), "settings actions must be full-width right-aligned row");
must(page.includes('minHeight: 40'), "save settings button must have normal minimum height");
must(page.includes('data-barsh-admin-document-template-edit-template-workflow="true"'), "missing Edit Template workflow panel");
must(page.includes('data-barsh-admin-document-template-edit-template-button="true"'), "missing Edit Template button");
must(page.includes('data-barsh-admin-document-template-save-edited-template-button="true"'), "missing Save Edited Template button");
must(page.includes('style={{ gridColumn: "1 / -1", width: "100%", marginTop: 10'), "Edit Template panel must be full-width below settings actions");
must(!page.includes('>Template Text Editor<'), "Template Text Editor should not be visible");
must(!page.includes('>Replace DOCX / Upload New Version<'), "Replace DOCX panel should not be visible");

if (failures.length) {
  console.error("FAILURES=" + failures.length);
  for (const failure of failures) console.error("FAIL=" + failure);
  process.exit(1);
}
console.log("PASS: template detail settings/edit-template layout is clean");
