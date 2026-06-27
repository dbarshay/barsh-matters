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

const contract = read("src/lib/admin-users/admin-users-route-classification-phase-w2.ts");
const builder = read("scripts/build-admin-users-phase-w2-route-action-classification.mjs");
const doc = read("docs/admin-users/admin-users-phase-w2-route-action-classification.md");
const proof = JSON.parse(read("docs/admin-users/admin-users-phase-w2-route-action-classification.json"));
const session = read("app/api/auth/session/route.ts");
const pkg = JSON.parse(read("package.json"));

console.log("RUN: Admin Users Phase W2 route/action classification verifier");

must(has(contract, "ADMIN_USERS_PHASE_W2_ROUTE_ACTION_CLASSIFICATION"), "W2 contract marker exists");
must(has(contract, "AdminUsersPhaseW2Classification"), "W2 classification type exists");
must(has(contract, "ADMIN_USERS_PHASE_W2_ADMIN_CARD_ROUTE_RULES"), "admin-card route rules exist");
must(has(contract, "ADMIN_USERS_PHASE_W2_PAYMENT_PATH_MARKERS"), "payment markers exist");
must(has(contract, "ADMIN_USERS_PHASE_W2_GENERATION_PATH_MARKERS"), "generation/finalization markers exist");
must(has(contract, "adminUsersPhaseW2ClassifyPath"), "classifier function exists");

for (const op of ["view", "search", "create", "edit", "delete", "archive", "generate", "finalize", "upload", "download", "print", "email", "run", "void", "payment_manage", "admin_manage"]) {
  must(has(contract, `"${op}"`) || has(builder, `"${op}"`), `operation family classified: ${op}`);
}

for (const grantKey of [
  "admin.card.usersRoles",
  "admin.card.permissionsReview",
  "admin.card.auditHistory",
  "admin.card.documentTemplates",
  "admin.card.referenceData",
  "admin.card.claimIndex",
  "admin.card.ticklers",
  "admin.card.clientsBilling",
  "admin.card.backupRestore",
  "admin.card.readinessDashboard",
  "admin.card.documentReadiness",
  "admin.card.lawsuitCleanup"
]) {
  must(has(contract, grantKey), `admin-card grant rule exists for ${grantKey}`);
}

must(proof.phase === "admin-users-phase-w2-route-action-classification", "proof phase is W2 classification");
must(proof.runtimeEnforcementChanged === false, "proof says runtime enforcement unchanged");
must(proof.uiHidingActive === false, "proof says UI hiding inactive");
must(proof.databaseMutated === false, "proof says database not mutated");
must(Number.isInteger(proof.totalClassifiedFiles) && proof.totalClassifiedFiles > 0, "proof classified at least one app file");
must(Array.isArray(proof.classifications) && proof.classifications.length === proof.totalClassifiedFiles, "classification rows match total");
must(proof.classifications.some((row) => row.fileKind === "page"), "classification includes pages");
must(proof.classifications.some((row) => row.fileKind === "api_route"), "classification includes API routes");
must(proof.classifications.some((row) => row.adminOnly === true), "classification includes admin-only files");
must(proof.classifications.some((row) => row.paymentSensitive === true), "classification includes payment-sensitive files");
must(proof.classifications.every((row) => row.enforcementActive === false), "every row keeps enforcement inactive");
must(proof.classifications.every((row) => row.uiHidingActive === false), "every row keeps UI hiding inactive");

for (const row of proof.classifications) {
  must(typeof row.path === "string" && row.path.startsWith("app/"), `row path is app-relative: ${row.path}`);
  must(Array.isArray(row.operationFamilies) && row.operationFamilies.includes("view"), `row includes view operation: ${row.path}`);
}

must(has(doc, "classification only"), "doc marks classification only");
must(has(doc, "No runtime enforcement is enabled"), "doc says runtime enforcement disabled");
must(has(doc, "No UI hiding is enabled"), "doc says UI hiding disabled");
must(has(doc, "No backend route blocking is enabled"), "doc says backend blocking disabled");
must(has(doc, "Phase W3 should build a dry-run simulator"), "doc points next to W3 simulator");

must(has(session, 'permissionsMode: "default-admin-allow-all"'), "session remains default-admin-allow-all");
must(pkg.scripts?.["build:admin-users-phase-w2-route-action-classification"] === "node scripts/build-admin-users-phase-w2-route-action-classification.mjs", "package build script registered");
must(pkg.scripts?.["verify:admin-users-phase-w2-route-action-classification"] === "node scripts/verify-admin-users-phase-w2-route-action-classification.mjs", "package verifier script registered");

if (failures.length) {
  console.error("");
  console.error("FAILURES=" + failures.length);
  process.exit(1);
}

console.log("FAILURES=0");
console.log("PASS: Admin Users Phase W2 route/page/action classification is verifier-locked without enforcement.");
