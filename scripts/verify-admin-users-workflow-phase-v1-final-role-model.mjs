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

const sourcePath = "src/lib/admin-users/admin-users-final-role-model-phase-v1.ts";
const docPath = "docs/admin-users/admin-users-phase-v1-final-five-role-model.md";
const jsonPath = "docs/admin-users/admin-users-phase-v1-final-five-role-model.json";
const source = read(sourcePath);
const doc = read(docPath);
const proof = JSON.parse(read(jsonPath));
const session = read("app/api/auth/session/route.ts");
const proxy = read("proxy.ts");
const pkg = JSON.parse(read("package.json"));

console.log("RUN: Admin Users Phase V1 final role model verifier");

must(has(source, "ADMIN_USERS_PHASE_V1_FINAL_ROLE_MODEL"), "phase marker exists");
for (const roleKey of ["owner_admin", "administrator", "full_user", "basic_user", "view_only"]) {
  must(has(source, `"${roleKey}"`), `role key present: ${roleKey}`);
  must(proof.roles.some((role) => role.key === roleKey), `proof JSON role present: ${roleKey}`);
}

must(has(source, 'label: "Owner"'), "Owner visible label present");
must(has(source, 'key: "owner_admin"'), "Owner keeps owner_admin compatibility key");
must(has(source, 'key: "administrator"') && has(source, 'adminCardGrantMode: "selectable_per_card"'), "Administrator card-by-card grant mode present");
must(has(source, 'key: "full_user"') && has(source, 'adminAccessMode: "no_admin_screen"'), "Full User has no Admin screen");
must(has(source, 'key: "basic_user"') && has(source, 'paymentAccessMode: "no_payment_functions"'), "Basic User excludes payment functions");
must(has(source, 'key: "view_only"') && has(source, 'mutationMode: "view_only_no_mutations"'), "View Only has no mutation permissions");

for (const cardKey of [
  "users_roles",
  "permissions_review",
  "audit_history",
  "document_templates",
  "reference_data",
  "claim_index",
  "ticklers",
  "clients_billing",
  "backup_restore",
  "readiness_dashboard",
  "document_readiness",
  "lawsuit_cleanup",
]) {
  must(has(source, `key: "${cardKey}"`), `admin card present: ${cardKey}`);
}

for (const permission of [
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
  "admin.card.lawsuitCleanup",
]) {
  must(has(source, permission), `admin card grant key present: ${permission}`);
}

for (const paymentToken of [
  "payments.view",
  "payments.manage",
  "invoices.view",
  "invoices.create",
  "invoices.finalize",
  "invoices.void",
  "settlements.paymentStatus.manage",
  "settlements.paymentStatus.view",
]) {
  must(has(source, paymentToken), `payment permission family present: ${paymentToken}`);
}

must(has(doc, "Planning/contract only"), "documentation marks phase as planning/contract only");
must(has(doc, "does not enable runtime permission enforcement"), "documentation preserves non-activation guarantee");
must(proof.runtimeEnforcementChanged === false, "proof JSON says runtime enforcement unchanged");
must(proof.databaseMutated === false, "proof JSON says database not mutated");
must(proof.sessionBehaviorChanged === false, "proof JSON says session behavior unchanged");

must(has(session, 'permissionsMode: "default-admin-allow-all"'), "session remains default-admin-allow-all");
must(has(session, "configuredAdminPermissionsEnforcementEnabled()"), "session still exposes enforcement flag without activating");
must(has(proxy, "owner_admin") || has(proxy, "adminBlocked") || has(proxy, "/admin"), "proxy remains present with admin access safety markers");
must(pkg.scripts?.["verify:admin-users-workflow-phase-v1-final-role-model"] === "node scripts/verify-admin-users-workflow-phase-v1-final-role-model.mjs", "package verifier script registered");

if (failures.length) {
  console.error("");
  console.error("FAILURES=" + failures.length);
  process.exit(1);
}

console.log("FAILURES=0");
console.log("PASS: Admin Users Phase V1 final five-role model is documented and verifier-locked without runtime enforcement changes.");
