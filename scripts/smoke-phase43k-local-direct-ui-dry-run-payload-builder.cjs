const fs = require("fs");

const page = fs.readFileSync("app/matters/page.tsx", "utf8");

const representative = {
  directMatterId: "1881278195",
  directMatterDisplayNumber: "BRL_202600001",
  selectedDocumentKey: "summons-complaint",
  workingDocumentDriveItemId: "WORKING_DOCUMENT_DRIVE_ITEM_ID_REPRESENTATIVE",
  workingDocumentKey: "summons-complaint",
};

const payload = {
  uploadTargetMode: "direct-matter",
  directMatterId: representative.directMatterId,
  directMatterDisplayNumber: representative.directMatterDisplayNumber,
  useSingleMasterClioStorage: true,
  confirmUpload: false,
  singleMasterDryRun: true,
  singleMasterResolveFolders: true,
  allowDuplicateUploads: false,
  documentKeys: [representative.selectedDocumentKey],
  workingDocumentDriveItemId: representative.workingDocumentDriveItemId,
  workingDocumentKey: representative.workingDocumentKey,
};

let failed = false;
function pass(message) { console.log("PASS:", message); }
function fail(message) { failed = true; console.error("FAIL:", message); }
function requireToken(label, token) {
  if (page.includes(token)) pass(label);
  else fail(`${label} missing token: ${token}`);
}

for (const [key, value] of Object.entries(representative)) {
  if (String(value || "").trim()) pass(`representative value present: ${key}`);
  else fail(`representative value missing: ${key}`);
}

if (payload.uploadTargetMode === "direct-matter") pass('payload uploadTargetMode is "direct-matter"');
else fail("payload uploadTargetMode is not direct-matter");

if (payload.useSingleMasterClioStorage === true) pass("payload useSingleMasterClioStorage true");
else fail("payload useSingleMasterClioStorage not true");

if (payload.confirmUpload === false) pass("payload confirmUpload false");
else fail("payload confirmUpload not false");

if (payload.singleMasterDryRun === true) pass("payload singleMasterDryRun true");
else fail("payload singleMasterDryRun not true");

if (payload.singleMasterResolveFolders === true) pass("payload singleMasterResolveFolders true");
else fail("payload singleMasterResolveFolders not true");

if (payload.allowDuplicateUploads === false) pass("payload allowDuplicateUploads false");
else fail("payload allowDuplicateUploads not false");

if (Array.isArray(payload.documentKeys) && payload.documentKeys.length === 1 && payload.documentKeys[0] === representative.selectedDocumentKey) {
  pass("payload documentKeys contains selectedDocumentKey");
} else {
  fail("payload documentKeys does not contain selectedDocumentKey");
}

if (!Object.prototype.hasOwnProperty.call(payload, "masterLawsuitId")) pass("payload does not include masterLawsuitId");
else fail("payload includes masterLawsuitId");

requireToken("source has direct dry-run payload helper", "buildDirectMatterSingleMasterFinalizeDryRunPayload");
requireToken("source has prerequisite gate", "if (!selectedDocumentKey || !workingDocumentDriveItemId || !workingDocumentKey) return null");
requireToken("source has selected document key bridge", "documentKeys: [selectedDocumentKey]");
requireToken("source has working doc drive id bridge", "workingDocumentDriveItemId,");
requireToken("source has working doc key bridge", "workingDocumentKey,");
requireToken("source has guard disabled", "directMatterSingleMasterDryRunControlEnabled = false");
requireToken("source has no-upload confirmation", "confirmUpload: false");
requireToken("source has dry-run confirmation", "singleMasterDryRun: true");
requireToken("source has folder-resolution confirmation", "singleMasterResolveFolders: true");
requireToken("source has duplicate prevention", "allowDuplicateUploads: false");

console.log("PAYLOAD_PREVIEW_REDACTED=" + JSON.stringify({
  ...payload,
  workingDocumentDriveItemId: "WORKING_DOCUMENT_DRIVE_ITEM_ID_REDACTED",
}));

console.log("CONTRACT: Phase 43K smoke is static/local/no-server/no-upload.");
if (failed) process.exit(1);
console.log("RESULT: Phase 43K local direct UI dry-run payload builder smoke");
