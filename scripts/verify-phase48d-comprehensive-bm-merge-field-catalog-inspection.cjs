const fs = require("fs");

let failed = false;
const pass = (m) => console.log("PASS: " + m);
const fail = (m) => { failed = true; console.error("FAIL: " + m); };
const exists = (p) => fs.existsSync(p);
const read = (p) => fs.readFileSync(p, "utf8");
const contains = (label, text, token) => text.includes(token) ? pass(label) : fail(`${label} missing token: ${token}`);
const notContains = (label, text, token) => !text.includes(token) ? pass(label) : fail(`${label} contains forbidden token: ${token}`);

const scriptPath = "scripts/inspect-phase48d-comprehensive-bm-merge-field-catalog.cjs";
const verifyPath = "scripts/verify-phase48d-comprehensive-bm-merge-field-catalog-inspection.cjs";
const mdPath = "docs/template-generation-refactor/phase48d-comprehensive-bm-merge-field-catalog-inspection.md";
const jsonPath = "docs/template-generation-refactor/phase48d-comprehensive-bm-merge-field-catalog-inspection.json";
const pkgPath = "package.json";

for (const p of [scriptPath, verifyPath, mdPath, jsonPath, pkgPath]) exists(p) ? pass(`required file exists: ${p}`) : fail(`missing required file: ${p}`);

const script = exists(scriptPath) ? read(scriptPath) : "";
const md = exists(mdPath) ? read(mdPath) : "";
const json = exists(jsonPath) ? JSON.parse(read(jsonPath)) : {};
const pkg = exists(pkgPath) ? JSON.parse(read(pkgPath)) : { scripts: {} };

for (const token of [
  "all visible UI fields in Barsh Matters",
  "all non-viewable fields in database tables already created",
  "hidden/internal fields needed for document generation",
  "layout-level merge fields for letterhead and pleading paper",
  "signer, addressee-source, and Re fields",
  "template-specific fields from uploaded DOCX placeholders",
  "Ask Dave before mapping",
  "Phase 48E",
]) contains(`doc contains ${token}`, md, token);

for (const token of [
  "parsePrismaModels",
  "extractUiLabels",
  "workflowBuckets",
  "letterhead",
  "pleading_paper",
  "invoice_remittance_reference",
  "hidden_internal",
]) contains(`inspection script contains ${token}`, script, token);

json.ok === true ? pass("inspection JSON ok true") : fail("inspection JSON ok not true");
json.scope?.allVisibleUiFields === true ? pass("JSON scope all visible UI fields true") : fail("JSON scope visible UI missing");
json.scope?.allNonViewableDatabaseFields === true ? pass("JSON scope non-viewable DB fields true") : fail("JSON scope non-viewable missing");
json.scope?.hiddenInternalFields === true ? pass("JSON scope hidden/internal true") : fail("JSON scope hidden/internal missing");
json.scope?.layoutFields === true ? pass("JSON scope layout fields true") : fail("JSON scope layout missing");
json.modelCount > 0 ? pass("JSON has Prisma models") : fail("JSON model count missing");
json.totalSchemaFieldCount > 0 ? pass("JSON has Prisma fields") : fail("JSON schema field count missing");
Array.isArray(json.workflowBuckets) && json.workflowBuckets.includes("lawsuit") && json.workflowBuckets.includes("hidden_internal") ? pass("JSON workflow buckets include lawsuit and hidden_internal") : fail("JSON workflow buckets incomplete");
Array.isArray(json.layoutFields?.letterhead) && json.layoutFields.letterhead.includes("addresseeSourceType") && json.layoutFields.letterhead.includes("reClaimNumber") ? pass("JSON letterhead layout fields include addressee/Re") : fail("JSON letterhead layout fields incomplete");
Array.isArray(json.layoutFields?.pleading_paper) && json.layoutFields.pleading_paper.includes("courtName") && json.layoutFields.pleading_paper.includes("pleadingTitle") ? pass("JSON pleading layout fields include court/pleading") : fail("JSON pleading layout fields incomplete");
json.safety?.readOnlyInspection === true ? pass("JSON safety read-only true") : fail("JSON read-only safety missing");
json.safety?.noDatabaseMutation === true ? pass("JSON no DB mutation true") : fail("JSON no DB mutation missing");
json.safety?.noFieldMapping === true ? pass("JSON no field mapping true") : fail("JSON no field mapping missing");

for (const token of [
  "documentTemplate.create(",
  "documentTemplate.update(",
  "documentTemplate.delete",
  "uploadBufferToClioMatterDocuments(",
  "CONFIRM_LIVE_TERMINAL_FINALIZE=YES",
  "confirmUpload: true",
  "documentPrintQueueItem.create(",
  "sendMail"
]) notContains(`inspection/doc no write/finalization marker ${token}`, script + "\n" + md, token);

pkg.scripts?.["inspect:phase48d-comprehensive-bm-merge-field-catalog"] === "node scripts/inspect-phase48d-comprehensive-bm-merge-field-catalog.cjs" ? pass("package inspection script registered") : fail("package inspection script missing");
pkg.scripts?.["verify:phase48d-comprehensive-bm-merge-field-catalog-inspection"] === "node scripts/verify-phase48d-comprehensive-bm-merge-field-catalog-inspection.cjs" ? pass("package verifier script registered") : fail("package verifier script missing");

if (failed) {
  console.error("FAIL: Phase 48D comprehensive BM merge-field catalog inspection verifier failed");
  process.exit(1);
}
console.log("PASS: Phase 48D comprehensive BM merge-field catalog inspection verifier passed");
