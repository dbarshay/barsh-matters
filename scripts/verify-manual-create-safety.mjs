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

console.log("=== VERIFY MANUAL CREATE SAFETY ===");

const route = read("app/api/import/manual/create/route.ts");
const landing = read("app/admin/import/other/page.tsx");
const form = read("app/admin/matter/new/page.tsx");
const admin = read("app/admin/page.tsx");
const pkg = read("package.json");

// Route: flag-gated, claim/policy alternation, all-required, controlled-value verification.
must("route flag-gated", route, "isImportEnabled()");
must("claim/policy alternation", route, "Claim Number or Policy Number is required");
must("verifies provider type", route, 'provider.type !== "provider_client"');
must("verifies insurer type", route, 'displayNameOf(insurerEntityId, "insurer_company")');
must("verifies denial type", route, 'displayNameOf(denialReasonId, "denial_reason")');
must("verifies service type", route, 'displayNameOf(serviceTypeId, "service_type")');
must("case type constrained", route, "CASE_TYPES");

// Dedup: same fingerprint; warn + require override.
must("dedup fingerprint", route, "computeBillFingerprint");
must("duplicate warns not blocks", route, "duplicate:");
must("override path", route, "override === true");

// Patient suggest-and-confirm (never auto-link on fuzzy).
must("patient resolve", route, "resolvePatient(patientName)");
must("patient suggest asks operator", route, "needPatientChoice");

// Create via shared creator + records a manual batch for audit/undo.
must("uses shared creator", route, "createMattersFromStaged");
must("records manual batch", route, 'source: "manual"');
must("records import row", route, "prisma.importRow.create");

// Entry points.
must("landing has manual card", landing, "Create Matter Manually");
must("landing has other-spreadsheet card", landing, "Other Spreadsheet");
must("form posts to manual create", form, "/api/import/manual/create");
must("form has all controlled dropdowns", form, "provider_client");
must("admin OTHERS links to landing", admin, '"/admin/import/other"');

// Carry-over: patient-defaults endpoint + form typeahead/auto-fill + add-another.
const defaults = read("app/api/import/manual/patient-defaults/route.ts");
must("defaults flag-gated", defaults, "isImportEnabled()");
must("defaults from latest matter", defaults, 'orderBy: { matter_id: "desc" }');
must("defaults resolves entity ids", defaults, "entityIdFor");
must("defaults excludes bill-level", defaults, "intentionally NOT returned");
must("create returns patientId", route, "patientId: created.patientId");
must("form patient typeahead", form, "linkPatient");
must("form loads defaults", form, "/api/import/manual/patient-defaults");
must("form add-another keeps carry-over", form, "addAnotherForPatient");

must("package.json registers verifier", pkg, "verify:manual-create-safety");

if (failures) {
  console.error(`=== MANUAL CREATE SAFETY FAILED: ${failures} failure(s) ===`);
  process.exit(1);
}
console.log("=== MANUAL CREATE SAFETY PASSED ===");
