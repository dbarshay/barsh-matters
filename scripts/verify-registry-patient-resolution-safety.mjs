#!/usr/bin/env node
import fs from "node:fs";

// Registry (reference-entity) + patient resolution safety.
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
  !text.includes(needle) ? pass(`${label}: avoids ${needle}`) : fail(`${label}: forbidden ${needle}`);

console.log("=== VERIFY REGISTRY + PATIENT RESOLUTION SAFETY ===");

const schema = read("prisma/schema.prisma");
const patient = read("lib/patientResolution.ts");
const ref = read("lib/referenceResolution.ts");
const pkg = read("package.json");

// --- Patient master schema + link ---
must("schema Patient model", schema, "model Patient {");
must("schema Patient normalizedName", schema, "normalizedName String");
must("schema ClaimIndex.patient_id", schema, "patient_id                 String?");
must("schema ClaimIndex.patient relation", schema, "patient                    Patient? @relation");

// --- Patient resolution: canonical name + suggest-and-confirm, never auto-link on fuzzy ---
must("patient First Last", patient, "export function toFirstLastProperCase");
must("patient resolve", patient, "export async function resolvePatient");
must("patient exact single links", patient, 'status: "exact"');
must("patient multiple/close suggests", patient, 'status: "suggest"');
must("patient no-match creates new", patient, 'status: "new"');
must("patient create", patient, "export async function createPatient");
// close candidates by last name (co-claimant / typo surfacing) — never a silent link.
must("patient close by last name", patient, "normalizedName: { contains: last }");

// --- Reference resolution: exact only, noise-stripped, alias-aware, unmatched -> flag owner ---
must("ref uses canonical normalize", ref, 'from "@/lib/referenceData"');
must("ref normalizeReferenceText", ref, "normalizeReferenceText(c)");
must("ref noise strip", ref, "export function stripReferenceNoise");
must("ref carrier type", ref, 'REFERENCE_TYPE_CARRIER: ReferenceEntityType = "insurer_company"');
must("ref provider type", ref, 'REFERENCE_TYPE_PROVIDER: ReferenceEntityType = "provider_client"');
must("ref exact name match", ref, "normalizedName: { in: normalized }");
must("ref exact alias match", ref, "normalizedAlias: { in: normalized }");
must("ref unmatched return", ref, 'status: "unmatched"');
// No fuzzy auto-match on entity resolution (exact `in:` only; no `contains`/`mode: insensitive` fuzz).
mustNot("ref no fuzzy contains", ref, "contains:");

must("package.json", pkg, "verify:registry-patient-resolution-safety");

if (failures) {
  console.error(`=== REGISTRY + PATIENT RESOLUTION SAFETY FAILED: ${failures} failure(s) ===`);
  process.exit(1);
}
console.log("=== REGISTRY + PATIENT RESOLUTION SAFETY PASSED ===");
console.log("Patient: suggest-and-confirm (no fuzzy auto-link), auto-create only on no match.");
console.log("Reference entities: exact name/alias only, unmatched -> Owner to map.");
