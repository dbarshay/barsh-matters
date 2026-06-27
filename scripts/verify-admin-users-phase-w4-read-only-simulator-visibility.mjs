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

const page = read("app/admin/users/page.tsx");
const doc = read("docs/admin-users/admin-users-phase-w4-read-only-simulator-visibility.md");
const proof = JSON.parse(read("docs/admin-users/admin-users-phase-w4-read-only-simulator-visibility.json"));
const w3 = JSON.parse(read("docs/admin-users/admin-users-phase-w3-dry-run-permission-simulator.json"));
const session = read("app/api/auth/session/route.ts");
const pkg = JSON.parse(read("package.json"));

console.log("RUN: Admin Users Phase W4 read-only simulator visibility verifier");

must(has(page, 'data-barsh-admin-users-phase-w4-simulator-visibility="true"'), "Admin Users page exposes W4 simulator visibility section");
must(has(page, 'data-barsh-admin-users-phase-w4-dry-run-badge="true"'), "W4 dry-run badge is present");
must(has(page, 'data-barsh-admin-users-phase-w4-simulator-summary="true"'), "W4 simulator summary table is present");
must(has(page, 'data-barsh-admin-users-phase-w4-simulator-row="true"'), "W4 simulator rows are marked");
must(has(page, 'data-barsh-admin-users-phase-w4-no-enforcement-note="true"'), "W4 no-enforcement note is present");
must(has(page, "Permission Simulator Preview"), "W4 section title is present");
must(has(page, "Permission enforcement is not active yet"), "W4 page says enforcement is not active");
must(has(page, "They do not hide buttons, block routes, change sessions, or modify database permissions."), "W4 page explicitly says no hiding/blocking/session/database changes");

for (const role of ["Owner", "Administrator", "Full User", "Basic User", "View Only"]) {
  must(has(page, `role: "${role}"`), `W4 page includes role ${role}`);
  must(proof.summaries.some((row) => row.role === role), `W4 proof includes role ${role}`);
}

const roleToActorKey = {
  "Owner": "owner-baseline",
  "Administrator": "administrator-selected-cards",
  "Full User": "full-user-baseline",
  "Basic User": "basic-user-baseline",
  "View Only": "view-only-baseline",
};

for (const [role, actorKey] of Object.entries(roleToActorKey)) {
  const proofRow = proof.summaries.find((item) => item.role === role);
  const w3Row = w3.summaries.find((item) => item.actorKey === actorKey);
  must(Boolean(proofRow), `W4 proof row found for ${role}`);
  must(Boolean(w3Row), `W3 row found for ${role}`);
  must(proofRow?.allowed === w3Row?.allowCount, `W4 allowed count matches W3 for ${role}`);
  must(proofRow?.blocked === w3Row?.blockCount, `W4 blocked count matches W3 for ${role}`);
}

must(proof.phase === "admin-users-phase-w4-read-only-simulator-visibility", "proof phase is W4");
must(proof.basedOnPhaseW3 === "admin-users-phase-w3-dry-run-permission-simulator", "proof is based on W3");
must(proof.runtimeEnforcementChanged === false, "proof says runtime enforcement unchanged");
must(proof.uiHidingActive === false, "proof says UI hiding inactive");
must(proof.backendRouteBlockingActive === false, "proof says backend route blocking inactive");
must(proof.databaseMutated === false, "proof says database not mutated");
must(proof.visibleInAdminUsers === true, "proof says visible in Admin Users");
must(proof.dryRunOnly === true, "proof says dry-run only");
must(proof.phaseW6OverridesApplied === true, "proof says W6 overrides are reflected");

must(has(doc, "UI visibility only"), "doc marks visibility only");
must(has(doc, "No runtime enforcement is enabled"), "doc says runtime enforcement disabled");
must(has(doc, "No UI hiding is enabled"), "doc says UI hiding disabled");
must(has(doc, "No backend route blocking is enabled"), "doc says route blocking disabled");
must(has(doc, "No database changes are made"), "doc says database unchanged");

must(has(session, 'permissionsMode: "default-admin-allow-all"'), "session remains default-admin-allow-all");
must(pkg.scripts?.["verify:admin-users-phase-w4-read-only-simulator-visibility"] === "node scripts/verify-admin-users-phase-w4-read-only-simulator-visibility.mjs", "package verifier script registered");

if (failures.length) {
  console.error("");
  console.error("FAILURES=" + failures.length);
  process.exit(1);
}

console.log("FAILURES=0");
console.log("PASS: Admin Users Phase W4 read-only simulator visibility is verifier-locked without enforcement.");
