const fs = require("fs");
const path = require("path");
let failed = false;
const pass = (m) => console.log("PASS: " + m);
const fail = (m) => { failed = true; console.error("FAIL: " + m); };
const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const exists = (p) => fs.existsSync(path.join(root, p));
const smokePath = "scripts/smoke-phase41b-live-direct-individual-exact-child-reuse-no-upload.cjs";
const smoke = read(smokePath);
const pkg = JSON.parse(read("package.json"));
const planner = read("lib/clioStoragePlan.ts");
const resolver = read("lib/clioFolderResolverExecutor.ts");

function contains(label, text, token) { text.includes(token) ? pass(label) : fail(label + " missing token: " + token); }
function notContains(label, text, token) { !text.includes(token) ? pass(label) : fail(label + " contains forbidden token: " + token); }

contains("smoke is read-only exact-child lookup", smoke, "read-only live Clio folder lookup only");
contains("smoke refuses duplicates by exact-one assertion", smoke, "matches.length === 1");
contains("smoke targets Individual Matters path", smoke, "Individual Matters/BRL-202600001-BRL-202600999/BRL_202600001");
contains("smoke expects original Individual Matters folder id", smoke, "22062400790");
contains("smoke expects original range bucket folder id", smoke, "22062400880");
contains("smoke expects original final direct folder id", smoke, "22062401000");
contains("smoke lists child folders by matter_id and parent_id", smoke, "matter_id=${MASTER_MATTER_ID}&parent_id=");
contains("smoke checks no created folders", smoke, "PHASE41B_CREATED_FOLDER_COUNT=0");
contains("smoke checks no upload", smoke, "PHASE41B_UPLOAD_PERFORMED=false");
contains("smoke checks no DB mutation", smoke, "PHASE41B_DATABASE_MUTATION=false");
contains("smoke permits OAuth token POST only", smoke, "/oauth/token");
notContains("smoke does not POST Clio folders endpoint", smoke, '/folders.json", {');
notContains("smoke does not upload bytes", smoke, 'method: "PUT"');
notContains("smoke does not delete artifact", smoke, 'method: "DELETE"');
notContains("smoke does not call finalize", smoke, "/api/documents/finalize");
contains("planner has Individual Matters taxonomy", planner, "Individual Matters");
contains("planner has direct matter file number input", planner, "directMatterFileNumber");
contains("smoke performs exact-child filtering by name", smoke, "children.filter");
contains("smoke refuses duplicate exact child folders", smoke, "matches.length === 1");
contains("smoke lists Clio folders read-only", smoke, "folders.json?matter_id=");
contains("planner and existing resolver remain available", resolver, "folders.json");

if (exists(smokePath)) pass("Phase 41B exact-child smoke file exists"); else fail("Phase 41B exact-child smoke file missing");
if (pkg.scripts && pkg.scripts["verify:phase41b-live-direct-individual-exact-child-reuse-no-upload-safety"] === "node scripts/verify-phase41b-live-direct-individual-exact-child-reuse-no-upload-safety.cjs") pass("package verifier script registered"); else fail("package verifier script missing");
if (pkg.scripts && pkg.scripts["smoke:phase41b-live-direct-individual-exact-child-reuse-no-upload"] === "node scripts/smoke-phase41b-live-direct-individual-exact-child-reuse-no-upload.cjs") pass("package smoke script registered"); else fail("package smoke script missing");

console.log("RESULT: Phase 41B live direct/individual exact-child reuse no-upload safety verifier");
if (failed) process.exit(1);
