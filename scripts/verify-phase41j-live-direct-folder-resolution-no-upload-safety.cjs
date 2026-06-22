const fs = require("fs");
const path = require("path");
let failed = false;
const pass = (m) => console.log("PASS: " + m);
const fail = (m) => { failed = true; console.error("FAIL: " + m); };
const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const exists = (p) => fs.existsSync(path.join(root, p));
function contains(label, text, token) { text.includes(token) ? pass(label) : fail(label + " missing token: " + token); }
function notContains(label, text, token) { !text.includes(token) ? pass(label) : fail(label + " contains forbidden token: " + token); }
const docPath = "docs/clio-storage-refactor/phase41j-live-direct-folder-resolution-no-upload.md";
const smokePath = "scripts/smoke-phase41j-live-direct-folder-resolution-no-upload.cjs";
for (const f of [docPath, smokePath, "app/api/documents/finalize/route.ts", "lib/clioFolderResolverExecutor.ts", "lib/clioStorageWriteGuard.ts", "package.json"]) { exists(f) ? pass("required Phase 41J file exists: " + f) : fail("missing required Phase 41J file: " + f); }
const doc = exists(docPath) ? read(docPath) : "";
const smoke = exists(smokePath) ? read(smokePath) : "";
const finalize = read("app/api/documents/finalize/route.ts");
const resolver = read("lib/clioFolderResolverExecutor.ts");
const guard = read("lib/clioStorageWriteGuard.ts");
const pkg = JSON.parse(read("package.json"));
for (const token of ["Phase 41J", "read/lookup", "not a live upload", "singleMasterResolveFolders: true", "guarded-live-folder-resolution-no-upload", "createdFolderCount: 0", "folderId: 22062401000", "must not upload documents"]) contains("doc contains " + token, doc, token);
for (const token of ["singleMasterResolveFolders: true", "CLIO_DIRECT_INDIVIDUAL_FINALIZE_TARGET_INPUT_ENABLED: \"1\"", "CLIO_SINGLE_MASTER_UPLOAD_REWIRE_ENABLED: \"0\"", "CLIO_SINGLE_MASTER_CREATE_FOLDERS_ENABLED: \"0\"", "CLIO_SINGLE_MASTER_LIVE_WRITE_ENABLED: \"0\"", "folderResolutionMode === \"guarded-live-folder-resolution-no-upload\"", "fr.folderId === EXPECTED_FINAL_ID", "fr.createdFolderCount === 0", "!createdAny"]) contains("smoke contains " + token, smoke, token);
for (const forbidden of ["CLIO_SINGLE_MASTER_UPLOAD_REWIRE_ENABLED: \"1\"", "CLIO_SINGLE_MASTER_CREATE_FOLDERS_ENABLED: \"1\"", "CLIO_SINGLE_MASTER_LIVE_WRITE_ENABLED: \"1\"", "confirmUpload: true", "singleMasterDryRun: false"]) notContains("smoke does not arm writes", smoke, forbidden);
for (const token of ["singleMasterResolveFolders", "resolveClioMatterFolderWithGuard(singleMasterTargetInput)", "uploadRewired: false", "databaseMutation: false", "noUploadPerformed: true", "guarded-live-folder-resolution-no-upload"]) contains("finalize route keeps no-upload folder-resolution token " + token, finalize, token);
for (const token of ["Duplicate child folders named", "createdFolderCount", "reusedFolderCount", "findExactClioChildFolderByNameWithGuard"]) contains("resolver preserves exact-child reuse safety " + token, resolver, token);
for (const token of ["CLIO_SINGLE_MASTER_CREATE_FOLDERS_ENABLED", "CLIO_SINGLE_MASTER_LIVE_WRITE_ENABLED"]) contains("write guard still requires " + token, guard, token);
contains("package Phase 41J smoke registered", JSON.stringify(pkg.scripts || {}), "smoke:phase41j-live-direct-folder-resolution-no-upload");
contains("package Phase 41J verifier registered", JSON.stringify(pkg.scripts || {}), "verify:phase41j-live-direct-folder-resolution-no-upload-safety");
console.log("CONTRACT: Phase 41J is live folder lookup only, not live upload.");
console.log("RESULT: Phase 41J live direct folder-resolution no-upload safety verifier");
if (failed) process.exit(1);
