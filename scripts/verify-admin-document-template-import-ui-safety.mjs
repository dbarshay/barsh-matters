import fs from "node:fs";

const pagePath = "app/admin/document-templates/page.tsx";
const pkgPath = "package.json";
const page = fs.readFileSync(pagePath, "utf8");
const pkg = fs.readFileSync(pkgPath, "utf8");
const failures = [];

function check(label, condition) {
  if (condition) {
    console.log(`PASS: ${label}`);
  } else {
    console.error(`FAIL: ${label}`);
    failures.push(label);
  }
}

check("admin template import preview function exists", page.includes("previewSeededTemplateImport"));
check("admin template import confirm function exists", page.includes("confirmSeededTemplateImport"));
check("admin calls import-preview route", page.includes("/api/documents/templates/import-preview"));
check("admin calls import-confirm route", page.includes("/api/documents/templates/import-confirm"));
check("admin uses seeded mode", page.includes('mode: "seeded"'));
check("admin requires confirm true", page.includes("confirm: true"));
check("admin has preview button", page.includes("Preview Seeded Import"));
check("admin has confirm button", page.includes("Confirm Seeded Import"));
check("admin warns placeholders are not final production", page.includes("Seeded definitions are placeholder/test templates only") && page.includes("not final production templates"));
check("admin displays production-ready rows", page.includes("Production-ready rows"));
check("admin displays final production rows", page.includes("Final production rows"));
check("admin displays no Clio/email/print safety", page.includes("No Clio / email / print"));
check("package script registered", pkg.includes("verify:admin-document-template-import-ui-safety"));

check("admin does not upload files to Clio", !page.includes("uploadDocumentToClio"));
check("admin does not generate documents", !page.includes("Packer.toBuffer") && !page.includes("new Document("));
check("admin does not send email", !page.includes("sendMail(") && !page.includes("graphFetchJson"));
check("admin does not write print queue", !page.includes("documentPrintQueueItem.create"));

if (failures.length) {
  console.error(`FAIL: admin document template import UI safety verifier (${failures.length} failure(s))`);
  process.exit(1);
}

console.log("PASS: admin document template import UI safety verifier");
