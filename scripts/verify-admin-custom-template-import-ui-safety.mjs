import fs from "node:fs";

const page = fs.readFileSync("app/admin/document-templates/page.tsx", "utf8");
const pkg = fs.readFileSync("package.json", "utf8");
const failures = [];

function check(label, condition) {
  if (condition) {
    console.log(`PASS: ${label}`);
  } else {
    console.error(`FAIL: ${label}`);
    failures.push(label);
  }
}

check("custom template rows state exists", page.includes("customTemplateRowsText"));
check("custom preview function exists", page.includes("previewCustomTemplateRowsImport"));
check("custom confirm function exists", page.includes("confirmCustomTemplateRowsImport"));
check("custom parser requires JSON array", page.includes("Template import JSON must be an array"));
check("custom import panel exists", page.includes("Custom Template Row Import"));
check("custom preview button exists", page.includes("Preview Custom Import"));
check("custom confirm button exists", page.includes("Confirm Custom Import"));
check("custom import calls preview route", page.includes("/api/documents/templates/import-preview"));
check("custom import calls confirm route", page.includes("/api/documents/templates/import-confirm"));
check("custom import uses rows mode", page.includes('mode: "rows"'));
check("custom confirm requires confirm true", page.includes("confirm: true"));
check("custom import mentions hidden/internal fields", page.includes("hidden/internal"));
check("custom preview displays hidden/internal count", page.includes("customTemplatePreview.summary?.hiddenInternalMergeFields"));
check("custom preview displays visible UI count", page.includes("customTemplatePreview.summary?.visibleMergeFields"));
check("custom import displays no Clio/email/print safety", page.includes("customTemplateConfirmResult.safety?.clioRecordsChanged"));
check("example includes hidden internal field", page.includes('"visibility": "hidden_internal"'));
check("package script registered", pkg.includes("verify:admin-custom-template-import-ui-safety"));

check("custom UI does not upload files", !page.includes("uploadDocumentToClio") && !page.includes("FormData") && !page.includes("readAsArrayBuffer"));
check("custom UI does not generate documents", !page.includes("Packer.toBuffer") && !page.includes("new Document("));
check("custom UI does not send email", !page.includes("sendMail(") && !page.includes("graphFetchJson"));
check("custom UI does not write print queue", !page.includes("documentPrintQueueItem.create"));

if (failures.length) {
  console.error(`FAIL: admin custom template import UI safety verifier (${failures.length} failure(s))`);
  process.exit(1);
}

console.log("PASS: admin custom template import UI safety verifier");
