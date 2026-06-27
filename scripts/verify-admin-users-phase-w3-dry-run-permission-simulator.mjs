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

const contract = read("src/lib/admin-users/admin-users-permission-simulator-phase-w3.ts");
const builder = read("scripts/build-admin-users-phase-w3-dry-run-permission-simulator.mjs");
const doc = read("docs/admin-users/admin-users-phase-w3-dry-run-permission-simulator.md");
const proof = JSON.parse(read("docs/admin-users/admin-users-phase-w3-dry-run-permission-simulator.json"));
const w2 = JSON.parse(read("docs/admin-users/admin-users-phase-w2-route-action-classification.json"));
const session = read("app/api/auth/session/route.ts");
const pkg = JSON.parse(read("package.json"));

console.log("RUN: Admin Users Phase W3 dry-run permission simulator verifier");

must(has(contract, "ADMIN_USERS_PHASE_W3_DRY_RUN_PERMISSION_SIMULATOR"), "W3 contract marker exists");
must(has(contract, "AdminUsersPhaseW3SimulatedActor"), "simulated actor type exists");
must(has(contract, "AdminUsersPhaseW3SimulationResult"), "simulation result type exists");
must(has(contract, "adminUsersPhaseW3SimulateClassification"), "simulator function exists");
must(has(contract, "adminUsersPhaseW3SummarizeActor"), "actor summary function exists");
must(has(contract, "dryRunOnly: true"), "contract marks dry-run only");
must(has(contract, "enforcementActive: false"), "contract keeps enforcement inactive");
must(has(contract, "uiHidingActive: false"), "contract keeps UI hiding inactive");

for (const roleKey of ["owner_admin", "administrator", "full_user", "basic_user", "view_only"]) {
  must(has(contract, `"${roleKey}"`), `contract includes role ${roleKey}`);
  must(proof.actors.some((actor) => actor.roleKeys.includes(roleKey)), `proof simulates role ${roleKey}`);
}

for (const grantKey of ["admin.card.clientsBilling", "admin.card.documentTemplates", "admin.card.ticklers"]) {
  must(has(contract, grantKey), `administrator sample includes selected grant ${grantKey}`);
  must(proof.actors.some((actor) => actor.adminCardGrantKeys.includes(grantKey)), `proof includes selected grant ${grantKey}`);
}

must(proof.phase === "admin-users-phase-w3-dry-run-permission-simulator", "proof phase is W3 simulator");
must(proof.basedOnPhaseW2 === "admin-users-phase-w2-route-action-classification", "proof is based on W2 classification");
must(proof.runtimeEnforcementChanged === false, "proof says runtime enforcement unchanged");
must(proof.uiHidingActive === false, "proof says UI hiding inactive");
must(proof.databaseMutated === false, "proof says database not mutated");
must(proof.dryRunOnly === true, "proof says dry-run only");
must(proof.actorCount === 5, "proof simulates five actors");
must(proof.classificationCount === w2.totalClassifiedFiles, "proof uses all W2 classified files");
must(proof.resultCount === proof.actorCount * proof.classificationCount, "proof has actor x route results");
must(Array.isArray(proof.summaries) && proof.summaries.length === 5, "proof has five actor summaries");

const owner = proof.summaries.find((row) => row.actorKey === "owner-baseline");
const admin = proof.summaries.find((row) => row.actorKey === "administrator-selected-cards");
const full = proof.summaries.find((row) => row.actorKey === "full-user-baseline");
const basic = proof.summaries.find((row) => row.actorKey === "basic-user-baseline");
const view = proof.summaries.find((row) => row.actorKey === "view-only-baseline");

must(owner?.blockCount === 0, "Owner blocks zero routes in dry run");
must((admin?.blockCount || 0) > 0, "Administrator blocks ungranted Admin-card routes");
must((admin?.allowCount || 0) > (admin?.blockCount || 0), "Administrator allows more than it blocks");
must((full?.blockedAdminCount || 0) > 0, "Full User blocks Admin-only routes");
must((basic?.blockedPaymentCount || 0) > 0, "Basic User blocks payment-sensitive routes");
must((view?.blockedMutationCount || 0) > 0, "View Only blocks mutation/action routes");
must(Array.isArray(proof.sampleBlockedRoutes) && proof.sampleBlockedRoutes.length > 0, "proof includes sample blocked routes");
must(proof.sampleBlockedRoutes.every((row) => row.dryRunOnly === true), "sample blocked routes are dry-run only");
must(proof.sampleBlockedRoutes.every((row) => row.enforcementActive === false), "sample blocked routes keep enforcement inactive");

must(has(doc, "dry-run simulator only"), "doc marks simulator only");
must(has(doc, "No runtime enforcement is enabled"), "doc says runtime enforcement disabled");
must(has(doc, "No UI hiding is enabled"), "doc says UI hiding disabled");
must(has(doc, "No backend route blocking is enabled"), "doc says backend blocking disabled");
must(has(doc, "Phase W4 should expose this simulator"), "doc points next to W4 visibility");

must(has(builder, "runtimeEnforcementChanged: false"), "builder keeps runtime enforcement unchanged");
must(has(builder, "uiHidingActive: false"), "builder keeps UI hiding inactive");
must(has(builder, "databaseMutated: false"), "builder records no DB mutation");

must(has(session, 'permissionsMode: "default-admin-allow-all"'), "session remains default-admin-allow-all");
must(pkg.scripts?.["build:admin-users-phase-w3-dry-run-permission-simulator"] === "node scripts/build-admin-users-phase-w3-dry-run-permission-simulator.mjs", "package build script registered");
must(pkg.scripts?.["verify:admin-users-phase-w3-dry-run-permission-simulator"] === "node scripts/verify-admin-users-phase-w3-dry-run-permission-simulator.mjs", "package verifier script registered");

if (failures.length) {
  console.error("");
  console.error("FAILURES=" + failures.length);
  process.exit(1);
}

console.log("FAILURES=0");
console.log("PASS: Admin Users Phase W3 dry-run permission simulator is verifier-locked without enforcement.");
