const fs = require("fs");
const path = require("path");

let failed = false;
const pass = (m) => console.log("PASS: " + m);
const fail = (m) => { failed = true; console.error("FAIL: " + m); };
const read = (p) => fs.readFileSync(path.join(process.cwd(), p), "utf8");
const exists = (p) => fs.existsSync(path.join(process.cwd(), p));
const contains = (label, text, token) => text.includes(token) ? pass(label) : fail(label + " missing token: " + token);
const notContains = (label, text, token) => !text.includes(token) ? pass(label) : fail(label + " contains forbidden token: " + token);

const docPath = "docs/clio-storage-refactor/phase44c-server-side-direct-live-finalize-admin-guard.md";
for (const f of [
  docPath,
  "app/api/documents/finalize/route.ts",
  "app/matters/page.tsx",
  "lib/adminAuth.ts",
  "package.json",
]) {
  exists(f) ? pass("required Phase 44C file exists: " + f) : fail("missing required Phase 44C file: " + f);
}

const doc = read(docPath);
const route = read("app/api/documents/finalize/route.ts");
const page = read("app/matters/page.tsx");
const adminAuth = read("lib/adminAuth.ts");
const pkg = JSON.parse(read("package.json"));

for (const token of [
  "Phase 44C",
  "Server-Side Direct Live Finalize Admin Guard",
  "does not expose a live UI button",
  "does not run a live upload smoke",
  "uploadTargetMode === \"direct-matter\"",
  "confirmUpload === true",
  "singleMasterDryRun !== true",
  "valid admin session",
  "dry-run direct finalize remains allowed",
  "no document is uploaded"
]) contains("doc contains " + token, doc, token);

for (const token of [
  "isAdminRequestAuthorized",
  "adminUnauthorizedJson",
  "isDirectMatterLiveFinalizeRequest",
  "uploadTargetMode === \"direct-matter\"",
  "confirmUpload === true",
  "singleMasterDryRun !== true",
  "adminUnauthorizedJson(403)",
  "useDirectFinalizePreview",
  "singleMasterDryRun",
  "uploadBufferToClioMatterDocuments("
]) contains("finalize route contains server-side direct live guard token " + token, route, token);

const guardIndex = route.indexOf("isDirectMatterLiveFinalizeRequest");
const uploadIndex = route.indexOf("uploadBufferToClioMatterDocuments(");
if (guardIndex >= 0 && uploadIndex >= 0 && guardIndex < uploadIndex) pass("server-side direct live guard appears before upload helper call");
else fail("server-side direct live guard does not appear before upload helper call");

const guardBlockStart = Math.max(0, route.indexOf("const isDirectMatterLiveFinalizeRequest") - 400);
const guardBlockEnd = route.indexOf("uploadBufferToClioMatterDocuments(", guardBlockStart);
const guardBlock = guardBlockEnd > guardBlockStart ? route.slice(guardBlockStart, guardBlockEnd) : "";
contains("guard block captured", guardBlock, "isDirectMatterLiveFinalizeRequest");
contains("guard block gates direct-matter target", guardBlock, "uploadTargetMode === \"direct-matter\"");
contains("guard block gates live confirmUpload", guardBlock, "confirmUpload === true");
contains("guard block excludes dry-run", guardBlock, "singleMasterDryRun !== true");
contains("guard block checks admin session", guardBlock, "isAdminRequestAuthorized");
contains("guard block returns unauthorized json", guardBlock, "adminUnauthorizedJson(403)");

for (const token of [
  "export function isAdminRequestAuthorized",
  "export function adminUnauthorizedJson",
  "ADMIN_COOKIE_NAME",
  "ADMIN_SESSION_INACTIVITY_TIMEOUT_SECONDS"
]) contains("adminAuth retains required auth primitive " + token, adminAuth, token);

for (const token of [
  "directMatterSingleMasterDryRunControlEnabled = false",
  "confirmUpload: false",
  "singleMasterDryRun: true",
  "if (!selectedDocumentKey || !workingDocumentDriveItemId || !workingDocumentKey) return null",
  "allowDuplicateUploads: false"
]) contains("matters page still keeps live UI off and prerequisites intact " + token, page, token);

const controlStart = page.indexOf("function renderDirectMatterSingleMasterDryRunControl");
const controlEnd = page.indexOf("function directMatterSingleMasterDryRunSurfaceRow", controlStart);
const controlBlock = controlStart >= 0 && controlEnd > controlStart ? page.slice(controlStart, controlEnd) : "";
notContains("direct UI control still does not expose direct confirmUpload true", controlBlock, "confirmUpload: true");

contains("package Phase 44C verifier registered", JSON.stringify(pkg.scripts || {}), "verify:phase44c-server-side-direct-live-finalize-admin-guard-safety");
notContains("package does not register Phase 44C live smoke", JSON.stringify(pkg.scripts || {}), "smoke:phase44c-live");

console.log("CONTRACT: Phase 44C adds server-side admin guard for direct live finalize; no live UI/upload is enabled.");
console.log("RESULT: Phase 44C server-side direct live finalize admin guard verifier");
if (failed) process.exit(1);
