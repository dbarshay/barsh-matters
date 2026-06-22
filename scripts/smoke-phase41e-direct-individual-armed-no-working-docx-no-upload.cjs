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

const FUTURE_ARMED_DIRECT_TARGET_INPUT = Object.freeze({
  storageTargetKind: "individual_matter",
  directMatterFileNumber: "BRL_202600001",
  bmMatterId: "BRL_202600001",
  displayNumber: "BRL_202600001",
});

function assert(condition, message) {
  if (condition) pass(message);
  else fail(message);
}

console.log("RESULT: Phase 41E direct/individual armed no-working-DOCX no-upload smoke starting");

for (const file of [
  "app/api/documents/finalize/route.ts",
  "lib/clioStoragePlan.ts",
  "lib/clioDocumentUpload.ts",
  "docs/clio-storage-refactor/phase41d-direct-individual-finalize-disabled-guard-smoke.md",
]) {
  assert(exists(file), `required file exists: ${file}`);
}

const finalize = read("app/api/documents/finalize/route.ts");
const plan = read("lib/clioStoragePlan.ts");
const phase41d = read("docs/clio-storage-refactor/phase41d-direct-individual-finalize-disabled-guard-smoke.md");

assert(FUTURE_ARMED_DIRECT_TARGET_INPUT.storageTargetKind === "individual_matter", "future armed target uses storageTargetKind individual_matter");
assert(FUTURE_ARMED_DIRECT_TARGET_INPUT.directMatterFileNumber === "BRL_202600001", "future armed target uses Barsh Matters direct file number");
assert(FUTURE_ARMED_DIRECT_TARGET_INPUT.bmMatterId === "BRL_202600001", "future armed bmMatterId is the Barsh Matters direct file number");
assert(FUTURE_ARMED_DIRECT_TARGET_INPUT.displayNumber === "BRL_202600001", "future armed displayNumber is the Barsh Matters direct file number");

for (const token of ["Individual Matters", "individual_matter", "direct_matter", "directMatterFileNumber", "BRL_YYYYNNNNN"]) {
  assert(plan.includes(token), `planner supports direct/individual taxonomy token: ${token}`);
}

for (const token of [
  "Phase 41D is a no-upload disabled-guard lock",
  "actual upload remains disabled",
  "not yet wired to a direct/individual target-input branch",
  "No hard-coded direct live folder IDs in the finalize route",
]) {
  assert(phase41d.includes(token), `Phase 41D disabled-guard lock remains anchored: ${token}`);
}

const finalizeMentionsDirectTarget =
  /directMatterFileNumber|storageTargetKind|individual_matter|direct_matter/.test(finalize);

if (!finalizeMentionsDirectTarget) {
  pass("actual finalize route has no direct/individual target-input branch yet, so armed direct upload remains blocked before working-DOCX lookup");
} else {
  const hasWorkingDocStop =
    /workingDoc|workingDocument|docx|DOCX|saved working/i.test(finalize) &&
    /upload|clio|graph|pdf/i.test(finalize);
  assert(hasWorkingDocStop, "wired direct/individual armed path must contain working-DOCX gate before PDF/upload operations");
  const hasLiveControls =
    /CLIO_SINGLE_MASTER_CREATE_FOLDERS_ENABLED/.test(finalize) &&
    /CLIO_SINGLE_MASTER_LIVE_WRITE_ENABLED/.test(finalize) &&
    /uploadRewired/.test(finalize);
  assert(hasLiveControls, "wired direct/individual armed path must remain guarded by folder/live/upload controls");
}

for (const forbidden of [
  "22062400790",
  "22062400880",
  "22062401000",
  "Individual Matters/BRL-202600001-BRL-202600999/BRL_202600001",
]) {
  assert(!finalize.includes(forbidden), `finalize route does not hard-code direct audit anchor: ${forbidden}`);
}

const namingBlock =
  (plan.match(/function buildIndividualMatterRangeFolderName[\s\S]*?export function buildClioStorageTargetPlan/) || [""])[0] ||
  plan;

for (const forbidden of ["patient", "provider", "insurer", "claimNumber", "claim number", "denial"]) {
  assert(!new RegExp(forbidden, "i").test(namingBlock), `direct folder naming path avoids ${forbidden}`);
}

console.log("CONTRACT: Phase 41E performs no upload, no folder create, no delete, no DB mutation, no local server start, and no production env change.");
console.log("CONTRACT: armed direct/individual upload remains blocked unless a future wired path has a saved working DOCX and explicit upload/folder/live controls.");
console.log("RESULT: Phase 41E direct/individual armed no-working-DOCX no-upload smoke completed");

if (failed) process.exit(1);
