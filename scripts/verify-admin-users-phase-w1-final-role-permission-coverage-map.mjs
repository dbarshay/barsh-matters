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

const coverage = read("src/lib/admin-users/admin-users-final-permission-coverage-phase-w1.ts");
const doc = read("docs/admin-users/admin-users-phase-w1-final-role-permission-coverage-map.md");
const proof = JSON.parse(read("docs/admin-users/admin-users-phase-w1-final-role-permission-coverage-map.json"));
const session = read("app/api/auth/session/route.ts");
const pkg = JSON.parse(read("package.json"));

console.log("RUN: Admin Users Phase W1 final role permission coverage verifier");

must(has(coverage, "ADMIN_USERS_PHASE_W1_FINAL_PERMISSION_COVERAGE"), "coverage phase marker exists");
must(has(coverage, "ADMIN_USERS_PHASE_W1_AREA_COVERAGE"), "area coverage exists");
must(has(coverage, "ADMIN_USERS_PHASE_W1_ROLE_COVERAGE"), "role coverage exists");

for (const roleKey of ["owner_admin", "administrator", "full_user", "basic_user", "view_only"]) {
  must(has(coverage, `roleKey: "${roleKey}"`), `coverage includes role ${roleKey}`);
  must(proof.roles.includes(roleKey), `proof includes role ${roleKey}`);
}

for (const areaKey of [
  "home_dashboard",
  "individual_matters",
  "lawsuits",
  "documents",
  "document_generation",
  "print_queue",
  "maildrop_email",
  "clio_storage_finalize",
  "ticklers_non_admin",
  "client_billing_payments",
  "settlement_payment_status",
  "reports_exports",
  "admin_screen",
  "admin_cards"
]) {
  must(has(coverage, `areaKey: "${areaKey}"`), `coverage includes area ${areaKey}`);
}

must(has(coverage, 'roleKey: "owner_admin"') && has(coverage, 'adminCardMode: "all"'), "Owner has all Admin cards");
must(has(coverage, 'roleKey: "administrator"') && has(coverage, 'adminCardMode: "selected"'), "Administrator has selected Admin cards");
must(has(coverage, 'roleKey: "full_user"') && has(coverage, 'accessLevel: "non_admin_all"'), "Full User has all non-admin access");
must(has(coverage, 'roleKey: "basic_user"') && has(coverage, 'accessLevel: "non_admin_no_payment"'), "Basic User excludes payment areas");
must(has(coverage, 'roleKey: "view_only"') && has(coverage, 'accessLevel: "non_admin_view_only"'), "View Only is read-only non-admin");

must(has(coverage, "paymentSensitive: true"), "coverage marks payment-sensitive areas");
must(has(coverage, "adminOnly: true"), "coverage marks admin-only areas");
must(has(coverage, "routeEnforcementActive: false"), "coverage explicitly keeps route enforcement inactive");
must(has(coverage, "uiHidingActive: false"), "coverage explicitly keeps UI hiding inactive");

must(has(doc, "planning and contract only"), "doc marks planning/contract only");
must(has(doc, "No runtime enforcement is enabled"), "doc says runtime enforcement disabled");
must(has(doc, "No UI hiding is enabled"), "doc says UI hiding disabled");
must(has(doc, "No backend route blocking is enabled"), "doc says backend blocking disabled");

must(proof.runtimeEnforcementChanged === false, "proof says runtime enforcement unchanged");
must(proof.uiHidingActive === false, "proof says UI hiding inactive");
must(proof.databaseMutated === false, "proof says database not mutated");
must(proof.paymentSensitiveAreas.includes("client_billing_payments"), "proof includes billing/payment sensitive area");
must(proof.paymentSensitiveAreas.includes("settlement_payment_status"), "proof includes settlement payment sensitive area");
must(proof.adminOnlyAreas.includes("admin_screen"), "proof includes admin screen");
must(proof.adminOnlyAreas.includes("admin_cards"), "proof includes admin cards");

must(has(session, 'permissionsMode: "default-admin-allow-all"'), "session remains default-admin-allow-all");
must(pkg.scripts?.["verify:admin-users-phase-w1-final-role-permission-coverage-map"] === "node scripts/verify-admin-users-phase-w1-final-role-permission-coverage-map.mjs", "package verifier script registered");

if (failures.length) {
  console.error("");
  console.error("FAILURES=" + failures.length);
  process.exit(1);
}

console.log("FAILURES=0");
console.log("PASS: Admin Users Phase W1 final role permission coverage map is verifier-locked without enforcement.");
