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

const docPath = "docs/clio-storage-refactor/phase42d-production-deployment-no-upload-readiness.md";
const smokePath = "scripts/smoke-phase42d-production-deployment-no-upload-readiness.cjs";
for (const f of [docPath, smokePath, "app/api/documents/finalize/route.ts", "app/api/documents/direct-finalize-preview/route.ts", "package.json"]) {
  exists(f) ? pass("required Phase 42D file exists: " + f) : fail("missing required Phase 42D file: " + f);
}
const doc = read(docPath);
const smoke = read(smokePath);
const finalize = read("app/api/documents/finalize/route.ts");
const pkg = JSON.parse(read("package.json"));

for (const token of ["Phase 42D", "production deployment", "no-upload", "BRL_202600001", "22062401000", "22070801495", "104", "does not upload another finalized document"]) {
  contains("doc contains " + token, doc, token);
}
for (const token of ["PRODUCTION_URL", "production direct preview returns 200", "single-master-direct-individual-storage", "confirmUpload: false", "singleMasterDryRun: true", "singleMasterResolveFolders: true", "local dry-run noUploadPerformed true", "PHASE42B_LOCKED_CLIO_DOCUMENT_ID", "PHASE42B_LOCKED_FINALIZATION_ID", "PHASE42B_LOCKED_FOLDER_ID"]) {
  contains("smoke contains " + token, smoke, token);
}
for (const forbidden of ["confirmUpload: true", "workingDocumentDriveItemId:", "PrismaClient", "uploadBufferToClioMatterDocuments({"]) {
  notContains("Phase 42D smoke avoids upload/DB-client token", smoke, forbidden);
}
for (const token of ["useDirectFinalizePreview", "singleMasterDryRun", "noUploadPerformed: true"]) {
  contains("finalize route retains no-upload dry-run anchor " + token, finalize, token);
}
contains("package Phase 42D smoke registered", JSON.stringify(pkg.scripts || {}), "smoke:phase42d-production-deployment-no-upload-readiness");
contains("package Phase 42D verifier registered", JSON.stringify(pkg.scripts || {}), "verify:phase42d-production-deployment-no-upload-readiness-safety");
console.log("CONTRACT: Phase 42D is production deployment/no-upload readiness only.");
console.log("RESULT: Phase 42D production deployment no-upload readiness safety verifier");
if (failed) process.exit(1);
