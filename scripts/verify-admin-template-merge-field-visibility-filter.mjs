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

check("visibility filter state exists", page.includes("mergeFieldVisibilityFilter"));
check("filter includes all", page.includes('"all"') && page.includes("All"));
check("filter includes visible UI", page.includes('"visible_ui"') && page.includes("Visible UI"));
check("filter includes hidden internal", page.includes('"hidden_internal"') && page.includes("Hidden/internal"));
check("filter includes computed", page.includes('"computed"') && page.includes("Computed"));
check("filter includes system", page.includes('"system"') && page.includes("System"));
check("filter buttons update state", page.includes("setMergeFieldVisibilityFilter(value)"));
check("displayed merge fields are filtered", page.includes("const displayedMergeFields") && page.includes("mergeFields.filter((field) => mergeFieldVisibility(field) === mergeFieldVisibilityFilter)"));
check("empty filtered state exists", page.includes("No merge fields match the selected visibility filter."));
check("summary shows displayed count", page.includes("Showing: {displayedMergeFields.length}"));
check("package script registered", pkg.includes("verify:admin-template-merge-field-visibility-filter"));

check("filter does not upload files", !page.includes("uploadDocumentToClio") && !page.includes("FormData") && !page.includes("readAsArrayBuffer"));
check("filter does not generate documents", !page.includes("Packer.toBuffer") && !page.includes("new Document("));
check("filter does not send email", !page.includes("sendMail(") && !page.includes("graphFetchJson"));
check("filter does not write print queue", !page.includes("documentPrintQueueItem.create"));

if (failures.length) {
  console.error(`FAIL: admin template merge field visibility filter verifier (${failures.length} failure(s))`);
  process.exit(1);
}

console.log("PASS: admin template merge field visibility filter verifier");
