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

const route = read("app/api/documents/templates/replace-version/route.ts");
const detailPage = read("app/admin/document-templates/[key]/page.tsx");
const pkg = JSON.parse(read("package.json"));

assert(route.includes("document-template-replace-version"), "replacement route identifies document-template-replace-version action");
assert(route.includes("multipart/form-data"), "replacement route can parse multipart upload payloads");
assert(route.includes("contentBase64"), "replacement route stores DOCX base64 content");
assert(route.includes("DocumentTemplateVersion"), "replacement route creates DocumentTemplateVersion records");
assert(route.includes("documentTemplateVersion.create"), "replacement route creates a new version");
assert(route.includes("currentVersionId: version.id"), "replacement route updates currentVersionId to new version");
assert(route.includes("preservesPriorVersions: true"), "replacement route safety states prior versions are preserved");
assert(route.includes("clioWrites: false"), "replacement route safety blocks Clio writes");
assert(route.includes("graphWrites: false"), "replacement route safety blocks Graph writes");
assert(route.includes("emailsSent: false"), "replacement route safety blocks emails");
assert(route.includes("printQueued: false"), "replacement route safety blocks print queue");
assert(route.includes("maxWait: 10000"), "replacement route transaction uses maxWait safety option");
assert(route.includes("timeout: 30000"), "replacement route transaction uses timeout safety option");

assert(detailPage.includes('data-barsh-template-replacement-workflow="true"'), "template detail page exposes replacement workflow marker");
assert(detailPage.includes("Preview Replacement"), "template detail page has Preview Replacement button");
assert(detailPage.includes("Confirm Replacement Version"), "template detail page has Confirm Replacement Version button");
assert(detailPage.includes("/api/documents/templates/replace-version"), "template detail page calls replacement route");
assert(detailPage.includes("Prior versions will be preserved"), "template detail page warns that prior versions are preserved");
assert(detailPage.includes("DocumentTemplateVersion"), "template detail page explains new DocumentTemplateVersion behavior");

assert(pkg.scripts?.["verify:document-template-replacement-versioning-safety"], "package has replacement versioning verifier script");

if (process.exitCode) {
  console.error("Document template replacement versioning safety verification failed.");
  process.exit(process.exitCode);
}

console.log("Document template replacement versioning safety verification passed.");
