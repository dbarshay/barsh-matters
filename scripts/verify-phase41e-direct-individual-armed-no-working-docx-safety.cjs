const fs = require("fs");
const path = require("path");

let failed = false;
const pass = (m) => console.log("PASS: " + m);
const fail = (m) => {
  failed = true;
  console.error("FAIL: " + m);
};

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const exists = (p) => fs.existsSync(path.join(root, p));

function contains(label, text, token) {
  if (text.includes(token)) pass(label);
  else fail(`${label} missing token: ${token}`);
}

function notContains(label, text, token) {
  if (!text.includes(token)) pass(label);
  else fail(`${label} contains forbidden token: ${token}`);
}

const docPath = "docs/clio-storage-refactor/phase41e-direct-individual-armed-no-working-docx-smoke.md";
const smokePath = "scripts/smoke-phase41e-direct-individual-armed-no-working-docx-no-upload.cjs";
const verifierPath = "scripts/verify-phase41e-direct-individual-armed-no-working-docx-safety.cjs";
const finalizePath = "app/api/documents/finalize/route.ts";
const planPath = "lib/clioStoragePlan.ts";

for (const file of [docPath, smokePath, verifierPath, finalizePath, planPath, "package.json"]) {
  if (exists(file)) pass(`required Phase 41E file exists: ${file}`);
  else fail(`missing required Phase 41E file: ${file}`);
}

const doc = exists(docPath) ? read(docPath) : "";
const smoke = exists(smokePath) ? read(smokePath) : "";
const finalize = exists(finalizePath) ? read(finalizePath) : "";
const plan = exists(planPath) ? read(planPath) : "";
const pkg = JSON.parse(read("package.json"));

for (const token of [
  "Phase 41E is a no-upload armed-path lock",
  "must stop before upload unless a saved working DOCX exists",
  "storageTargetKind: \"individual_matter\"",
  "directMatterFileNumber",
  "BRL_YYYYNNNNN",
  "YYYY.MM.NNNNN",
  "actual `/api/documents/finalize` route still has no direct/individual target-input branch",
  "Microsoft Graph PDF conversion",
  "Clio document upload",
  "DocumentFinalization DB record creation",
  "Existing direct matter documents are not automatically moved",
]) {
  contains(`doc contains ${token}`, doc, token);
}

for (const token of [
  "FUTURE_ARMED_DIRECT_TARGET_INPUT",
  "storageTargetKind: \"individual_matter\"",
  "directMatterFileNumber: \"BRL_202600001\"",
  "bmMatterId: \"BRL_202600001\"",
  "displayNumber: \"BRL_202600001\"",
  "armed direct upload remains blocked before working-DOCX lookup",
  "Phase 41E performs no upload",
]) {
  contains(`smoke contains ${token}`, smoke, token);
}

for (const forbidden of [
  "https://app.clio.com/api",
  "documents.json",
  "document_versions",
  "prisma.documentFinalization.create",
  "prisma.",
  "fetch(",
  "method: \"POST\"",
  "method: 'POST'",
  "writeFileSync",
  "unlinkSync",
]) {
  notContains(`smoke remains no-write/no-network`, smoke, forbidden);
}

for (const forbidden of [
  "22062400790",
  "22062400880",
  "22062401000",
  "Individual Matters/BRL-202600001-BRL-202600999/BRL_202600001",
]) {
  notContains(`finalize route does not hard-code direct anchor`, finalize, forbidden);
}

for (const token of ["Individual Matters", "individual_matter", "direct_matter", "directMatterFileNumber", "BRL_YYYYNNNNN"]) {
  contains(`planner keeps direct taxonomy token ${token}`, plan, token);
}

const namingBlock =
  (plan.match(/function buildIndividualMatterRangeFolderName[\s\S]*?export function buildClioStorageTargetPlan/) || [""])[0] ||
  plan;

for (const forbidden of ["patient", "provider", "insurer", "claimNumber", "claim number", "denial"]) {
  if (!new RegExp(forbidden, "i").test(namingBlock)) pass(`direct folder naming block avoids ${forbidden}`);
  else fail(`direct folder naming block contains ${forbidden}`);
}

if (
  pkg.scripts &&
  pkg.scripts["smoke:phase41e-direct-individual-armed-no-working-docx-no-upload"] ===
    "node scripts/smoke-phase41e-direct-individual-armed-no-working-docx-no-upload.cjs"
) {
  pass("package smoke script registered");
} else {
  fail("package smoke script missing");
}

if (
  pkg.scripts &&
  pkg.scripts["verify:phase41e-direct-individual-armed-no-working-docx-safety"] ===
    "node scripts/verify-phase41e-direct-individual-armed-no-working-docx-safety.cjs"
) {
  pass("package verifier script registered");
} else {
  fail("package verifier script missing");
}

console.log("CONTRACT: Phase 41E is armed-path/no-working-DOCX/no-upload only.");
console.log("CONTRACT: direct/individual upload is not enabled by this phase.");
console.log("RESULT: Phase 41E direct/individual armed no-working-DOCX safety verifier");

if (failed) process.exit(1);
