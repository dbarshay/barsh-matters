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

check("merge field visibility helper exists", page.includes("function mergeFieldVisibility("));
check("merge field visibility counts helper exists", page.includes("function mergeFieldVisibilityCounts"));
check("counts visible ui", page.includes("visible_ui"));
check("counts hidden internal", page.includes("hidden_internal"));
check("counts computed", page.includes("computed"));
check("counts system", page.includes("system"));
check("admin displays Visible UI count", page.includes("Visible UI:"));
check("admin displays Hidden/internal count", page.includes("Hidden/internal:"));
check("admin displays Computed count", page.includes("Computed:"));
check("admin displays System count", page.includes("System:"));
check("admin displays per-field visibility label", page.includes("display(mergeFieldVisibility(field))"));
check("package script registered", pkg.includes("verify:admin-template-merge-field-visibility-display"));

check("admin display does not upload files", !page.includes("uploadDocumentToClio") && !page.includes("FormData") && !page.includes("readAsArrayBuffer"));
check("admin display does not generate documents", !page.includes("Packer.toBuffer") && !page.includes("new Document("));
check("admin display does not send email", !page.includes("sendMail(") && !page.includes("graphFetchJson"));
check("admin display does not write print queue", !page.includes("documentPrintQueueItem.create"));

if (failures.length) {
  console.error(`FAIL: admin template merge field visibility display verifier (${failures.length} failure(s))`);
  process.exit(1);
}

console.log("PASS: admin template merge field visibility display verifier");
