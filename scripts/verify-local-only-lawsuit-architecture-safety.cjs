const fs = require("fs");
const path = require("path");

let failed = false;
const pass = (m) => console.log("PASS: " + m);
const fail = (m) => { failed = true; console.error("FAIL: " + m); };

const root = process.cwd();
const activeRoots = ["app", "lib"];
const skipDirs = new Set(["node_modules", ".next", ".git"]);
const activeExt = new Set([".ts", ".tsx", ".js", ".jsx"]);

function walk(dir, files = []) {
  if (!fs.existsSync(path.join(root, dir))) return files;
  for (const ent of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    if (skipDirs.has(ent.name)) continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, files);
    else if (activeExt.has(path.extname(ent.name))) files.push(p);
  }
  return files;
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function lineFor(text, idx) {
  return text.slice(0, idx).split(/\r?\n/).length;
}

const forbiddenRouteFiles = [
  "app/api/lawsuits/local-generation-create/route.ts",
  "app/api/documents/clio-master-matter-preview/route.ts",
  "app/api/documents/clio-master-matter-confirm/route.ts",
];

for (const rel of forbiddenRouteFiles) {
  const text = read(rel);
  for (const forbidden of [
    "No child Clio matter with a readable client was found",
    "findClientFromChildClioMatters",
    "readClioMatterClient",
    "createClioMasterMatter",
    "/api/v4/matters.json",
    "createsClioMasterMatter: true",
    "writesClio: true",
    "clioRecordsChanged: true",
  ]) {
    if (!text.includes(forbidden)) pass(`${rel} excludes ${forbidden}`);
    else fail(`${rel} still contains ${forbidden}`);
  }
}

const localCreate = read("app/api/lawsuits/local-generation-create/route.ts");
for (const required of [
  "tx.lawsuit.create",
  "tx.claimIndex.updateMany",
  "clioMasterMatterId: null",
  "clioMasterDisplayNumber: null",
  'clioMasterMappingSource: "none-local-only-create-lawsuit"',
  "writesClio: false",
  "createsClioMasterMatter: false",
]) {
  if (localCreate.includes(required)) pass(`local create route contains ${required}`);
  else fail(`local create route missing ${required}`);
}

for (const rel of [
  "app/api/documents/clio-master-matter-preview/route.ts",
  "app/api/documents/clio-master-matter-confirm/route.ts",
]) {
  const text = read(rel);
  if (text.includes("legacyClioOperationalRouteBlocked")) pass(`${rel} is blocked`);
  else fail(`${rel} is not blocked`);
}

const forbiddenGlobalPatterns = [
  { re: /No child Clio matter with a readable client was found/g, label: "legacy child Clio readable-client error" },
  { re: /findClientFromChildClioMatters/g, label: "legacy child Clio client finder" },
  { re: /readClioMatterClient/g, label: "legacy child Clio matter client reader" },
  { re: /createClioMasterMatter/g, label: "legacy Clio master shell creator" },
  { re: /createsClioMasterMatter:\s*true/g, label: "writes Clio master shell true flag" },
];

const allowedHistoricalOrGenerated = [
  /^docs\//,
  /^scripts\/verify-create-lawsuit-local-only-no-clio-shell-safety\.cjs$/,
  /^scripts\/verify-local-only-lawsuit-architecture-safety\.cjs$/,
];

const globalHits = [];
for (const rel of activeRoots.flatMap((r) => walk(r))) {
  if (allowedHistoricalOrGenerated.some((rx) => rx.test(rel))) continue;
  const text = read(rel);
  for (const { re, label } of forbiddenGlobalPatterns) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text))) {
      globalHits.push({ rel, line: lineFor(text, m.index), label, snippet: (text.split(/\r?\n/)[lineFor(text, m.index) - 1] || "").trim() });
    }
  }
}

if (globalHits.length === 0) {
  pass("no active global Clio-shell aggregation/create dependencies remain");
} else {
  fail("active global Clio-shell aggregation/create dependencies remain");
  for (const h of globalHits.slice(0, 50)) {
    console.error(`${h.rel}:${h.line}: ${h.label}: ${h.snippet}`);
  }
}

const allowedClioReads = [];
const clioFetchHits = [];
for (const rel of activeRoots.flatMap((r) => walk(r))) {
  const text = read(rel);
  if (!text.includes("clioFetch(")) continue;
  const lines = text.split(/\r?\n/);
  lines.forEach((line, i) => {
    if (line.includes("clioFetch(")) clioFetchHits.push({ rel, line: i + 1, text: line.trim() });
  });
}

for (const hit of clioFetchHits) {
  const allowed =
    hit.rel.includes("/api/documents/") ||
    hit.rel.includes("/api/graph/") ||
    hit.rel === "lib/graph/maildropForDraft.ts" ||
    hit.rel.includes("lib/clio") ||
    hit.rel.includes("lib/settlementClioWriteback") ||
    hit.rel.includes("lib/clioCloseSync") ||
    hit.rel.includes("lib/claimIndexUpsert") ||
    hit.rel.includes("app/api/admin/lawsuits/cleanup-confirm/route.ts");

  if (allowed) allowedClioReads.push(hit);
  else fail(`unexpected clioFetch outside allowed document/admin storage contexts: ${hit.rel}:${hit.line}`);
}

console.log(`INFO: allowed clioFetch/document/admin references retained=${allowedClioReads.length}`);

console.log("RESULT: local-only lawsuit architecture safety verifier");
if (failed) process.exit(1);
