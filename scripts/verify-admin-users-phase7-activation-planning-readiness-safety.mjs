import fs from "fs";
const failures = [];
const read = (p) => fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "";
const assert = (cond, msg) => { if (cond) console.log("PASS:", msg); else { console.log("FAIL:", msg); failures.push(msg); } };

const registry = read("lib/adminPermissions.ts");
const envVerifier = read("scripts/verify-admin-users-phase4-env-deployment-readiness-safety.mjs");
const phase5b = read("scripts/verify-admin-users-phase5-enforcement-simulation-negative-path-safety.mjs");
const phase5c = read("scripts/verify-admin-users-phase5-permission-check-negative-path-safety.mjs");
const overrideRoute = read("app/api/admin/users/permission-override/route.ts");
const assignRoute = read("app/api/admin/users/assign-role/route.ts");
const removeRoute = read("app/api/admin/users/remove-role/route.ts");
const usersPage = read("app/admin/users/page.tsx");
const permissionsPage = read("app/admin/permissions/page.tsx");
const pkg = JSON.parse(read("package.json"));

console.log("\nRESULT: admin users phase 7 activation planning readiness safety verifier");

assert(registry.includes("return String(process.env.BARSH_ADMIN_PERMISSIONS_ENFORCEMENT ?? \"\").trim() === \"1\""), "activation prerequisite: enforcement remains exact-match BARSH_ADMIN_PERMISSIONS_ENFORCEMENT gate");
assert(envVerifier.includes("BARSH_ADMIN_PERMISSIONS_ENFORCEMENT") && envVerifier.includes("package.json") && envVerifier.includes(".env.local"), "activation prerequisite: persistent env activation remains guarded by deployment verifier");
assert(phase5b.includes("process.env.BARSH_ADMIN_PERMISSIONS_ENFORCEMENT = \"1\"") && phase5b.includes("verifier restores BARSH_ADMIN_PERMISSIONS_ENFORCEMENT after simulation"), "safe testing: enforcement can be simulated ephemerally and restored inside verifier only");
assert(phase5c.includes("Permission check target is blocked by current admin permission overrides.") && phase5c.includes("This endpoint does not enforce blocking."), "safe diagnostics: permission-check negative path remains read-only diagnostic");
assert(registry.includes("No permission mapping matched; default allow until explicit mapping is added.") && registry.includes("defaultAdminPermissionAllowed") && registry.includes("return isKnownAdminPermissionKey(permission);"), "default behavior: known permissions/default unmapped decisions remain non-lockout oriented before activation");

for (const path of ["/admin", "/admin/permissions", "/api/admin/permissions", "/api/admin/permissions/check"]) {
  assert(registry.includes(path), "lockout guarantee: never-block path registered: " + path);
}

assert(overrideRoute.includes("Blocking this permission is not allowed because it maps to administrator lockout safety routes.") && overrideRoute.includes("neverBlockRoutesForPermission") && overrideRoute.includes("neverBlockPermissionKeys"), "override validation: block overrides cannot target permissions mapped to never-block routes");
assert(registry.includes("BARSH_ADMIN_PERMISSION_OVERRIDES_JSON") && registry.includes("parsed?.allow") && registry.includes("parsed?.block") && registry.includes("Unknown admin permission override ignored"), "override JSON contract: allow/block arrays are parsed and unknown permission keys are rejected/reported");
assert(assignRoute.includes("At least one active bootstrapSafe owner_admin user must exist before role assignment.") && assignRoute.includes("activeBootstrapOwnerAdminCount"), "bootstrap guarantee: assign-role requires at least one active bootstrapSafe owner_admin");
assert(removeRoute.includes("Cannot remove owner_admin from the last active bootstrapSafe owner_admin user.") && removeRoute.includes("activeBootstrapOwnerAdminCount"), "bootstrap guarantee: remove-role preserves last active bootstrapSafe owner_admin");
assert(overrideRoute.includes("key: \"owner_admin\"") && assignRoute.includes("key: \"owner_admin\"") && removeRoute.includes("key: \"owner_admin\""), "owner_admin guarantee: guarded write routes require active owner_admin actor");
assert(usersPage.includes("Enable Enforcement") && usersPage.includes("Separate phase only after persisted permissions are verified and lockout simulations pass.") && usersPage.includes("Not available"), "safe deployment sequence: UI states enforcement is a separate later phase and not available now");
assert(permissionsPage.includes("Set BARSH_ADMIN_PERMISSIONS_ENFORCEMENT=1 only in a later enforcement phase") && permissionsPage.includes("Overrides are displayed for planning only and are not enforced yet"), "activation planning UI: permissions page discloses preview-only override/enforcement status");
assert(registry.includes("enforcementPlanned: false") && !registry.includes("enforcementPlanned: true"), "rollback/current state: all mapped admin routes remain enforcementPlanned false before activation");

for (const file of ["app/api/admin/users/create/route.ts", "app/api/admin/users/assign-role/route.ts", "app/api/admin/users/remove-role/route.ts", "app/api/admin/users/permission-override/route.ts", "app/admin/users/page.tsx", "app/admin/permissions/page.tsx"]) {
  const src = read(file);
  assert(!/process[.]env[.]BARSH_ADMIN_PERMISSIONS_ENFORCEMENT[ \t]*=/.test(src), "non-activation runtime source does not assign enforcement flag: " + file);
}

assert(pkg.scripts && pkg.scripts["verify:admin-users-phase7-activation-planning-readiness-safety"] === "node scripts/verify-admin-users-phase7-activation-planning-readiness-safety.mjs", "package script registered for Phase 7A verifier");

if (failures.length) {
  console.error("\nFAILURES:");
  for (const f of failures) console.error("-", f);
  process.exit(1);
}

console.log("\nPASS: Phase 7A locks staged activation planning prerequisites, safe deployment sequence, bootstrap/owner_admin guarantees, default behavior, override JSON validation, ephemeral testing, rollback posture, and non-activation before any enforcement phase.");
