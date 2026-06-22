const fs = require("fs");
const path = require("path");
let failed = false;
const pass = (m) => console.log("PASS: " + m);
const fail = (m) => { failed = true; console.error("FAIL: " + m); };
const read = (p) => fs.readFileSync(path.join(process.cwd(), p), "utf8");
const exists = (p) => fs.existsSync(path.join(process.cwd(), p));
function contains(label, text, token) { text.includes(token) ? pass(label) : fail(label + " missing token: " + token); }
function notContains(label, text, token) { !text.includes(token) ? pass(label) : fail(label + " contains forbidden token: " + token); }

const docPath = "docs/clio-storage-refactor/phase43k-local-direct-ui-dry-run-payload-builder-smoke.md";
const smokePath = "scripts/smoke-phase43k-local-direct-ui-dry-run-payload-builder.cjs";
for (const f of [docPath, smokePath, "app/matters/page.tsx", "package.json"]) {
  exists(f) ? pass("required Phase 43K file exists: " + f) : fail("missing required Phase 43K file: " + f);
}

const doc = read(docPath);
const smoke = read(smokePath);
const page = read("app/matters/page.tsx");
const pkg = JSON.parse(read("package.json"));

for (const token of [
  "Phase 43K",
  "Local Direct UI Dry-Run Payload Builder Smoke",
  "static/local/no-server/no-upload",
  "representative values",
  "uploadTargetMode: \"direct-matter\"",
  "confirmUpload: false",
  "singleMasterDryRun: true",
  "singleMasterResolveFolders: true",
  "allowDuplicateUploads: false",
  "no `masterLawsuitId` is included"
]) {
  contains("doc contains " + token, doc, token);
}

for (const token of [
  "representative",
  "directMatterId: \"1881278195\"",
  "directMatterDisplayNumber: \"BRL_202600001\"",
  "selectedDocumentKey: \"summons-complaint\"",
  "workingDocumentDriveItemId: \"WORKING_DOCUMENT_DRIVE_ITEM_ID_REPRESENTATIVE\"",
  "workingDocumentKey: \"summons-complaint\"",
  "uploadTargetMode: \"direct-matter\"",
  "useSingleMasterClioStorage: true",
  "confirmUpload: false",
  "singleMasterDryRun: true",
  "singleMasterResolveFolders: true",
  "allowDuplicateUploads: false",
  "documentKeys: [representative.selectedDocumentKey]",
  "PAYLOAD_PREVIEW_REDACTED",
  "static/local/no-server/no-upload"
]) {
  contains("smoke contains " + token, smoke, token);
}

notContains("smoke does not fetch finalize", smoke, "fetch(");
notContains("smoke does not call Clio upload helper", smoke, "uploadBufferToClioMatterDocuments");
notContains("smoke does not start server", smoke, "next dev");
notContains("smoke does not include masterLawsuitId in payload object", smoke, "masterLawsuitId:");

for (const token of [
  "buildDirectMatterSingleMasterFinalizeDryRunPayload",
  "if (!selectedDocumentKey || !workingDocumentDriveItemId || !workingDocumentKey) return null",
  "documentKeys: [selectedDocumentKey]",
  "directMatterSingleMasterDryRunControlEnabled = false"
]) {
  contains("page retains prerequisite/dry-run source token " + token, page, token);
}

contains("package Phase 43K verifier registered", JSON.stringify(pkg.scripts || {}), "verify:phase43k-local-direct-ui-dry-run-payload-builder-safety");
contains("package Phase 43K smoke registered", JSON.stringify(pkg.scripts || {}), "smoke:phase43k-local-direct-ui-dry-run-payload-builder");

console.log("CONTRACT: Phase 43K adds static local direct UI dry-run payload builder smoke only.");
console.log("RESULT: Phase 43K local direct UI dry-run payload builder safety verifier");
if (failed) process.exit(1);
