const fs = require("fs");

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

function pass(message) {
  console.log(`PASS: ${message}`);
}

function read(file) {
  if (!fs.existsSync(file)) fail(`required Phase 44I file missing: ${file}`);
  pass(`required Phase 44I file exists: ${file}`);
  return fs.readFileSync(file, "utf8");
}

function contains(label, text, token) {
  if (!text.includes(token)) fail(`${label} missing token: ${token}`);
  pass(`${label} contains ${token}`);
}

const doc = read("docs/clio-storage-refactor/phase44i-server-side-direct-live-env-kill-switch.md");
const route = read("app/api/documents/finalize/route.ts");
const matters = read("app/matters/page.tsx");
const pkgText = read("package.json");

[
  "Phase 44I",
  "Server-Side Direct Live Finalize Env Kill Switch",
  "BARSH_DIRECT_MATTER_CLIO_LIVE_FINALIZE_ENABLED=1",
  "NEXT_PUBLIC_BARSH_DIRECT_MATTER_CLIO_LIVE_FINALIZE_ENABLED=1",
  "isDirectMatterLiveFinalizeRequest",
  "uploadTargetMode === \"direct-matter\"",
  "confirmUpload === true",
  "singleMasterDryRun !== true",
  "does not run a live smoke",
  "does not upload a document",
  "admin authorization guard remains required",
  "must not include `masterLawsuitId`",
].forEach((token) => contains("doc", doc, token));

[
  "const isDirectMatterLiveFinalizeRequest",
  "directMatterLiveFinalizeServerEnabled",
  "BARSH_DIRECT_MATTER_CLIO_LIVE_FINALIZE_ENABLED",
  "String(process.env.BARSH_DIRECT_MATTER_CLIO_LIVE_FINALIZE_ENABLED || \"\").trim() === \"1\"",
  "if (isDirectMatterLiveFinalizeRequest && !directMatterLiveFinalizeServerEnabled)",
  "direct-live-server-kill-switch",
  "serverLiveFinalizeEnabled: false",
  "!isAdminRequestAuthorized(req as any)",
  "uploadBufferToClioMatterDocuments(",
].forEach((token) => contains("finalize route", route, token));

const directDefIdx = route.indexOf("const isDirectMatterLiveFinalizeRequest");
const directDefEnd = route.indexOf(";", directDefIdx);
if (directDefIdx < 0 || directDefEnd < 0) fail("direct live detector definition not found");
const directDefBlock = route.slice(directDefIdx, directDefEnd + 1);
[
  "uploadTargetMode === \"direct-matter\"",
  "confirmUpload === true",
  "singleMasterDryRun !== true",
].forEach((token) => contains("direct live detector definition", directDefBlock, token));

const serverFlagIdx = route.indexOf("directMatterLiveFinalizeServerEnabled");
const envGuardIdx = route.indexOf("!directMatterLiveFinalizeServerEnabled");
const adminGuardIdx = route.indexOf("!isAdminRequestAuthorized(req as any)");
const uploadIdx = route.indexOf("uploadBufferToClioMatterDocuments(");
if (serverFlagIdx < 0 || envGuardIdx < 0 || adminGuardIdx < 0 || uploadIdx < 0) fail("required guard/upload indexes not found");
if (!(directDefIdx < serverFlagIdx && serverFlagIdx < envGuardIdx && envGuardIdx < adminGuardIdx && adminGuardIdx < uploadIdx)) {
  fail("expected guard order is direct-live detector, server flag definition, env kill switch, admin guard, upload helper");
}
pass("guard order is direct-live detector, server flag definition, env kill switch, admin guard, upload helper");

const envGuardStart = route.lastIndexOf("if (", envGuardIdx);
const envGuardEnd = route.indexOf("}", envGuardIdx);
const envGuardBlock = route.slice(envGuardStart, envGuardEnd + 1);
[
  "isDirectMatterLiveFinalizeRequest",
  "!directMatterLiveFinalizeServerEnabled",
  "direct-live-server-kill-switch",
  "serverLiveFinalizeEnabled: false",
].forEach((token) => contains("server env kill switch block", envGuardBlock, token));

const adminGuardStart = route.lastIndexOf("if (", adminGuardIdx);
const adminGuardEnd = route.indexOf("}", adminGuardIdx);
const adminGuardBlock = route.slice(adminGuardStart, adminGuardEnd + 1);
[
  "isDirectMatterLiveFinalizeRequest",
  "!isAdminRequestAuthorized(req as any)",
  "adminUnauthorizedJson(403)",
].forEach((token) => contains("admin guard block", adminGuardBlock, token));

[
  "directMatterSingleMasterLiveFinalizeControlEnabled",
  "NEXT_PUBLIC_BARSH_DIRECT_MATTER_CLIO_LIVE_FINALIZE_ENABLED",
  "uiOriginatedDirectMatterLiveFinalize: true",
  "Admin Finalize Direct Matter to Clio",
  "confirmUpload: true",
  "singleMasterDryRun: false",
  "allowDuplicateUploads: false",
  "if (!selectedDocumentKey || !workingDocumentDriveItemId || !workingDocumentKey) return null",
].forEach((token) => contains("matters page Phase 44D UI gate", matters, token));

const liveControlIdx = matters.indexOf("renderDirectMatterSingleMasterLiveFinalizeControl");
const liveHandlerIdx = matters.indexOf("handleDirectMatterSingleMasterLiveFinalizeControl");
const livePayloadIdx = matters.indexOf("uiOriginatedDirectMatterLiveFinalize: true");
if (liveControlIdx < 0) fail("live direct control renderer not located");
if (liveHandlerIdx < 0) fail("live direct control handler not located");
if (livePayloadIdx < 0) fail("live direct payload marker not located");

[
  'uploadTargetMode: "direct-matter"',
  "confirmUpload: true",
  "singleMasterDryRun: false",
  "singleMasterResolveFolders: true",
  "allowDuplicateUploads: false",
  "uiOriginatedDirectMatterLiveFinalize: true",
].forEach((token) => contains("matters page direct live payload token", matters, token));

// Phase 44I is intentionally scoped to the server-side direct-live kill switch.
// Phase 44D owns the detailed direct UI payload-structure verifier, including
// the direct/live payload and master-lawsuit separation checks.
pass("direct UI payload structure remains delegated to the Phase 44D verifier");

const pkg = JSON.parse(pkgText);
if (!pkg.scripts || !pkg.scripts["verify:phase44i-server-side-direct-live-env-kill-switch-safety"]) {
  fail("package Phase 44I verifier script not registered");
}
pass("package Phase 44I verifier registered");
if (Object.keys(pkg.scripts).some((name) => /phase44i/i.test(name) && /smoke/i.test(name))) {
  fail("Phase 44I must not register a smoke script");
}
pass("package does not register Phase 44I smoke");

console.log("CONTRACT: Phase 44I adds server-side env kill switch for direct live finalize; no env value is set and no upload is run.");
console.log("RESULT: Phase 44I server-side direct live env kill switch verifier");
