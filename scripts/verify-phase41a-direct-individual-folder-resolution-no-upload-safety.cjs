const fs = require("fs");
const path = require("path");
let failed = false;
const pass = (m) => console.log("PASS: " + m);
const fail = (m) => { failed = true; console.error("FAIL: " + m); };
const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const exists = (p) => fs.existsSync(path.join(root, p));
const smokePath = "scripts/smoke-phase41a-direct-individual-folder-resolution-no-upload.cjs";
const smoke = read(smokePath);
const pkg = JSON.parse(read("package.json"));
const planner = read("lib/clioStoragePlan.ts");

function contains(label, text, token) { text.includes(token) ? pass(label) : fail(label + " missing token: " + token); }
function notContains(label, text, token) { !text.includes(token) ? pass(label) : fail(label + " contains forbidden token: " + token); }

contains("smoke is planner-only contract", smoke, "planner-only proof");
contains("smoke requires no local server", smoke, "No local server");
contains("smoke targets Individual Matters root", smoke, "Individual Matters");
contains("smoke targets BRL range bucket", smoke, "BRL-202600001-BRL-202600999");
contains("smoke targets BRL underscore direct matter id", smoke, "BRL_202600001");
contains("smoke reuses Phase 34K direct planner taxonomy smoke", smoke, "smoke-phase34k-direct-matter-planner-taxonomy.cjs");
contains("smoke checks no upload", smoke, "PHASE41A_UPLOAD_PERFORMED=false");
contains("smoke checks no Clio write", smoke, "PHASE41A_CLIO_WRITE_PERFORMED=false");
contains("smoke checks no database mutation", smoke, "PHASE41A_DATABASE_MUTATION=false");
notContains("smoke does not send confirmUpload true", smoke, "confirmUpload: true");
notContains("smoke does not upload bytes", smoke, 'method: "PUT"');
notContains("smoke does not call documents endpoint", smoke, "documents.json");
notContains("smoke does not delete test artifact", smoke, "DELETE");

contains("planner has Individual Matters taxonomy", planner, "Individual Matters");
contains("planner has individual_matter target kind", planner, "individual_matter");
contains("planner has direct_matter alias target kind", planner, "direct_matter");
contains("planner has BRL range bucket support", planner, "BRL-");
contains("planner has underscore BRL individual final folder support", planner, "BRL_");
contains("planner has direct matter file number input", planner, "directMatterFileNumber");
contains("planner has BRL_YYYYNNNNN format guard", planner, "BRL_YYYYNNNNN");

if (exists(smokePath)) pass("Phase 41A smoke file exists"); else fail("Phase 41A smoke file missing");
if (pkg.scripts && pkg.scripts["verify:phase41a-direct-individual-folder-resolution-no-upload-safety"] === "node scripts/verify-phase41a-direct-individual-folder-resolution-no-upload-safety.cjs") pass("package verifier script registered"); else fail("package verifier script missing");
if (pkg.scripts && pkg.scripts["smoke:phase41a-direct-individual-folder-resolution-no-upload"] === "node scripts/smoke-phase41a-direct-individual-folder-resolution-no-upload.cjs") pass("package smoke script registered"); else fail("package smoke script missing");

console.log("RESULT: Phase 41A direct/individual planner no-upload safety verifier");
if (failed) process.exit(1);
