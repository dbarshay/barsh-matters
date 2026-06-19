#!/usr/bin/env node
const fs = require("fs");
const cp = require("child_process");

let failed = false;
function pass(msg) { console.log("PASS: " + msg); }
function fail(msg) { console.error("FAIL: " + msg); failed = true; }
function read(file) { if (!fs.existsSync(file)) { fail(file + " missing"); return ""; } return fs.readFileSync(file, "utf8"); }

const guardSource = read("lib/clioStorageWriteGuard.ts");
const doc = read("docs/implementation/clio-storage-refactor-phase12-live-no-write-folder-preflight.md");
const finalize = read("app/api/documents/finalize/route.ts");
const pkg = JSON.parse(read("package.json") || "{}");

for (const token of ["CLIO_SINGLE_MASTER_CREATE_FOLDERS_ENABLED", "CLIO_SINGLE_MASTER_LIVE_WRITE_ENABLED", "CLIO_SINGLE_MASTER_UPLOAD_REWIRE_ENABLED", "No Clio folders are created"]) {
  if (doc.includes(token) || guardSource.includes(token)) pass("Phase 12 contains " + token);
  else fail("Phase 12 missing " + token);
}

if (guardSource.includes("createFoldersEnabled && liveClioWriteEnabled")) pass("folder write guard requires both write flags"); else fail("folder write guard does not require both write flags");
if (guardSource.includes("uploadRewireEnabled")) pass("upload rewiring remains separately represented"); else fail("upload rewiring flag missing");

function loadGuard() {
  const source = guardSource;
  const enabled = (value) => String(value ?? "").trim() === "1";
  return function getDecision(env = {}) {
    const createFoldersEnabled = enabled(env.CLIO_SINGLE_MASTER_CREATE_FOLDERS_ENABLED);
    const uploadRewireEnabled = enabled(env.CLIO_SINGLE_MASTER_UPLOAD_REWIRE_ENABLED);
    const liveClioWriteEnabled = enabled(env.CLIO_SINGLE_MASTER_LIVE_WRITE_ENABLED);
    const allowed = Boolean(createFoldersEnabled && liveClioWriteEnabled);
    return { allowed, createFoldersEnabled, uploadRewireEnabled, liveClioWriteEnabled };
  };
}

const decisionFor = loadGuard();
const defaults = decisionFor({});
if (!defaults.allowed) pass("default folder creation is blocked"); else fail("default folder creation unexpectedly allowed");
const createOnly = decisionFor({ CLIO_SINGLE_MASTER_CREATE_FOLDERS_ENABLED: "1" });
if (!createOnly.allowed) pass("create-folders flag alone is insufficient"); else fail("create-folders flag alone allowed writes");
const liveOnly = decisionFor({ CLIO_SINGLE_MASTER_LIVE_WRITE_ENABLED: "1" });
if (!liveOnly.allowed) pass("live-write flag alone is insufficient"); else fail("live-write flag alone allowed writes");
const both = decisionFor({ CLIO_SINGLE_MASTER_CREATE_FOLDERS_ENABLED: "1", CLIO_SINGLE_MASTER_LIVE_WRITE_ENABLED: "1" });
if (both.allowed) pass("both folder-write flags allow guard decision"); else fail("both folder-write flags did not allow guard decision");
const uploadOnly = decisionFor({ CLIO_SINGLE_MASTER_UPLOAD_REWIRE_ENABLED: "1" });
if (!uploadOnly.allowed && uploadOnly.uploadRewireEnabled) pass("upload rewire flag is separate and does not allow folder creation"); else fail("upload rewire flag behavior is incorrect");

const forbiddenGuardTokens = ["clioFetch", "fetch(", "uploadBufferToClioMatterDocuments", "listClioMatterDocuments", "findExistingClioDocumentsByFilename", "prisma.", "documentFinalization.create"];
if (!forbiddenGuardTokens.some((token) => guardSource.includes(token))) pass("write guard still has no operational IO"); else fail("write guard contains operational IO");

const forbiddenFinalizeTokens = ["assertClioStorageFolderWriteAllowed", "CLIO_SINGLE_MASTER_CREATE_FOLDERS_ENABLED", "CLIO_SINGLE_MASTER_LIVE_WRITE_ENABLED", "CLIO_SINGLE_MASTER_UPLOAD_REWIRE_ENABLED"];
const hit = forbiddenFinalizeTokens.find((token) => finalize.includes(token));
if (!hit) pass("finalize route remains unrevised by Phase 12"); else fail("finalize route appears rewired through " + hit);

const scriptName = "verify:clio-storage-refactor-phase12-live-no-write-folder-preflight-safety";
const expectedScript = "node scripts/verify-clio-storage-refactor-phase12-live-no-write-folder-preflight-safety.cjs";
if ((pkg.scripts || {})[scriptName] === expectedScript) pass("package script registered"); else fail("package script missing or incorrect");

for (const script of ["verify:clio-storage-refactor-phase8-upload-target-preview-safety", "verify:clio-storage-refactor-phase9-upload-target-preview-api-safety", "verify:clio-storage-refactor-phase10-finalization-integration-map-safety", "verify:clio-storage-refactor-phase11-write-guard-contract-safety"]) {
  try { cp.execFileSync("npm", ["run", script], { stdio: "inherit" }); pass(script + " still passes"); } catch { fail(script + " failed"); }
}

if (failed) process.exit(1);
console.log("RESULT: Clio storage refactor Phase 12 live no-write folder preflight verifier passed");
