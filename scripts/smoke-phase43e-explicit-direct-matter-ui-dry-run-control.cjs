const fs = require("fs");
const page = fs.readFileSync("app/matters/page.tsx", "utf8");
const required = [
  "static/no-server/no-upload",
  "directMatterSingleMasterDryRunControlEnabled = false",
  "handleDirectMatterSingleMasterDryRunControl",
  "renderDirectMatterSingleMasterDryRunControl",
  "runDirectMatterSingleMasterFinalizeDryRunFromUi",
  "confirmUpload: false",
  "singleMasterDryRun: true",
  "singleMasterResolveFolders: true",
  "allowDuplicateUploads: false",
  "data-phase43e-direct-matter-dry-run-control",
];
let failed = false;
for (const token of required) {
  if (page.includes(token)) {
    console.log("PASS: Phase 43E smoke token present:", token);
  } else {
    failed = true;
    console.error("FAIL: Phase 43E smoke token missing:", token);
  }
}

const start = page.indexOf("const directMatterSingleMasterDryRunControlEnabled = false");
const end = page.indexOf("function masterDocumentPreviewText", start);
const block = start >= 0 && end > start ? page.slice(start, end) : "";
if (block.includes("masterLawsuitId")) {
  failed = true;
  console.error("FAIL: Phase 43E control block contains masterLawsuitId");
} else {
  console.log("PASS: Phase 43E control block does not contain masterLawsuitId");
}
if (block.includes("confirmUpload: true")) {
  failed = true;
  console.error("FAIL: Phase 43E control block contains confirmUpload true");
} else {
  console.log("PASS: Phase 43E control block does not contain confirmUpload true");
}
console.log("CONTRACT: Phase 43E smoke is static/no-server/no-upload.");
if (failed) process.exit(1);
console.log("RESULT: Phase 43E explicit direct matter UI dry-run control smoke");
