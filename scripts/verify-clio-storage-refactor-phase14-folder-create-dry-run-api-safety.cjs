#!/usr/bin/env node
const fs = require("fs");
const cp = require("child_process");

let failed = false;
function pass(msg) { console.log("PASS: " + msg); }
function fail(msg) { console.error("FAIL: " + msg); failed = true; }
function read(file) { if (!fs.existsSync(file)) { fail(file + " missing"); return ""; } return fs.readFileSync(file, "utf8"); }

const route = read("app/api/documents/clio-folder-create-dry-run-plan/route.ts");
const doc = read("docs/implementation/clio-storage-refactor-phase14-folder-create-dry-run-api.md");
const finalize = read("app/api/documents/finalize/route.ts");
const pkg = JSON.parse(read("package.json") || "{}");

for (const token of ["buildClioFolderCreateDryRunPlan", "clio-folder-create-dry-run-plan", "previewOnly: true", "dryRunOnly: true", "callsClio: false", "createsFolders: false", "uploadsDocuments: false", "mutatesDatabase: false", "finalizeRouteRewired: false"]) {
  if (route.includes(token) || doc.includes(token)) pass("Phase 14 contains " + token);
  else fail("Phase 14 missing " + token);
}

if (route.includes("export async function GET") && !route.includes("export async function POST") && !route.includes("export async function PUT") && !route.includes("export async function PATCH") && !route.includes("export async function DELETE")) pass("Phase 14 route is GET-only"); else fail("Phase 14 route is not GET-only");

const forbiddenRouteTokens = ["clioFetch", "fetch(", "uploadBufferToClioMatterDocuments", "listClioMatterDocuments", "findExistingClioDocumentsByFilename", "prisma.", "documentFinalization.create", "method: \"POST\""];
if (!forbiddenRouteTokens.some((token) => route.includes(token))) pass("Phase 14 route has no Clio/database/document IO"); else fail("Phase 14 route contains operational IO");

const forbiddenFinalizeTokens = ["buildClioFolderCreateDryRunPlan", "clio-folder-create-dry-run-plan", "assertClioStorageFolderWriteAllowed", "CLIO_SINGLE_MASTER_CREATE_FOLDERS_ENABLED", "CLIO_SINGLE_MASTER_LIVE_WRITE_ENABLED"];
const hit = forbiddenFinalizeTokens.find((token) => finalize.includes(token));
if (!hit) pass("finalize route remains unrevised by Phase 14"); else fail("finalize route appears rewired through " + hit);

const scriptName = "verify:clio-storage-refactor-phase14-folder-create-dry-run-api-safety";
const expectedScript = "node scripts/verify-clio-storage-refactor-phase14-folder-create-dry-run-api-safety.cjs";
if ((pkg.scripts || {})[scriptName] === expectedScript) pass("package script registered"); else fail("package script missing or incorrect");

for (const script of ["verify:clio-storage-refactor-phase8-upload-target-preview-safety", "verify:clio-storage-refactor-phase9-upload-target-preview-api-safety", "verify:clio-storage-refactor-phase10-finalization-integration-map-safety", "verify:clio-storage-refactor-phase11-write-guard-contract-safety", "verify:clio-storage-refactor-phase12-live-no-write-folder-preflight-safety", "verify:clio-storage-refactor-phase13-folder-create-dry-run-plan-safety"]) {
  try { cp.execFileSync("npm", ["run", script], { stdio: "inherit" }); pass(script + " still passes"); } catch { fail(script + " failed"); }
}

if (failed) process.exit(1);
console.log("RESULT: Clio storage refactor Phase 14 folder-create dry-run API verifier passed");
