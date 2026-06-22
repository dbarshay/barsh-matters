const { spawnSync } = require("child_process");
const fs = require("fs");

const EXPECTED_PATH = "Individual Matters/BRL-202600001-BRL-202600999/BRL_202600001";
const EXPECTED_ROOT = "Individual Matters";
const EXPECTED_BUCKET = "BRL-202600001-BRL-202600999";
const EXPECTED_FINAL = "BRL_202600001";

function assert(condition, message) {
  if (!condition) throw new Error(message);
  console.log(`PASS: ${message}`);
}

console.log("RESULT: Phase 41A direct/individual planner no-upload smoke starting");
console.log("CONTRACT: planner-only proof. No local server, no Clio API call, no upload, no DB mutation.");

assert(fs.existsSync("lib/clioStoragePlan.ts"), "planner source exists");
assert(fs.existsSync("scripts/smoke-phase34k-direct-matter-planner-taxonomy.cjs"), "Phase 34K direct planner taxonomy smoke exists");

const planner = fs.readFileSync("lib/clioStoragePlan.ts", "utf8");
assert(planner.includes("Individual Matters"), "planner contains Individual Matters root taxonomy");
assert(planner.includes("BRL_YYYYNNNNN"), "planner documents BRL_YYYYNNNNN direct matter format");
assert(planner.includes("buildIndividualMatterRangeFolderName"), "planner contains individual matter range bucket builder");
assert(planner.includes("storageTargetKind"), "planner accepts storageTargetKind");
assert(planner.includes("directMatterFileNumber"), "planner accepts directMatterFileNumber");
assert(!/patient|provider|insurer|claimNumber|claim number/i.test((planner.match(/function buildIndividualMatterRangeFolderName[\s\S]*?export function buildClioStorageTargetPlan/) || [""])[0]), "individual folder naming path avoids patient/provider/insurer/claim facts");

const result = spawnSync("node", ["scripts/smoke-phase34k-direct-matter-planner-taxonomy.cjs"], {
  cwd: process.cwd(),
  encoding: "utf8",
  env: {
    ...process.env,
    CLIO_STORAGE_MODE: "single_master_matter",
    CLIO_MASTER_MATTER_ID: "1885821245",
    CLIO_MASTER_MATTER_NAME: "Barsh Matters Master Repository",
    CLIO_BUCKET_SIZE: "1000"
  }
});

process.stdout.write(result.stdout || "");
process.stderr.write(result.stderr || "");
assert(result.status === 0, "Phase 34K direct matter planner taxonomy smoke passed");

const combined = `${result.stdout || ""}\n${result.stderr || ""}`;
assert(combined.includes(EXPECTED_ROOT), "smoke output confirms Individual Matters root");
assert(combined.includes(EXPECTED_BUCKET), "smoke output confirms BRL range bucket");
assert(combined.includes(EXPECTED_FINAL), "smoke output confirms BRL underscore final folder");
assert(combined.includes(EXPECTED_PATH), "smoke output confirms full direct/individual path");

console.log("PHASE41A_DIRECT_PATH=" + EXPECTED_PATH);
console.log("PHASE41A_UPLOAD_PERFORMED=false");
console.log("PHASE41A_CLIO_WRITE_PERFORMED=false");
console.log("PHASE41A_DATABASE_MUTATION=false");
console.log("RESULT: Phase 41A direct/individual planner no-upload smoke passed");
