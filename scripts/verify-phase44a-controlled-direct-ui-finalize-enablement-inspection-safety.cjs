const fs = require("fs");
const path = require("path");

let failed = false;
const pass = (m) => console.log("PASS: " + m);
const fail = (m) => { failed = true; console.error("FAIL: " + m); };
const read = (p) => fs.readFileSync(path.join(process.cwd(), p), "utf8");
const exists = (p) => fs.existsSync(path.join(process.cwd(), p));
const contains = (label, text, token) => text.includes(token) ? pass(label) : fail(label + " missing token: " + token);
const notContains = (label, text, token) => !text.includes(token) ? pass(label) : fail(label + " contains forbidden token: " + token);

const requiredFiles = [
  "docs/clio-storage-refactor/phase44a-controlled-direct-ui-finalize-enablement-inspection.md",
  "app/matters/page.tsx",
  "app/api/documents/finalize/route.ts",
  "app/api/documents/working-docx/route.ts",
  "package.json",
];

for (const f of requiredFiles) exists(f) ? pass("required Phase 44A file exists: " + f) : fail("missing required Phase 44A file: " + f);

const doc = read(requiredFiles[0]);
const page = read("app/matters/page.tsx");
const finalize = read("app/api/documents/finalize/route.ts");
const working = read("app/api/documents/working-docx/route.ts");
const pkg = JSON.parse(read("package.json"));

for (const token of [
  "Phase 44A",
  "Controlled Direct UI Finalize Enablement Inspection",
  "does not turn on live upload",
  "owner/admin-only",
  "selectedDocumentKey",
  "workingDocumentDriveItemId",
  "workingDocumentKey",
  "allowDuplicateUploads: false",
  "uploadTargetMode: \"direct-matter\"",
  "directMatterId",
  "directMatterDisplayNumber",
  "masterLawsuitId",
  "uploadTargetMode: \"master-lawsuit\"",
  "no document is uploaded"
]) contains("doc contains " + token, doc, token);

for (const token of [
  "directMatterSingleMasterDryRunControlEnabled = false",
  "if (!selectedDocumentKey || !workingDocumentDriveItemId || !workingDocumentKey) return null",
  "buildDirectMatterSingleMasterFinalizeDryRunPayload",
  "buildDirectMatterSingleMasterFinalizePayload",
  'uploadTargetMode: "direct-matter"',
  "directMatterId",
  "directMatterDisplayNumber",
  "documentKeys: [selectedDocumentKey]",
  "workingDocumentDriveItemId",
  "workingDocumentKey",
  "confirmUpload: false",
  "singleMasterDryRun: true",
  "singleMasterResolveFolders: true",
  "allowDuplicateUploads: false",
  "runDirectMatterSingleMasterFinalizeDryRunFromUi",
  "masterLawsuitId",
  'uploadTargetMode: "master-lawsuit"'
]) contains("matters page retains controlled enablement prerequisite token " + token, page, token);

const directHelperStart = page.indexOf("type DirectMatterSingleMasterDocumentPayloadParams");
const directHelperEnd = page.indexOf("export default", directHelperStart);
const directHelperBlock = directHelperStart >= 0 && directHelperEnd > directHelperStart ? page.slice(directHelperStart, directHelperEnd) : "";
contains("direct helper block captured", directHelperBlock, "DirectMatterSingleMasterDocumentPayloadParams");
contains("direct helper block uses direct-matter", directHelperBlock, 'uploadTargetMode: "direct-matter"');
contains("direct helper block uses directMatterId", directHelperBlock, "directMatterId");
contains("direct helper block uses directMatterDisplayNumber", directHelperBlock, "directMatterDisplayNumber");
contains("direct helper block preserves duplicate prevention", directHelperBlock, "allowDuplicateUploads: false");
notContains("direct helper block does not include masterLawsuitId", directHelperBlock, "masterLawsuitId");
notContains("direct helper block does not hard-code live upload", directHelperBlock, "confirmUpload: true");

const dryRunControlStart = page.indexOf("function renderDirectMatterSingleMasterDryRunControl");
const dryRunControlEnd = page.indexOf("function directMatterSingleMasterDryRunSurfaceRow", dryRunControlStart);
const dryRunControlBlock = dryRunControlStart >= 0 && dryRunControlEnd > dryRunControlStart ? page.slice(dryRunControlStart, dryRunControlEnd) : "";
contains("dry-run control block captured", dryRunControlBlock, "renderDirectMatterSingleMasterDryRunControl");
contains("dry-run control remains guarded off", dryRunControlBlock, "directMatterSingleMasterDryRunControlEnabled");
contains("dry-run control calls dry-run handler only", dryRunControlBlock, "handleDirectMatterSingleMasterDryRunControl");
notContains("dry-run control does not call live finalize directly", dryRunControlBlock, "confirmUpload: true");
notContains("dry-run control does not include masterLawsuitId", dryRunControlBlock, "masterLawsuitId");

for (const token of [
  "useDirectFinalizePreview",
  "singleMasterDryRun",
  "noUploadPerformed: true",
  'uploadTargetMode === "direct-matter"',
  "workingDocumentDriveItemId",
  "allowDuplicateUploads",
  "uploadBufferToClioMatterDocuments("
]) contains("finalize route retains direct finalize routing token " + token, finalize, token);

for (const token of [
  "singleMasterDirectStorage",
  "directMatterId",
  "directMatterDisplayNumber",
  "workingDocument",
  "masterLawsuitId"
]) contains("working-docx route retains master/direct working document separation token " + token, working, token);

contains("package Phase 44A verifier registered", JSON.stringify(pkg.scripts || {}), "verify:phase44a-controlled-direct-ui-finalize-enablement-inspection-safety");
notContains("package does not register live Phase 44A smoke", JSON.stringify(pkg.scripts || {}), "smoke:phase44a-live");

console.log("CONTRACT: Phase 44A is controlled enablement inspection only; direct UI live upload remains off.");
console.log("RESULT: Phase 44A controlled direct UI finalize enablement inspection verifier");
if (failed) process.exit(1);
