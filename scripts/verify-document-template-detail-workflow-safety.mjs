import fs from "fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS: ${message}`);
  }
}

const detailRoute = read("app/api/documents/templates/detail/route.ts");
const storedDocxRoute = read("app/api/documents/templates/stored-docx/route.ts");
const detailPage = read("app/admin/document-templates/[key]/page.tsx");
const adminPage = read("app/admin/document-templates/page.tsx");

assert(detailRoute.includes("document-template-detail-preview"), "template detail API identifies read-only preview action");
assert(detailRoute.includes("database-first-detail-read-only"), "template detail API is database-first read-only");
assert(detailRoute.includes("templateRepositoryWrites: false"), "template detail API safety blocks template writes");
assert(detailRoute.includes("clioWrites: false"), "template detail API safety blocks Clio writes");
assert(detailRoute.includes("graphWrites: false"), "template detail API safety blocks Graph writes");
assert(detailRoute.includes("versioning"), "template detail API exposes planned versioning workflow");
assert(detailRoute.includes("mergeFields"), "template detail API exposes merge-field detail");

assert(storedDocxRoute.includes("document-template-stored-docx-download"), "stored DOCX route identifies download action");
assert(storedDocxRoute.includes("db-docx-base64"), "stored DOCX route only serves DB base64 DOCX versions");
assert(storedDocxRoute.includes("application/vnd.openxmlformats-officedocument.wordprocessingml.document"), "stored DOCX route serves DOCX content type");
assert(storedDocxRoute.includes("Cache-Control"), "stored DOCX route disables caching");

assert(detailPage.includes("data-barsh-admin-document-template-detail"), "admin template detail page has stable verifier marker");
assert(detailPage.includes("Version History"), "admin template detail page shows version history");
assert(detailPage.includes("Merge Fields"), "admin template detail page shows merge fields");
assert(detailPage.includes("Download Stored DOCX"), "admin template detail page links stored DOCX downloads");

assert(adminPage.includes("Open Template Detail"), "admin template list links to detail page");
assert(!adminPage.includes('"example-production-template"'), "admin template sample no longer uses old example-production-template key");

if (process.exitCode) {
  console.error("Document template detail workflow safety verification failed.");
  process.exit(process.exitCode);
}

console.log("Document template detail workflow safety verification passed.");
