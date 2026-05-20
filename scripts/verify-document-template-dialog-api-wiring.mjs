#!/usr/bin/env node
import fs from "fs";

const page = fs.readFileSync("app/matters/page.tsx", "utf8");

const checks = [
  ["repository templates state exists", page.includes("masterDocumentRepositoryTemplates")],
  ["repository loader exists", page.includes("loadMasterDocumentRepositoryTemplates")],
  ["templates API called", page.includes("/api/documents/templates?category=")],
  ["launch loads preview and templates together", page.includes("Promise.all") && page.includes("loadMasterDocumentRepositoryTemplates({ mode })")],
  ["repository options preferred", page.includes("repositoryDocumentOptions.length > 0")],
  ["fallback to settlement preview plan exists", page.includes("settlementPreviewDocumentOptions")],
  ["settlement source copy references repository", page.includes("Template source: /api/documents/templates?category=settlement")],
  ["fallback warning exists", page.includes("Falling back to the settlement preview document plan")],
];

let failed = false;
for (const [label, ok] of checks) {
  if (ok) console.log(`PASS: ${label}`);
  else {
    console.log(`FAIL: ${label}`);
    failed = true;
  }
}

if (failed) process.exit(1);
console.log("PASS: document template dialog API wiring verifier");
