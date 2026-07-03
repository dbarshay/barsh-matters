#!/usr/bin/env node
import fs from "node:fs";

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

console.log("=== VERIFY OTHER (GENERIC SPREADSHEET) IMPORT SAFETY ===");

const adapter = read("lib/import/otherAdapter.ts");
const headers = read("app/api/import/other/headers/route.ts");
const mappings = read("app/api/import/other/mappings/route.ts");
const preview = read("app/api/import/other/preview/route.ts");
const confirm = read("app/api/import/other/confirm/route.ts");
const commit = read("app/api/import/reconcile/commit/route.ts");
const validation = read("lib/import/validation.ts");
const page = read("app/admin/import/other/spreadsheet/page.tsx");
const landing = read("app/admin/import/other/page.tsx");
const schema = read("prisma/schema.prisma");
const pkg = read("package.json");

// Adapter: mapping-driven, auto-suggest, claim-or-policy, provider NOT parsed, fingerprint dedup.
must("adapter suggests mapping", adapter, "export function suggestMapping");
must("adapter claim-or-policy", adapter, "Missing Claim Number or Policy Number");
must("adapter provider never parsed", adapter, "provider is always operator-picked");
must("adapter fingerprint", adapter, "computeBillFingerprint");
must("adapter case-type normalize", adapter, "normalizeCaseType");

// Provider is a required pick (not parsed) in preview + confirm.
must("preview requires provider pick", preview, "never parses the provider");
must("confirm requires provider pick", confirm, 'Pick a Provider/Client');
must("confirm records source other", confirm, 'source: "other"');
must("confirm fingerprint dedup", confirm, "fingerprint: { in: fingerprints }");

// Flag-gated routes.
for (const [n, src] of [["headers", headers], ["mappings", mappings], ["preview", preview], ["confirm", confirm]]) {
  must(`${n} flag-gated`, src, "isImportEnabled()");
}

// Saved mapping templates.
must("mappings upsert by name", mappings, "prisma.importMapping.upsert");
must("schema ImportMapping", schema, "model ImportMapping {");

// Commit is source-aware for 'other' (batch fixed provider).
must("commit handles other fixed provider", commit, 'r.batch?.source === "other" && det.fixedProvider');
must("validation other claim-or-policy", validation, 'source === "other"');

// UI: drag-drop, mapping, provider pick, template save/load, reconcile links.
must("page drag-and-drop", page, "onDrop");
must("page provider pick", page, "Select provider…");
must("page save mapping", page, "Save mapping");
must("page reconcile link (other)", page, "source=other");
must("landing has spreadsheet card", landing, "Other Spreadsheet");
must("landing has document OCR card", landing, "Document OCR");

must("package.json registers verifier", pkg, "verify:other-import-safety");

if (failures) {
  console.error(`=== OTHER IMPORT SAFETY FAILED: ${failures} failure(s) ===`);
  process.exit(1);
}
console.log("=== OTHER IMPORT SAFETY PASSED ===");
