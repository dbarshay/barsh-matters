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

const docPath = "docs/clio-storage-refactor/phase43e-explicit-direct-matter-ui-dry-run-control-smoke.md";
for (const f of [
  docPath,
  "app/matters/page.tsx",
  "scripts/smoke-phase43e-explicit-direct-matter-ui-dry-run-control.cjs",
  "package.json",
]) {
  exists(f) ? pass("required Phase 43E file exists: " + f) : fail("missing required Phase 43E file: " + f);
}

const doc = read(docPath);
const page = read("app/matters/page.tsx");
const smoke = read("scripts/smoke-phase43e-explicit-direct-matter-ui-dry-run-control.cjs");
const pkg = JSON.parse(read("package.json"));

for (const token of [
  "Phase 43E",
  "Explicit Direct Matter UI Dry-Run Control Smoke",
  "guarded off by default",
  "confirmUpload: false",
  "singleMasterDryRun: true",
  "singleMasterResolveFolders: true",
  "does not include `masterLawsuitId`",
  "static/no-server/no-upload"
]) {
  contains("doc contains " + token, doc, token);
}

for (const token of [
  "directMatterSingleMasterDryRunControlEnabled = false",
  "handleDirectMatterSingleMasterDryRunControl",
  "renderDirectMatterSingleMasterDryRunControl",
  "data-phase43e-direct-matter-dry-run-control",
  "Direct Matter Clio Dry Run",
  "runDirectMatterSingleMasterFinalizeDryRunFromUi",
  "confirmUpload: false",
  "singleMasterDryRun: true",
  "singleMasterResolveFolders: true"
]) {
  contains("matters page contains Phase 43E control token " + token, page, token);
}

const controlStart = page.indexOf("const directMatterSingleMasterDryRunControlEnabled = false");
const controlEndCandidates = [
  page.indexOf("\n  function masterDocumentPreviewText", controlStart + 10),
  page.indexOf("\n  async function loadMasterDocumentDataPreview", controlStart + 10),
].filter((index) => index > controlStart);
const controlEnd = controlEndCandidates.length ? Math.min(...controlEndCandidates) : Math.min(page.length, controlStart + 2600);
const controlBlock = controlStart >= 0 ? page.slice(controlStart, controlEnd) : "";
contains("control block captured", controlBlock, "renderDirectMatterSingleMasterDryRunControl");
contains("control block is guarded off by default", controlBlock, "directMatterSingleMasterDryRunControlEnabled = false");
contains("control block calls dry-run handler", controlBlock, "handleDirectMatterSingleMasterDryRunControl(params)");
contains("control block forces confirmUpload false", controlBlock, "confirmUpload: false");
contains("control block forces singleMasterDryRun true", controlBlock, "singleMasterDryRun: true");
contains("control block forces folder resolution true", controlBlock, "singleMasterResolveFolders: true");
notContains("control block does not include masterLawsuitId", controlBlock, "masterLawsuitId");
notContains("control block does not call working-docx", controlBlock, "/api/documents/working-docx");
notContains("control block does not call Clio upload helper", controlBlock, "uploadBufferToClioMatterDocuments");
notContains("control block does not hard-code confirmUpload true", controlBlock, "confirmUpload: true");

for (const token of [
  "runDirectMatterSingleMasterFinalizeDryRunFromUi",
  "buildDirectMatterSingleMasterFinalizeDryRunPayload(params)",
  'fetch("/api/documents/finalize"',
  "uiOriginatedDirectMatterDryRun: true"
]) {
  contains("Phase 43D handler retained " + token, page, token);
}

for (const token of [
  "static/no-server/no-upload",
  "directMatterSingleMasterDryRunControlEnabled = false",
  "handleDirectMatterSingleMasterDryRunControl",
  "renderDirectMatterSingleMasterDryRunControl",
  "confirmUpload: false",
  "singleMasterDryRun: true"
]) {
  contains("smoke contains " + token, smoke, token);
}

contains("package Phase 43E verifier registered", JSON.stringify(pkg.scripts || {}), "verify:phase43e-explicit-direct-matter-ui-dry-run-control-safety");
contains("package Phase 43E smoke registered", JSON.stringify(pkg.scripts || {}), "smoke:phase43e-explicit-direct-matter-ui-dry-run-control");
console.log("CONTRACT: Phase 43E adds a guarded explicit UI dry-run control path only; no upload path is enabled.");
console.log("RESULT: Phase 43E explicit direct matter UI dry-run control safety verifier");
if (failed) process.exit(1);
