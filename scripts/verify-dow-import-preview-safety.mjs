#!/usr/bin/env node
import fs from "node:fs";

// Dow import PREVIEW safety: flag-gated, READ-ONLY (no writes), fingerprint dedup, fast resolution.
function read(p) {
  return fs.readFileSync(p, "utf8");
}
let failures = 0;
const pass = (m) => console.log(`PASS: ${m}`);
const fail = (m) => {
  console.error(`FAIL: ${m}`);
  failures += 1;
};
const must = (label, text, needle) =>
  text.includes(needle) ? pass(`${label}: ${needle}`) : fail(`${label}: missing ${needle}`);
const mustNot = (label, text, needle) =>
  !text.includes(needle) ? pass(`${label}: avoids ${needle}`) : fail(`${label}: FORBIDDEN ${needle}`);

console.log("=== VERIFY DOW IMPORT PREVIEW SAFETY ===");

const schema = read("prisma/schema.prisma");
const cfg = read("lib/import/importConfig.ts");
const preview = read("app/api/import/dow/preview/route.ts");
const pkg = read("package.json");

// Schema: fingerprint column + index.
must("schema fingerprint", schema, "fingerprint                String?");
must("schema fingerprint index", schema, "@@index([fingerprint])");

// Flag: default OFF.
must("flag helper", cfg, "export function isImportEnabled");
must("flag env", cfg, "BARSH_IMPORT_ENABLED");

// Preview route: flag-gated + READ-ONLY (no writes at all).
must("preview flag gate", preview, "if (!isImportEnabled())");
must("preview 403 when disabled", preview, "status: 403");
must("preview declares read-only", preview, "writes: false");
mustNot("preview no create", preview, ".create(");
mustNot("preview no createMany", preview, ".createMany(");
mustNot("preview no update", preview, ".update(");
mustNot("preview no delete", preview, ".delete(");
mustNot("preview no upsert", preview, ".upsert(");

// Duplicate detection + fast distinct resolution.
must("preview fingerprint dup query", preview, "fingerprint: { in: fingerprints }");
must("preview within-file dup", preview, 'outcome = "duplicate_in_file"');
must("preview existing dup", preview, 'outcome = "duplicate_existing"');
must("preview distinct carrier resolve", preview, "distinctCarriers");
must("preview distinct patient resolve", preview, "distinctPatients");
must("preview maps dow rows", preview, "mapDowRows(rows)");

must("package.json", pkg, "verify:dow-import-preview-safety");

if (failures) {
  console.error(`=== DOW IMPORT PREVIEW SAFETY FAILED: ${failures} failure(s) ===`);
  process.exit(1);
}
console.log("=== DOW IMPORT PREVIEW SAFETY PASSED ===");
console.log("Preview is flag-gated and strictly read-only; dedup by fingerprint (existing + in-file).");
