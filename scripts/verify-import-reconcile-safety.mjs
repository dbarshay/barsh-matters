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

console.log("=== VERIFY IMPORT RECONCILE SAFETY ===");

const holdReasons = read("lib/import/holdReasons.ts");
const createMatters = read("lib/import/createMatters.ts");
const confirm = read("app/api/import/dow/confirm/route.ts");
const preview = read("app/api/import/dow/preview/route.ts");
const list = read("app/api/import/reconcile/route.ts");
const carrier = read("app/api/import/reconcile/resolve-carrier/route.ts");
const patient = read("app/api/import/reconcile/resolve-patient/route.ts");
const dataq = read("app/api/import/reconcile/resolve-data/route.ts");
const commit = read("app/api/import/reconcile/commit/route.ts");
const page = read("app/admin/import/reconcile/page.tsx");
const pkg = read("package.json");

// Sub-reasons exist and are used by both classification paths.
must("hold reasons defined", holdReasons, "carrier_unmatched");
must("hold reasons defined", holdReasons, "patient_ambiguous");
must("hold reasons defined", holdReasons, "data_quality");
must("confirm classifies patient hold", confirm, "HOLD_PATIENT_AMBIGUOUS");
must("confirm classifies data hold", confirm, "HOLD_DATA_QUALITY");
must("confirm persists staged for held", confirm, "staged: a.outcome === \"held\"");
must("preview classifies sub-reasons", preview, "holdReason = HOLD_PATIENT_AMBIGUOUS");

// Every write path is flag-gated.
for (const [name, src] of [["list", list], ["carrier", carrier], ["patient", patient], ["data", dataq], ["commit", commit]]) {
  must(`${name} flag-gated`, src, "isImportEnabled()");
}

// Carrier resolve is Owner/admin-gated (registry write) — the others are NOT admin-gated.
must("carrier resolve admin-gated", carrier, "isAdminRequestAuthorized(req)");
must("carrier resolve returns 401 helper", carrier, "adminUnauthorizedJson()");
if (patient.includes("isAdminRequestAuthorized")) fail("patient resolve must NOT be admin-gated (Patient master only)");
else pass("patient resolve not admin-gated");

// Carrier resolve writes the registry (alias/entity) so future imports auto-normalize.
must("carrier resolve creates alias", carrier, "referenceAlias");
must("carrier resolve can add entity", carrier, "referenceEntity.upsert");

// Commit safety invariants: re-resolve carrier, never auto-create ambiguous patient, use shared creator.
must("commit re-resolves carrier", commit, "resolveCarrier(String(staged.carrier_raw");
must("commit re-holds ambiguous patient", commit, "HOLD_PATIENT_AMBIGUOUS");
must("commit re-checks data quality", commit, "dataQualityHold(staged)");
must("commit uses shared creator", commit, "createMattersFromStaged");

// Shared creator keeps invariants: Open final status + intake stage.
must("shared creator final_status Open", createMatters, 'final_status: "Open"');
must("shared creator sets intake stage", createMatters, "BARSH_IMPORT_DEFAULT_MATTER_STATUS");

// Reconcile page: reason-specific dialogs + commit controls.
must("page carrier dialog", page, "CarrierRow");
must("page patient dialog", page, "PatientRow");
must("page data actions", page, "resolve-data");
must("page commit all", page, "Commit all ready");
must("page commit selected", page, "Commit selected");

must("package.json registers verifier", pkg, "verify:import-reconcile-safety");

if (failures) {
  console.error(`=== IMPORT RECONCILE SAFETY FAILED: ${failures} failure(s) ===`);
  process.exit(1);
}
console.log("=== IMPORT RECONCILE SAFETY PASSED ===");
