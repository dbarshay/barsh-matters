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

console.log("=== VERIFY CARISK IMPORT SAFETY ===");

const adapter = read("lib/import/cariskAdapter.ts");
const preview = read("app/api/import/carisk/preview/route.ts");
const confirm = read("app/api/import/carisk/confirm/route.ts");
const commit = read("app/api/import/reconcile/commit/route.ts");
const provRoute = read("app/api/import/reconcile/resolve-provider/route.ts");
const schema = read("prisma/schema.prisma");
const pkg = read("package.json");

// Adapter: ClaimType map, CIC# identity, HTML strip, TIN normalize.
must("adapter maps ClaimType NY WC", adapter, '"ny wc": "Workers Compensation"');
must("adapter maps ClaimType Auto", adapter, 'auto: "No-Fault"');
must("adapter flags unknown ClaimType", adapter, "case_type_unknown");
must("adapter strips HTML from status notes", adapter, "stripHtml");
must("adapter normalizes TIN", adapter, "normalizeTin");
must("adapter carries CIC#", adapter, "cic_number: cic");

// Status-driven routing constants.
must("status create", adapter, 'CARISK_STATUS_CREATE = "Carrier Submission"');
must("status ignore", adapter, 'CARISK_STATUS_IGNORE = "Submitted"');
must("status report", adapter, 'CARISK_STATUS_REPORT = "Saved Incomplete"');

// Preview + confirm: flag-gated, CIC# dedup, routing, sub-reason holds.
for (const [name, src] of [["preview", preview], ["confirm", confirm]]) {
  must(`${name} flag-gated`, src, "isImportEnabled()");
  must(`${name} routes ignore`, src, "CARISK_STATUS_IGNORE");
  must(`${name} routes report`, src, "CARISK_STATUS_REPORT");
  must(`${name} CIC# dedup`, src, "cic_number: { in: cics }");
  must(`${name} provider hold`, src, "HOLD_PROVIDER_UNMATCHED");
  must(`${name} case-type hold`, src, "HOLD_CASE_TYPE_UNKNOWN");
  must(`${name} tin hold`, src, "HOLD_TIN_MISMATCH");
}
must("confirm rejects duplicate CIC# with reason", confirm, "CIC# already exists as matter");
must("confirm creates via shared creator", confirm, "createMattersFromStaged(toCreate)");
must("confirm records source carisk", confirm, 'source: "carisk"');

// Commit is source-aware: Carisk resolves provider per-row + re-checks case-type/tin.
must("commit resolves per-row provider", commit, "resolveProvider(String(staged.provider_raw");
must("commit re-holds provider", commit, "HOLD_PROVIDER_UNMATCHED");
must("commit re-holds case-type", commit, "HOLD_CASE_TYPE_UNKNOWN");
must("commit re-holds tin", commit, "HOLD_TIN_MISMATCH");
must("commit merges carisk extra", commit, "cariskExtraFields(staged");

// Provider resolve is Owner-gated (registry write).
must("provider resolve admin-gated", provRoute, "isAdminRequestAuthorized(req)");
must("provider resolve creates alias", provRoute, "referenceAlias");

// Schema: canonical provider TIN home + unique CIC#.
must("schema provider canonical TIN", schema, "tin String?");
must("schema CIC# unique", schema, "cic_number                 String? @unique");

must("package.json registers verifier", pkg, "verify:carisk-import-safety");

if (failures) {
  console.error(`=== CARISK IMPORT SAFETY FAILED: ${failures} failure(s) ===`);
  process.exit(1);
}
console.log("=== CARISK IMPORT SAFETY PASSED ===");
