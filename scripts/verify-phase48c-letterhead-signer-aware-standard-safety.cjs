const fs = require("fs");
let failed = false;
const pass = (m) => console.log("PASS: " + m);
const fail = (m) => { failed = true; console.error("FAIL: " + m); };
const docPath = "docs/template-generation-refactor/phase48c-letterhead-signer-aware-merge-field-standard.md";
const pkgPath = "package.json";
if (fs.existsSync(docPath)) pass("required doc exists"); else fail("missing Phase 48C doc");
if (fs.existsSync(pkgPath)) pass("package exists"); else fail("missing package.json");
const doc = fs.existsSync(docPath) ? fs.readFileSync(docPath, "utf8") : "";
const pkg = fs.existsSync(pkgPath) ? JSON.parse(fs.readFileSync(pkgPath, "utf8")) : { scripts: {} };
for (const token of [
  "letterhead-simple",
  "DOCX-based non-generation layout asset",
  "logo should always be present",
  "defaults to the logged-in Barsh Matters user",
  "Other users must be selectable from the document generation dialog",
  "{{signerPhoneExtension}}",
  "{{signerFax}}",
  "{{signerEmail}}",
  "{{signerName}}",
  "{{signerTitle}}",
  "must not assume a single addressee source",
  "adversary_attorney",
  "insurer",
  "court",
  "settled_with_contact",
  "manual",
  "{{addresseeSourceType}}",
  "{{addresseeRole}}",
  "{{addresseeName}}",
  "{{addresseeCompany}}",
  "{{addresseeAttentionLine}}",
  "{{addresseeAddressLine1}}",
  "{{addresseeAddressLine2}}",
  "{{addresseeAddressLine3}}",
  "{{addresseeEmail}}",
  "{{addresseeFax}}",
  "resolve from lawsuit adversary attorney data",
  "resolve from insurer/contact data",
  "resolve from court/venue data",
  "resolve from settlement contact or settled-with contact",
  "mergeable `Re:` section",
  "{{reLine1}}",
  "{{reLine2}}",
  "{{reMatterNumber}}",
  "{{rePatientName}}",
  "{{reProviderName}}",
  "{{reInsurerName}}",
  "{{reClaimNumber}}",
  "{{reIndexNumber}}",
  "{{reDateOfLoss}}",
  "Times New Roman",
  "12 pt",
  "Very truly yours,",
  "same tabbed alignment as the date"
]) {
  if (doc.includes(token)) pass(`doc contains ${token}`); else fail(`doc missing ${token}`);
}
for (const token of [
  "uploadBufferToClioMatterDocuments(",
  "CONFIRM_LIVE_TERMINAL_FINALIZE=YES",
  "confirmUpload: true",
  "documentPrintQueueItem.create(",
  "sendMail",
  "workingDocumentDriveItemId"
]) {
  if (!doc.includes(token)) pass(`doc no external/finalization marker ${token}`); else fail(`doc contains forbidden marker ${token}`);
}
if (pkg.scripts?.["verify:phase48c-letterhead-signer-aware-standard-safety"] === "node scripts/verify-phase48c-letterhead-signer-aware-standard-safety.cjs") pass("package verifier script registered"); else fail("package verifier script missing");
if (failed) { console.error("FAIL: Phase 48C letterhead signer-aware standard verifier failed"); process.exit(1); }
console.log("PASS: Phase 48C letterhead signer-aware standard verifier passed");
