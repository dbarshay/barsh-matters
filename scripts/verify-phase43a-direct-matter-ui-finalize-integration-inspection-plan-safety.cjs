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

const docPath = "docs/clio-storage-refactor/phase43a-direct-matter-ui-finalize-integration-inspection-plan.md";
for (const f of [docPath, "app/matters/page.tsx", "app/api/documents/finalize/route.ts", "app/api/documents/working-docx/route.ts", "app/api/documents/direct-finalize-preview/route.ts", "package.json"]) {
  exists(f) ? pass("required Phase 43A file exists: " + f) : fail("missing required Phase 43A file: " + f);
}

const doc = read(docPath);
const mattersPage = read("app/matters/page.tsx");
const finalize = read("app/api/documents/finalize/route.ts");
const workingDocx = read("app/api/documents/working-docx/route.ts");
const directPreview = read("app/api/documents/direct-finalize-preview/route.ts");
const pkg = JSON.parse(read("package.json"));

for (const token of [
  "Phase 43A",
  "inspection/planning only",
  "uploadTargetMode: \"direct-matter\"",
  "directMatterId",
  "workingDocumentDriveItemId",
  "Duplicate prevention must check the resolved single-master folder",
  "Individual Matters / BRL-YYYY00001-BRL-YYYY00999 / BRL_YYYYNNNNN",
  "owner/admin first",
  "no automatic movement of existing direct documents"
]) {
  contains("doc contains " + token, doc, token);
}

for (const token of [
  "workingDocumentDriveItemId",
  "uploadTargetMode",
  "Finalize Document"
]) {
  contains("matters page contains current UI anchor " + token, mattersPage, token);
}
if (mattersPage.includes("buildDirectMatterSingleMasterFinalizePayload")) {
  contains("matters page now has guarded direct helper foundation", mattersPage, "buildDirectMatterSingleMasterFinalizePayload");
  contains("matters page helper includes directMatterId", mattersPage, "directMatterId");
  contains("matters page helper includes directMatterDisplayNumber", mattersPage, "directMatterDisplayNumber");
  contains("matters page helper keeps duplicate prevention off", mattersPage, "allowDuplicateUploads: false");
  contains("doc records original UI gap directMatterId", doc, "does not yet send `directMatterId`");
  contains("doc records original UI gap directMatterDisplayNumber", doc, "does not yet send `directMatterDisplayNumber`");
} else {
  notContains("matters page currently lacks directMatterId UI payload wiring", mattersPage, "directMatterId");
  notContains("matters page currently lacks directMatterDisplayNumber UI payload wiring", mattersPage, "directMatterDisplayNumber");
  contains("doc records current UI gap directMatterId", doc, "does not yet send `directMatterId`");
  contains("doc records current UI gap directMatterDisplayNumber", doc, "does not yet send `directMatterDisplayNumber`");
}

for (const token of [
  "useDirectFinalizePreview",
  "uploadTargetMode === \"direct-matter\"",
  "useSingleMasterClioStorage",
  "singleMasterDirectStorage",
  "workingDocumentDriveItemId",
  "allowDuplicateUploads",
  "findExistingClioDocumentsByFilename",
  "listClioFolderDocuments",
  "uploadBufferToClioMatterDocuments("
]) {
  contains("finalize route contains integration anchor " + token, finalize, token);
}

for (const token of [
  "singleMasterDirectStorage",
  "previewUrl.searchParams.set(\"singleMasterDirectStorage\", \"1\")",
  "workingDocument",
  "...working"
]) {
  contains("working-docx route contains direct working anchor " + token, workingDocx, token);
}

for (const token of [
  "single-master-direct-individual-storage",
  "directMatterFileNumber",
  "matterDisplayNumber",
  "singleMasterDirectStorage"
]) {
  contains("direct preview contains storage anchor " + token, directPreview, token);
}

contains("package Phase 43A verifier registered", JSON.stringify(pkg.scripts || {}), "verify:phase43a-direct-matter-ui-finalize-integration-inspection-plan-safety");
notContains("doc avoids enabling live upload", doc, "enable broad production direct uploads now");
console.log("CONTRACT: Phase 43A is UI integration inspection/planning only.");
console.log("RESULT: Phase 43A direct matter UI finalize integration inspection plan verifier");
if (failed) process.exit(1);
