import fs from "node:fs";

const failures = [];
const read = (path) => fs.readFileSync(path, "utf8");
const has = (text, token) => text.includes(token);
const must = (ok, message) => {
  if (ok) console.log("PASS:", message);
  else {
    console.error("FAIL:", message);
    failures.push(message);
  }
};

const w2Builder = read("scripts/build-admin-users-phase-w2-route-action-classification.mjs");
const w2Verifier = read("scripts/verify-admin-users-phase-w2-route-action-classification.mjs");
const w2 = JSON.parse(read("docs/admin-users/admin-users-phase-w2-route-action-classification.json"));
const w3 = JSON.parse(read("docs/admin-users/admin-users-phase-w3-dry-run-permission-simulator.json"));
const w4 = JSON.parse(read("docs/admin-users/admin-users-phase-w4-read-only-simulator-visibility.json"));
const w6 = JSON.parse(read("docs/admin-users/admin-users-phase-w6-classification-overrides.json"));
const proof = JSON.parse(read("docs/admin-users/admin-users-phase-w7-apply-classification-overrides.json"));
const doc = read("docs/admin-users/admin-users-phase-w7-apply-classification-overrides.md");
const session = read("app/api/auth/session/route.ts");
const pkg = JSON.parse(read("package.json"));

console.log("RUN: Admin Users Phase W7 apply classification overrides verifier");

must(has(w2Builder, "parsePhaseW6Overrides"), "W2 builder parses W6 overrides");
must(has(w2Builder, "applyPhaseW6Override"), "W2 builder applies W6 overrides");
must(has(w2Builder, "phaseW6OverrideApplied"), "W2 builder marks applied override rows");
must(has(w2Verifier, "phaseW6OverrideCount"), "W2 verifier checks W6 override count");

must(Number.isInteger(w2.phaseW6OverrideCount) && w2.phaseW6OverrideCount > 0, "W2 proof has W6 overrides applied");
must(w2.phaseW6OverrideCount === w6.overrideCount, "W2 applied override count matches W6 plan count");
must(w2.classifications.some((row) => row.phaseW6OverrideApplied === true), "W2 classifications include applied override rows");
must(w2.classifications.every((row) => row.enforcementActive === false), "W2 rows keep enforcement inactive");
must(w2.classifications.every((row) => row.uiHidingActive === false), "W2 rows keep UI hiding inactive");

must(w3.basedOnPhaseW2 === "admin-users-phase-w2-route-action-classification", "W3 remains based on W2");
must(w3.runtimeEnforcementChanged === false, "W3 keeps runtime enforcement unchanged");
must(w3.uiHidingActive === false, "W3 keeps UI hiding inactive");
must(w3.databaseMutated === false, "W3 records no DB mutation");

must(w4.phaseW6OverridesApplied === true, "W4 proof says W6 overrides are reflected");
must(w4.runtimeEnforcementChanged === false, "W4 keeps runtime enforcement unchanged");
must(w4.uiHidingActive === false, "W4 keeps UI hiding inactive");
must(w4.backendRouteBlockingActive === false, "W4 keeps route blocking inactive");
must(w4.databaseMutated === false, "W4 records no DB mutation");

must(proof.phase === "admin-users-phase-w7-apply-classification-overrides", "proof phase is W7");
must(proof.basedOnPhaseW6 === w6.phase, "proof is based on W6");
must(proof.runtimeEnforcementChanged === false, "proof says runtime enforcement unchanged");
must(proof.uiHidingActive === false, "proof says UI hiding inactive");
must(proof.backendRouteBlockingActive === false, "proof says backend route blocking inactive");
must(proof.databaseMutated === false, "proof says database not mutated");
must(proof.simulatorRebuildOnly === true, "proof says simulator rebuild only");
must(proof.w6OverridePlanCount === w6.overrideCount, "proof records W6 override plan count");
must(proof.w2AppliedOverrideCount === w2.phaseW6OverrideCount, "proof records applied W2 override count");

must(has(doc, "simulator rebuild only"), "doc marks simulator rebuild only");
must(has(doc, "No runtime enforcement is enabled"), "doc says runtime enforcement disabled");
must(has(doc, "No UI hiding is enabled"), "doc says UI hiding disabled");
must(has(doc, "No backend route blocking is enabled"), "doc says backend blocking disabled");
must(has(doc, "No database changes are made"), "doc says database unchanged");

must(has(session, 'permissionsMode: "default-admin-allow-all"'), "session remains default-admin-allow-all");
must(pkg.scripts?.["verify:admin-users-phase-w7-apply-classification-overrides"] === "node scripts/verify-admin-users-phase-w7-apply-classification-overrides.mjs", "package verifier script registered");

if (failures.length) {
  console.error("");
  console.error("FAILURES=" + failures.length);
  process.exit(1);
}

console.log("FAILURES=0");
console.log("PASS: Admin Users Phase W7 applies classification overrides to simulator outputs without enforcement.");
