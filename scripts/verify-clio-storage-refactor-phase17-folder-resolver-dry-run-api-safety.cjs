#!/usr/bin/env node
const fs = require("fs");

let failed = false;
function pass(msg) { console.log("PASS: " + msg); }
function fail(msg) { console.error("FAIL: " + msg); failed = true; }
function read(file) { if (!fs.existsSync(file)) { fail(file + " missing"); return ""; } return fs.readFileSync(file, "utf8"); }

const route = read("app/api/documents/clio-folder-resolver-dry-run/route.ts");
const resolver = read("lib/clioFolderResolverExecutor.ts");
const doc = read("docs/implementation/clio-storage-refactor-phase17-folder-resolver-dry-run-api.md");
const finalize = read("app/api/documents/finalize/route.ts");
const pkg = JSON.parse(read("package.json") || "{}");

for (const token of ["buildClioFolderCreateDryRunPlan", "clio-folder-resolver-dry-run", "dryRunOnly: true", "callsResolverExecutor: false", "callsClio: false", "createsFolders: false", "uploadsDocuments: false", "mutatesDatabase: false", "finalizeRouteRewired: false"]) {
  if (route.includes(token) || doc.includes(token)) pass("Phase 17 contains " + token);
  else fail("Phase 17 missing " + token);
}

if (route.includes("export async function GET") && !route.includes("export async function POST") && !route.includes("export async function PUT") && !route.includes("export async function PATCH") && !route.includes("export async function DELETE")) pass("Phase 17 route is GET-only"); else fail("Phase 17 route is not GET-only");
if (resolver.includes("resolveClioMatterFolderWithGuard")) pass("Phase 16 resolver remains present"); else fail("Phase 16 resolver missing");
if (!route.includes("resolveClioMatterFolderWithGuard") && !route.includes("clioFolderResolverExecutor") && !route.includes("createClioFolderWithGuard") && !route.includes("clioFetch") && !route.includes("fetch(") && !route.includes("prisma.")) pass("Phase 17 route has no live resolver/Clio/database IO"); else fail("Phase 17 route appears operational");
if (!finalize.includes("resolveClioMatterFolderWithGuard") && !finalize.includes("clio-folder-resolver-dry-run") && !finalize.includes("createClioFolderWithGuard")) pass("finalize route remains unrevised by Phase 17"); else fail("finalize route appears rewired by Phase 17");

const scriptName = "verify:clio-storage-refactor-phase17-folder-resolver-dry-run-api-safety";
const expectedScript = "node scripts/verify-clio-storage-refactor-phase17-folder-resolver-dry-run-api-safety.cjs";
if ((pkg.scripts || {})[scriptName] === expectedScript) pass("package script registered"); else fail("package script missing or incorrect");

if (failed) process.exit(1);
console.log("RESULT: Clio storage refactor Phase 17 folder resolver dry-run API verifier passed");
