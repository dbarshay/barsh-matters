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

const docPath = "docs/clio-storage-refactor/phase41g-direct-individual-finalize-target-input-guarded-wiring.md";
const routePath = "app/api/documents/finalize/route.ts";
const planPath = "lib/clioStoragePlan.ts";
const pkgPath = "package.json";

for (const file of [docPath, routePath, planPath, pkgPath]) {
  if (exists(file)) pass(`required Phase 41G file exists: ${file}`);
  else fail(`missing required Phase 41G file: ${file}`);
}

const doc = exists(docPath) ? read(docPath) : "";
const route = exists(routePath) ? read(routePath) : "";
const plan = exists(planPath) ? read(planPath) : "";
const pkg = JSON.parse(read(pkgPath));

for (const token of [
  "Phase 41G wires the direct/individual target-input construction",
  "without enabling direct/individual upload by default",
  "CLIO_DIRECT_INDIVIDUAL_FINALIZE_TARGET_INPUT_ENABLED=1",
  "storageTargetKind: \"individual_matter\"",
  "directMatterFileNumber",
  "BRL_YYYYNNNNN",
  "YYYY.MM.NNNNN",
  "Existing direct matter documents are not automatically moved",
  "Lawsuit finalize flow remains unchanged"
]) {
  contains(`doc contains ${token}`, doc, token);
}

for (const token of [
  "CLIO_DIRECT_INDIVIDUAL_FINALIZE_TARGET_INPUT_ENABLED",
  "directMatterFileNumber",
  "BRL_YYYYNNNNN",
  "storageTargetKind: \"individual_matter\"",
  "bmMatterId: directMatterFileNumber",
  "displayNumber: directMatterFileNumber"
]) {
  contains(`finalize route contains guarded direct target token ${token}`, route, token);
}

notContains("finalize route no longer contains old undefined-numbering block", route, "blocked until Barsh Matters direct-matter numbering/folder convention is defined");

for (const forbidden of [
  "22062400790",
  "22062400880",
  "22062401000",
  "Individual Matters/BRL-202600001-BRL-202600999/BRL_202600001"
]) {
  notContains("finalize route does not hard-code direct live audit anchor", route, forbidden);
}

const directBlockMatch = route.match(/if \(isDirectMatter\) \{[\s\S]*?\n  \}\n\n  const displayNumber/);
const directBlock = directBlockMatch ? directBlockMatch[0] : "";
if (directBlock) pass("direct matter branch located inside buildSingleMasterFinalizeTargetInput");
else fail("direct matter branch not located");

for (const token of [
  "params.directMatterDisplayNumber",
  "target?.directMatterFileNumber",
  "target?.matterDisplayNumber",
  "target?.displayNumber",
  "/^BRL_\\d{9}$/",
  "storageTargetKind: \"individual_matter\""
]) {
  contains(`direct branch contains ${token}`, directBlock, token);
}

for (const forbidden of [
  "patient",
  "provider",
  "insurer",
  "claimNumber",
  "claim number",
  "denial",
  "lawsuitId: directMatterFileNumber",
  "masterLawsuitId: directMatterFileNumber"
]) {
  if (!new RegExp(forbidden, "i").test(directBlock)) pass(`direct branch avoids ${forbidden}`);
  else fail(`direct branch contains forbidden token ${forbidden}`);
}

for (const token of ["Individual Matters", "individual_matter", "direct_matter", "directMatterFileNumber", "BRL_YYYYNNNNN"]) {
  contains(`planner keeps direct taxonomy token ${token}`, plan, token);
}

if (
  pkg.scripts &&
  pkg.scripts["verify:phase41g-direct-individual-finalize-target-input-guarded-wiring"] ===
    "node scripts/verify-phase41g-direct-individual-finalize-target-input-guarded-wiring.cjs"
) {
  pass("package verifier script registered");
} else {
  fail("package verifier script missing");
}

console.log("CONTRACT: Phase 41G wires direct/individual target-input construction behind a default-off flag only.");
console.log("CONTRACT: direct/individual upload is not enabled by this phase.");
console.log("RESULT: Phase 41G direct/individual finalize target-input guarded wiring verifier");

if (failed) process.exit(1);
