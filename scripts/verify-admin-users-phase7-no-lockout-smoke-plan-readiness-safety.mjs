import fs from "fs";

const failures = [];
const read = (p) => fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "";
const assert = (cond, msg) => {
  if (cond) console.log("PASS:", msg);
  else {
    console.log("FAIL:", msg);
    failures.push(msg);
  }
};

const registry = read("lib/adminPermissions.ts");
const proxy = read("proxy.ts");
const sessionRoute = read("app/api/auth/session/route.ts");
const permissionsApi = read("app/api/admin/permissions/route.ts");
const permissionCheck = read("app/api/admin/permissions/check/route.ts");
const permissionsPage = read("app/admin/permissions/page.tsx");
const auditPage = read("app/admin/audit-history/page.tsx");
const phase7a = read("scripts/verify-admin-users-phase7-activation-planning-readiness-safety.mjs");
const phase7b = read("scripts/verify-admin-users-phase7-first-target-planning-readiness-safety.mjs");
const phase4Env = read("scripts/verify-admin-users-phase4-env-deployment-readiness-safety.mjs");
const phase5b = read("scripts/verify-admin-users-phase5-enforcement-simulation-negative-path-safety.mjs");
const pkg = JSON.parse(read("package.json"));

console.log("\nRESULT: admin users phase 7C no-lockout future smoke plan readiness verifier");

assert(phase7a.includes("Phase 7A locks staged activation planning prerequisites"), "Phase 7A remains locked before no-lockout smoke planning");
assert(phase7b.includes("Recommended later first target is read-only /admin/audit-history"), "Phase 7B first target recommendation remains /admin/audit-history");
assert(registry.includes("return String(process.env.BARSH_ADMIN_PERMISSIONS_ENFORCEMENT ?? \"\").trim() === \"1\""), "enforcement remains exact-match env gated");
assert(registry.includes("BARSH_ADMIN_PERMISSION_OVERRIDES_JSON") && registry.includes("parsed?.block") && registry.includes("Unknown admin permission override ignored"), "override JSON block shape remains available for future ephemeral smoke");
assert(registry.includes("/admin/audit-history") && registry.includes("admin.auditHistory.view") && registry.includes("enforcementPlanned: false"), "future blocked target remains mapped but not activated: /admin/audit-history");
assert(auditPage.includes("Read-only administrator view") && auditPage.includes("does not enable permission enforcement"), "future first target remains read-only/non-enforcing");
for (const path of ["/admin", "/admin/permissions", "/api/admin/permissions", "/api/admin/permissions/check"]) {
  assert(registry.includes(path), "future no-lockout smoke must preserve never-block target: " + path);
}
assert(proxy.includes("permissionDecision.enforcementEnabled && permissionDecision.blocked") && proxy.includes("blockedUrl.pathname = \"/admin/permissions\""), "future blocked page smoke would redirect to never-block permissions page");
assert(permissionCheck.includes("Permission check target is blocked by current admin permission overrides.") && permissionCheck.includes("Read-only permission decision check. This endpoint does not enforce blocking."), "future permission-check smoke has blocked diagnostic but remains read-only");
assert(sessionRoute.includes("permissionsEnforced: configuredAdminPermissionsEnforcementEnabled()"), "future rollback smoke can confirm permissionsEnforced=false through session route");
assert(permissionsApi.includes("enforcementEnabled: configuredAdminPermissionsEnforcementEnabled()") && permissionsApi.includes("routeDryRun: adminRoutePermissionDryRunDecisions()"), "future smoke can inspect enforcement and route dry-run diagnostics");
assert(permissionsPage.includes("data-barsh-admin-permissions-blocked-notice=\"true\"") && permissionsPage.includes("This safety page remains available"), "future blocked redirect has visible never-block safety notice");
assert(phase5b.includes("process.env.BARSH_ADMIN_PERMISSIONS_ENFORCEMENT = \"1\"") && phase5b.includes("verifier restores BARSH_ADMIN_PERMISSIONS_ENFORCEMENT after simulation"), "existing safe model for ephemeral enforcement simulation remains restoration-only");
assert(phase4Env.includes("BARSH_ADMIN_PERMISSIONS_ENFORCEMENT") && phase4Env.includes("package.json") && phase4Env.includes("runtime source does not activate enforcement"), "persistent activation guard remains locked");
assert(registry.includes("enforcementPlanned: false") && !registry.includes("enforcementPlanned: true"), "Phase 7C does not activate enforcementPlanned on any route");
for (const file of ["lib/adminPermissions.ts", "proxy.ts", "app/api/auth/session/route.ts", "app/api/admin/permissions/route.ts", "app/api/admin/permissions/check/route.ts", "app/admin/permissions/page.tsx", "app/admin/audit-history/page.tsx"]) {
  const src = read(file);
  assert(!/process[.]env[.]BARSH_ADMIN_PERMISSIONS_ENFORCEMENT[ \t]*=/.test(src), "runtime source does not assign enforcement flag: " + file);
}
assert(pkg.scripts && pkg.scripts["verify:admin-users-phase7-no-lockout-smoke-plan-readiness-safety"] === "node scripts/verify-admin-users-phase7-no-lockout-smoke-plan-readiness-safety.mjs", "package script registered for Phase 7C verifier");

if (failures.length) {
  console.error("\nFAILURES:");
  for (const f of failures) console.error("-", f);
  process.exit(1);
}

console.log("\nPASS: Phase 7C locks the future no-lockout smoke plan as verifier-only: future testing must use ephemeral env, preserve never-block routes, target read-only /admin/audit-history first, prove rollback, and avoid persistent activation.");
