const fs = require("fs");
const path = require("path");
let failed = false;
const pass = (m) => console.log("PASS: " + m);
const fail = (m) => { failed = true; console.error("FAIL: " + m); };
const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const exists = (p) => fs.existsSync(path.join(root, p));
function contains(label, text, token) { text.includes(token) ? pass(label) : fail(label + " missing token: " + token); }
function notContains(label, text, token) { !text.includes(token) ? pass(label) : fail(label + " contains forbidden token: " + token); }

const docPath = "docs/clio-storage-refactor/phase42b-controlled-live-direct-finalized-pdf-upload.md";
const smokePath = "scripts/smoke-phase42b-controlled-live-direct-finalized-pdf-upload.cjs";
for (const f of [docPath, smokePath, "app/api/documents/finalize/route.ts", "app/api/documents/working-docx/route.ts", "app/api/documents/direct-finalize-preview/route.ts", "package.json"]) {
  exists(f) ? pass("required Phase 42B file exists: " + f) : fail("missing required Phase 42B file: " + f);
}
const doc = read(docPath);
const smoke = read(smokePath);
const finalize = read("app/api/documents/finalize/route.ts");
const pkg = JSON.parse(read("package.json"));

for (const token of ["Phase 42B", "controlled live direct", "BRL_202600001", "1881278195", "22062401000", "uploads exactly one finalized PDF", "parent type `Folder`", "fullyUploaded: true"]) {
  contains("doc contains " + token, doc, token);
}
for (const token of ["confirmCreate: true", "confirmUpload: true", "singleMasterDryRun: false", "singleMasterResolveFolders: true", 'CLIO_SINGLE_MASTER_UPLOAD_REWIRE_ENABLED: "1"', 'CLIO_SINGLE_MASTER_CREATE_FOLDERS_ENABLED: "1"', 'CLIO_SINGLE_MASTER_LIVE_WRITE_ENABLED: "1"', "workingDocumentDriveItemId: working.driveItemId", "uploaded.length === 1", "EXPECTED_FOLDER_ID = 22062401000", "finalization audit metadata recorded", "finalize is not dry-run because at least one document was uploaded"]) {
  contains("smoke contains " + token, smoke, token);
}
for (const token of ["WORKING_DOCUMENT_DRIVE_ITEM_ID_REDACTED", "FINALIZE_JSON_REDACTED", "sourceDriveItemId", "clioDocumentVersionUuid", "redact("]) {
  contains("smoke redacts sensitive output " + token, smoke, token);
}
for (const forbidden of ["allowDuplicateUploads: true", "masterLawsuitId:"]) {
  notContains("smoke avoids unsafe direct live upload token", smoke, forbidden);
}
for (const token of ["useDirectFinalizePreview", "uploadBufferToClioMatterDocuments(", 'parentType: uploadRewiredToSingleMasterFolder ? "Folder" : "Matter"', "recordDocumentFinalizationAttempt"]) {
  contains("finalize route keeps live upload anchor " + token, finalize, token);
}
contains("package Phase 42B smoke registered", JSON.stringify(pkg.scripts || {}), "smoke:phase42b-controlled-live-direct-finalized-pdf-upload");
contains("package Phase 42B verifier registered", JSON.stringify(pkg.scripts || {}), "verify:phase42b-controlled-live-direct-finalized-pdf-upload-safety");
console.log("CONTRACT: Phase 42B is the controlled single live direct finalized PDF upload.");
console.log("RESULT: Phase 42B controlled live direct finalized PDF upload safety verifier");
if (failed) process.exit(1);
