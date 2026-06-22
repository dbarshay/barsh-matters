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

const docPath = "docs/clio-storage-refactor/phase43b-guarded-direct-matter-ui-payload-foundation.md";
for (const f of [docPath, "app/matters/page.tsx", "app/api/documents/finalize/route.ts", "app/api/documents/working-docx/route.ts", "package.json"]) {
  exists(f) ? pass("required Phase 43B file exists: " + f) : fail("missing required Phase 43B file: " + f);
}

const doc = read(docPath);
const page = read("app/matters/page.tsx");
const finalize = read("app/api/documents/finalize/route.ts");
const workingDocx = read("app/api/documents/working-docx/route.ts");
const pkg = JSON.parse(read("package.json"));

for (const token of [
  "Phase 43B",
  "Guarded Direct Matter UI Payload Foundation",
  "does not change the live button behavior",
  "uploadTargetMode: \"direct-matter\"",
  "directMatterId",
  "directMatterDisplayNumber",
  "workingDocumentDriveItemId",
  "workingDocumentKey",
  "allowDuplicateUploads: false",
  "dry-run by default"
]) {
  contains("doc contains " + token, doc, token);
}

for (const token of [
  "DirectMatterSingleMasterDocumentPayloadParams",
  "buildDirectMatterSingleMasterWorkingDocxPayload",
  "buildDirectMatterSingleMasterFinalizePayload",
  'uploadTargetMode: "direct-matter"',
  "directMatterId",
  "directMatterDisplayNumber",
  "useSingleMasterClioStorage: true",
  "singleMasterDirectStorage: true",
  "workingDocumentDriveItemId",
  "workingDocumentKey",
  "allowDuplicateUploads: false",
  "singleMasterDryRun: params.singleMasterDryRun !== false"
]) {
  contains("matters page contains direct UI payload foundation " + token, page, token);
}

const helperStart = page.indexOf("function buildDirectMatterSingleMasterWorkingDocxPayload");
const helperEnd = page.indexOf("export default", helperStart);
const helperBlock = helperStart >= 0 && helperEnd > helperStart ? page.slice(helperStart, helperEnd) : "";
contains("helper block captured", helperBlock, "buildDirectMatterSingleMasterFinalizePayload");
notContains("direct helper block does not include masterLawsuitId", helperBlock, "masterLawsuitId");
notContains("direct helper block does not enable duplicate uploads", helperBlock, "allowDuplicateUploads: true");
notContains("direct helper block does not hard-code confirmUpload true", helperBlock, "confirmUpload: true");

for (const token of [
  "useDirectFinalizePreview",
  "uploadTargetMode === \"direct-matter\"",
  "workingDocumentDriveItemId",
  "allowDuplicateUploads",
  "uploadBufferToClioMatterDocuments("
]) {
  contains("finalize route retains direct backend anchor " + token, finalize, token);
}

for (const token of [
  "singleMasterDirectStorage",
  "directMatterId",
  "directMatterDisplayNumber",
  "workingDocument"
]) {
  contains("working-docx route retains direct backend anchor " + token, workingDocx, token);
}

contains("package Phase 43B verifier registered", JSON.stringify(pkg.scripts || {}), "verify:phase43b-guarded-direct-matter-ui-payload-foundation-safety");
console.log("CONTRACT: Phase 43B adds guarded UI payload builders only; no upload behavior is enabled.");
console.log("RESULT: Phase 43B guarded direct matter UI payload foundation verifier");
if (failed) process.exit(1);
