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

const docPath = "docs/clio-storage-refactor/phase42c-read-only-audit-production-no-upload-preview.md";
const smokePath = "scripts/smoke-phase42c-read-only-audit-production-no-upload-preview.cjs";
for (const f of [docPath, smokePath, "app/api/documents/finalize/route.ts", "app/api/documents/direct-finalize-preview/route.ts", "package.json"]) {
  exists(f) ? pass("required Phase 42C file exists: " + f) : fail("missing required Phase 42C file: " + f);
}
const doc = read(docPath);
const smoke = read(smokePath);
const finalize = read("app/api/documents/finalize/route.ts");
const pkg = JSON.parse(read("package.json"));

for (const token of ["Phase 42C", "read-only", "production no-upload", "22070801495", "22062401000", "104", "does not upload another finalized PDF", "Phase 42B locked audit proof"]) {
  contains("doc contains " + token, doc, token);
}
for (const token of ["confirmUpload: false", "singleMasterDryRun: true", "singleMasterResolveFolders: true", "local finalize dry-run noUploadPerformed true", "local finalize dry-run databaseMutation false", "production no-upload preview", "EXPECTED_CLIO_DOCUMENT_ID = 22070801495", "EXPECTED_FINALIZATION_ID = 104", "EXPECTED_FOLDER_ID = 22062401000", "DB_AUDIT_SOURCE=phase42b-finalize-response", "Phase 42B finalization audit record id 104 is recorded in locked proof"]) {
  contains("smoke contains " + token, smoke, token);
}
for (const forbidden of ["confirmUpload: true", "workingDocumentDriveItemId:", "PrismaClient", "lib/prisma", "uploadBufferToClioMatterDocuments({"]) {
  notContains("Phase 42C smoke avoids upload/DB-client token", smoke, forbidden);
}
for (const token of ["useDirectFinalizePreview", "singleMasterDryRun", "noUploadPerformed: true"]) {
  contains("finalize route retains no-upload dry-run anchor " + token, finalize, token);
}
contains("package Phase 42C smoke registered", JSON.stringify(pkg.scripts || {}), "smoke:phase42c-read-only-audit-production-no-upload-preview");
contains("package Phase 42C verifier registered", JSON.stringify(pkg.scripts || {}), "verify:phase42c-read-only-audit-production-no-upload-preview-safety");
console.log("CONTRACT: Phase 42C is read-only audit plus production no-upload preview only.");
console.log("RESULT: Phase 42C read-only audit production no-upload preview safety verifier");
if (failed) process.exit(1);
