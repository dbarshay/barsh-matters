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

check("file placeholder state exists", page.includes("templateFilePlaceholder"));
check("file placeholder error state exists", page.includes("templateFilePlaceholderError"));
check("file placeholder UI exists", page.includes("Template File Placeholder"));
check("file input exists", page.includes('type="file"'));
check("file input accepts docx", page.includes(".docx") && page.includes("application/vnd.openxmlformats-officedocument.wordprocessingml.document"));
check("file handler exists", page.includes("handleTemplateFilePlaceholderChange"));
check("file placeholder applies to custom JSON", page.includes("applyTemplateFilePlaceholderToCustomJson"));
check("metadata marks uploaded production template", page.includes('templateSource: "uploaded-production-template"'));
check("metadata marks upload placeholder", page.includes('storageKind: "upload-placeholder"'));
check("metadata marks actualFileStored false", page.includes("actualFileStored: false"));
check("metadata marks production false by default", page.includes("productionTemplateReady: false") && page.includes("finalProductionDocument: false"));
check("UI copy says no upload or storage", page.includes("does not upload, store, parse, or generate from the file yet"));
check("package script registered", pkg.includes("verify:admin-template-file-placeholder-ui-safety"));

check("does not read file contents", !page.includes("readAsArrayBuffer") && !page.includes("readAsText"));
check("does not upload file", !page.includes("FormData") && !page.includes("uploadDocumentToClio"));
check("does not parse docx", !page.includes("mammoth") && !page.includes("Packer.toBuffer"));
check("does not generate documents", !page.includes("new Document("));
check("does not send email", !page.includes("sendMail(") && !page.includes("graphFetchJson"));
check("does not write print queue", !page.includes("documentPrintQueueItem.create"));

if (failures.length) {
  console.error(`FAIL: admin template file placeholder UI safety verifier (${failures.length} failure(s))`);
  process.exit(1);
}

console.log("PASS: admin template file placeholder UI safety verifier");
