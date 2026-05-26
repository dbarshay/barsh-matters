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

const finalizePreview = read("app/api/documents/finalize-preview/route.ts");
const workingDocx = read("app/api/documents/working-docx/route.ts");
const finalize = read("app/api/documents/finalize/route.ts");
const storedDocx = read("app/api/documents/templates/stored-docx/route.ts");
const pkg = JSON.parse(read("package.json"));

assert(finalizePreview.includes("buildStoredDbDocxTemplateDocuments"), "finalize-preview builds stored DB DOCX planned documents");
assert(finalizePreview.includes('sourceEndpoint: `/api/documents/templates/stored-docx?versionId=${encodeURIComponent(currentVersion.id)}`'), "finalize-preview uses stored-docx route as sourceEndpoint");
assert(finalizePreview.includes('repositorySource: "barsh-matters-db"'), "finalize-preview marks stored DB repository source");
assert(finalizePreview.includes('repositoryStatus: "stored-db-docx-template"'), "finalize-preview marks stored DB repository status");
assert(finalizePreview.includes("storedTemplateVersionId: currentVersion.id"), "finalize-preview exposes stored template version id");
assert(finalizePreview.includes("storedTemplateVersionNumber: currentVersion.versionNumber"), "finalize-preview exposes stored template version number");
assert(finalizePreview.includes("...storedDbTemplateDocuments,") && finalizePreview.includes("...placeholderDocuments"), "finalize-preview places stored DB templates before placeholder documents");

assert(storedDocx.includes("documentTemplateVersion.findUnique"), "stored-docx route reads DocumentTemplateVersion by versionId");
assert(storedDocx.includes('version.storageKind !== "db-docx-base64"'), "stored-docx route rejects non DB-DOCX versions");
assert(storedDocx.includes("Buffer.from(version.contentText, \"base64\")"), "stored-docx route decodes stored base64 DOCX");

assert(workingDocx.includes("generateDocumentBuffer(req, selectedDocument)"), "working-docx uses selectedDocument sourceEndpoint to obtain DOCX buffer");
assert(workingDocx.includes("sourceTemplateContract"), "working-docx response exposes sourceTemplateContract");
assert(workingDocx.includes("generatedFromStoredDbDocx"), "working-docx selectedDocument reports stored DB DOCX source");
assert(workingDocx.includes("storedDbDocxSourcePreserved"), "working-docx safety reports stored DB DOCX source preservation");

assert(finalize.includes("sourceTemplateContract"), "finalize uploaded records expose sourceTemplateContract");
assert(finalize.includes("usesStoredDbDocx"), "finalize uploaded records report stored DB DOCX usage");
assert(finalize.includes("storedTemplateVersionId"), "finalize uploaded records preserve stored template version id");
assert(finalize.includes("storedTemplateVersionNumber"), "finalize uploaded records preserve stored template version number");

assert(pkg.scripts?.["verify:stored-db-docx-generation-path-safety"], "package has stored DB DOCX generation path verifier script");

if (process.exitCode) {
  console.error("Stored DB DOCX generation path safety verification failed.");
  process.exit(process.exitCode);
}

console.log("Stored DB DOCX generation path safety verification passed.");
