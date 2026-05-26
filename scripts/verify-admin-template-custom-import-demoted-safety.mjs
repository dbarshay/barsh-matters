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

const page = read("app/admin/document-templates/page.tsx");
const detailPage = read("app/admin/document-templates/[key]/page.tsx");
const pkg = JSON.parse(read("package.json"));

assert(page.includes("advancedCustomImportOpen"), "admin page has advanced custom import open state");
assert(page.includes('data-barsh-advanced-custom-template-import="true"'), "admin page marks advanced custom import section");
assert(page.includes('data-barsh-advanced-custom-template-import-panel="true"'), "admin page wraps legacy import controls in advanced panel");
assert(page.includes("Show Advanced Import"), "admin page hides advanced import by default behind Show Advanced Import");
assert(page.includes("Hide Advanced Import"), "admin page can hide advanced import again");
assert(page.includes("Advanced / Debug Template Row Import"), "admin page labels custom import as advanced/debug");
assert(page.includes("legacy JSON/base64 import tool is retained for diagnostics"), "admin page warns custom import is legacy diagnostic path");
assert(page.includes("Open Template Detail"), "admin page directs users to template detail");
assert(page.includes("Replace Current DOCX Template"), "admin page directs users to replacement workflow");
assert(page.includes("avoids moving large base64 DOCX payloads through the JSON textbox"), "admin page warns against large base64 JSON textbox path");

assert(page.includes("Preview Custom Import"), "advanced panel preserves Preview Custom Import");
assert(page.includes("Confirm Custom Import"), "advanced panel preserves Confirm Custom Import");
assert(page.includes("rowsForPreviewOnly"), "advanced import still omits base64 from preview");
assert(page.includes("clientConfirmDiagnostics"), "advanced import still reports confirm diagnostics");

assert(detailPage.includes('data-barsh-template-replacement-workflow="true"'), "template detail replacement workflow still exists");
assert(detailPage.includes("Preview Replacement"), "template detail still has Preview Replacement");
assert(detailPage.includes("Confirm Replacement Version"), "template detail still has Confirm Replacement Version");

assert(pkg.scripts?.["verify:admin-template-custom-import-demoted-safety"], "package has custom import demotion verifier script");

if (process.exitCode) {
  console.error("Admin template custom import demotion safety verification failed.");
  process.exit(process.exitCode);
}

console.log("Admin template custom import demotion safety verification passed.");
