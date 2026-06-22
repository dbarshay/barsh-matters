const fs = require("fs");
const path = require("path");

let failed = false;
const pass = (m) => console.log("PASS: " + m);
const fail = (m) => { failed = true; console.error("FAIL: " + m); };

const roots = ["app", "lib"];
const exts = new Set([".ts", ".tsx", ".js", ".jsx"]);
const skip = new Set(["node_modules", ".next", ".git"]);

const allowedFiles = new Set([
  "app/api/documents/clio-maildrop-resolve/route.ts",
  "app/api/documents/clio-maildrop-inspect/route.ts",
  "lib/graph/maildropForDraft.ts",
  "scripts/verify-clio-maildrop-deprecated-safety.cjs",
  "scripts/verify-no-active-shell-maildrop-wording-safety.cjs",
]);

const allowedPatterns = [
  /deprecated/i,
  /Deprecated Clio MailDrop/,
  /clioMaildropEmail/,
  /clioMaildropLabel/,
  /maildropDeprecated/,
  /maildropDeprecationReason/,
  /storage only/i,
  /Barsh Matters Master Repository/,
  /configured Barsh Matters Master Repository Clio matter ID/,
  /legacy Clio storage reference/i,
  /legacy Clio aggregation/i,
  /legacyClioOperationalRouteBlocked/,
];

const suspicious = [
  /mapped Clio/i,
  /Clio document shell/i,
  /Clio matter shell/i,
  /master Clio matter/i,
  /Clio master matter/i,
  /No mapped Clio master matter/i,
  /MailDrop must be included/i,
  /MailDrop must not/i,
  /Could not resolve.*MailDrop/i,
  /BRL30148/,
  /BRL30121/,
];

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skip.has(ent.name)) continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, files);
    else if (exts.has(path.extname(ent.name))) files.push(p);
  }
  return files;
}

const hits = [];
for (const file of roots.flatMap(r => walk(r))) {
  const rel = file.replaceAll("\\", "/");
  const text = fs.readFileSync(file, "utf8");
  text.split(/\r?\n/).forEach((line, i) => {
    for (const rx of suspicious) {
      if (!rx.test(line)) continue;
      const allowed = allowedFiles.has(rel) || allowedPatterns.some(a => a.test(line));
      if (!allowed) hits.push(`${rel}:${i + 1}: ${line.trim()}`);
    }
  });
}

if (hits.length) {
  fail("suspicious active visible shell/MailDrop wording remains");
  for (const h of hits.slice(0, 120)) console.error(h);
} else {
  pass("no suspicious active visible shell/MailDrop wording remains outside allowed deprecation/legacy contexts");
}

for (const rel of [
  "app/api/documents/clio-master-crossref-preview/route.ts",
  "app/api/documents/clio-master-crossref-confirm/route.ts",
  "app/api/documents/master-clio-mapping-inspect/route.ts",
]) {
  const text = fs.readFileSync(path.join(process.cwd(), rel), "utf8");
  if (text.includes("legacyClioOperationalRouteBlocked")) pass(`${rel} is blocked as obsolete legacy Clio shell route`);
  else fail(`${rel} is not blocked`);
  for (const forbidden of ["clioFetch(", "BRL30121", "BRL30148", "maildrop_address", "/api/v4/matters.json"]) {
    if (!text.includes(forbidden)) pass(`${rel} excludes ${forbidden}`);
    else fail(`${rel} still contains ${forbidden}`);
  }
}

console.log("RESULT: no active shell/MailDrop wording safety verifier");
if (failed) process.exit(1);
