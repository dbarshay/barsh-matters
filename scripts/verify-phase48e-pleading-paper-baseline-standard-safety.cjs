const fs = require("fs");
let failed = false;
const pass = (m) => console.log("PASS: " + m);
const fail = (m) => { failed = true; console.error("FAIL: " + m); };
const docPath = "docs/template-generation-refactor/phase48e-pleading-paper-baseline-merge-field-standard.md";
const pkgPath = "package.json";
if (fs.existsSync(docPath)) pass("required doc exists"); else fail("missing Phase 48E doc");
if (fs.existsSync(pkgPath)) pass("package exists"); else fail("missing package.json");
const doc = fs.existsSync(docPath) ? fs.readFileSync(docPath, "utf8") : "";
const pkg = fs.existsSync(pkgPath) ? JSON.parse(fs.readFileSync(pkgPath, "utf8")) : { scripts: {} };

for (const token of [
  "pleading-paper",
  "DOCX-based non-generation layout asset",
  "must not appear in Generate Documents",
  "{{courtName}}",
  "{{courtVenue}}",
  "{{courtAddressLine1}}",
  "{{courtAddressLine2}}",
  "{{courtCity}}",
  "{{courtState}}",
  "{{courtZip}}",
  "{{courtAddressCityStateZip}}",
  "{{plaintiffName}}",
  "{{defendantName}}",
  "{{captionPlaintiffLine}}",
  "{{captionDefendantLine}}",
  "{{indexNumber}}",
  "{{pleadingTitle}}",
  "{{pleadingType}}",
  "{{matterNumber}}",
  "{{lawsuitNumber}}",
  "{{filingDate}}",
  "{{todayLong}}",
  "{{signerName}}",
  "{{signerTitle}}",
  "{{signerEmail}}",
  "{{signerPhoneExtension}}",
  "{{signerFax}}",
  "{{firmName}}",
  "{{firmAddressLine1}}",
  "{{firmAddressLine2}}",
  "{{attorneyFor}}",
  "{{backerTitle}}",
  "{{certificationText}}",
  "{{serviceAdmissionText}}",
  "{{attorneyForAdmission}}",
  "{{admissionDate}}",
  "{{admissionAttorneyName}}",
  "Matter.Client.Name",
  "Matter.CustomField.DebtCollector.Name",
  "Matter.CustomField.DocketNumber",
  "Matter.Number",
  "all visible UI fields in Barsh Matters",
  "all non-viewable/internal DB fields",
  "Ask Dave before mapping",
  "Phase 48F"
]) {
  if (doc.includes(token)) pass(`doc contains ${token}`); else fail(`doc missing ${token}`);
}

for (const token of [
  "documentTemplate.create(",
  "documentTemplate.update(",
  "uploadBufferToClioMatterDocuments(",
  "CONFIRM_LIVE_TERMINAL_FINALIZE=YES",
  "confirmUpload: true",
  "documentPrintQueueItem.create(",
  "sendMail",
  "workingDocumentDriveItemId"
]) {
  if (!doc.includes(token)) pass(`doc no write/finalization marker ${token}`); else fail(`doc contains forbidden marker ${token}`);
}

if (pkg.scripts?.["verify:phase48e-pleading-paper-baseline-standard-safety"] === "node scripts/verify-phase48e-pleading-paper-baseline-standard-safety.cjs") pass("package verifier script registered"); else fail("package verifier script missing");

if (failed) {
  console.error("FAIL: Phase 48E pleading-paper baseline standard verifier failed");
  process.exit(1);
}
console.log("PASS: Phase 48E pleading-paper baseline standard verifier passed");
