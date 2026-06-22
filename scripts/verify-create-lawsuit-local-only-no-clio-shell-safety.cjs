const fs = require("fs");
const path = require("path");

let failed = false;
const pass = (m) => console.log("PASS: " + m);
const fail = (m) => { failed = true; console.error("FAIL: " + m); };

const createRoute = fs.readFileSync(path.join(process.cwd(), "app/api/lawsuits/local-generation-create/route.ts"), "utf8");
const previewRoute = fs.readFileSync(path.join(process.cwd(), "app/api/documents/clio-master-matter-preview/route.ts"), "utf8");
const confirmRoute = fs.readFileSync(path.join(process.cwd(), "app/api/documents/clio-master-matter-confirm/route.ts"), "utf8");

for (const forbidden of [
  'import { clioFetch }',
  "clioFetch(",
  "findClientFromChildClioMatters",
  "readClioMatterClient",
  "createClioMasterMatter",
  "No child Clio matter with a readable client was found",
  "Could not derive the Clio client",
  "/api/v4/matters.json",
  "writesClio: true",
  "createsClioMasterMatter: true",
  "clioRecordsChanged: true",
]) {
  if (!createRoute.includes(forbidden)) pass(`local create route excludes ${forbidden}`);
  else fail(`local create route still contains ${forbidden}`);
}

if (/(?:prisma|tx|db)\.lawsuit\.create\s*\(/.test(createRoute)) pass("local create route creates local Lawsuit record");
else fail("local create route missing local Lawsuit create call");

if (/(?:prisma|tx|db)\.claimIndex\.updateMany\s*\(/.test(createRoute)) pass("local create route links child ClaimIndex rows");
else fail("local create route missing ClaimIndex updateMany call");

for (const required of [
  'confirm=create-local-lawsuit',
  'clioMasterMatterId: null',
  'clioMasterDisplayNumber: null',
  'none-local-only-create-lawsuit',
  'writesClio: false',
  'createsClioMasterMatter: false',
]) {
  if (createRoute.includes(required)) pass(`local create route contains ${required}`);
  else fail(`local create route missing ${required}`);
}

for (const [label, route] of [["preview", previewRoute], ["confirm", confirmRoute]]) {
  if (route.includes("legacyClioOperationalRouteBlocked")) pass(`${label} Clio master-shell route is blocked`);
  else fail(`${label} Clio master-shell route is not blocked`);

  for (const forbidden of [
    "clioFetch(",
    "findClientFromChildClioMatters",
    "readClioMatterClient",
    "createClioMasterMatter",
    "No child Clio matter with a readable client was found",
    "/api/v4/matters.json",
  ]) {
    if (!route.includes(forbidden)) pass(`${label} route excludes ${forbidden}`);
    else fail(`${label} route still contains ${forbidden}`);
  }
}

console.log("RESULT: local-only Create Lawsuit and obsolete Clio master-shell block safety verifier");
if (failed) process.exit(1);
