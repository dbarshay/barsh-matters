const fs = require("fs");

const failures = [];
const read = (file) => fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";

function assert(condition, message) {
  if (!condition) failures.push(message);
}

const pkg = JSON.parse(read("package.json"));
const scripts = pkg.scripts || {};
const registry = read("lib/adminPermissions.ts");
const proxy = read("proxy.ts");
const sessionRoute = read("app/api/auth/session/route.ts");
const authSmoke = read("scripts/verify-prod-auth-admin-smoke.mjs");
const phase9a = read("scripts/verify-admin-users-phase9-auth-session-planning-safety.cjs");
const phase8Smoke = read("scripts/smoke-admin-users-phase8-ephemeral-audit-history.cjs");
const phase8a = read("scripts/verify-admin-users-phase8-ephemeral-smoke-harness-readiness-safety.cjs");
const phase7 = read("scripts/verify-admin-users-phase7-completion-safety.mjs");
const auditPage = read("app/admin/audit-history/page.tsx");
const adminPage = read("app/admin/page.tsx");
const permissionsPage = read("app/admin/permissions/page.tsx");
const usersPage = read("app/admin/users/page.tsx");
const permissionsApi = read("app/api/admin/permissions/route.ts");
const permissionsCheckApi = read("app/api/admin/permissions/check/route.ts");
const writeContracts = read("lib/adminUsersWriteContracts.ts");
const planning = read("lib/adminUsersPlanning.ts");

console.log("RESULT: admin users Phase 9B authenticated/no-lockout smoke readiness safety verifier");

assert(scripts["verify:admin-users-phase9-auth-session-planning-safety"] === "node scripts/verify-admin-users-phase9-auth-session-planning-safety.cjs", "Phase 9A verifier remains registered");
assert(phase9a.includes("PHASE_9A_NEXT=Phase 9B should add authenticated session/no-lockout smoke readiness without activating enforcement"), "Phase 9A points to Phase 9B authenticated/no-lockout readiness");
assert(phase9a.includes("without enabling enforcement"), "Phase 9A remains non-activating");

assert(registry.includes('pattern: "/admin/audit-history"') && registry.includes('permission: "admin.auditHistory.view"'), "first target remains /admin/audit-history mapped to admin.auditHistory.view");
assert(registry.includes('enforcementPlanned: false') && !registry.includes('enforcementPlanned: true'), "Phase 9B keeps all mapped routes enforcementPlanned=false");
assert(registry.includes('return String(process.env.BARSH_ADMIN_PERMISSIONS_ENFORCEMENT ?? "").trim() === "1"'), "enforcement remains exact-match env gated");

for (const route of ["/admin", "/admin/permissions", "/api/admin/permissions", "/api/admin/permissions/check"]) {
  assert(registry.includes(`"${route}"`), `never-block route remains registered: ${route}`);
}
assert(registry.includes('if (pattern === "/admin") return cleanPath === "/admin"'), "/admin exact-only never-block match remains preserved");
assert(registry.includes("Never-block safety route remains allowed to prevent administrator lockout."), "never-block diagnostic remains preserved");

assert(sessionRoute.includes("permissionsEnforced") && sessionRoute.includes("authenticated"), "/api/auth/session exposes authenticated state and permissionsEnforced rollback diagnostic");
assert(authSmoke.includes('request("/api/auth/session", "GET", false)') && authSmoke.includes("/api/auth/session returns 200"), "existing auth smoke proves /api/auth/session rollback/session diagnostics are reachable");
assert(adminPage.includes('/api/auth/session') || usersPage.includes('/api/auth/session'), "admin surfaces remain session-aware");

assert(phase8a.includes("permissions API exposes enforcement and override diagnostics"), "locked Phase 8A verifier already proves permissions API diagnostic readiness");
assert(phase8a.includes("permission-check endpoint remains read-only diagnostic surface") || phase7.includes("permission-check endpoint remains read-only diagnostic"), "locked prior verifier proves permission-check diagnostic readiness");
assert(permissionsApi.includes("permissions") || permissionsApi.includes("routes") || permissionsApi.includes("override") || permissionsApi.includes("enforcement"), "permissions API source still contains diagnostic surface terms");
assert(permissionsCheckApi.includes("permission") || permissionsCheckApi.includes("allowed") || permissionsCheckApi.includes("diagnostic") || permissionsCheckApi.includes("enforcement"), "permission-check source still contains read-only diagnostic terms");

assert(auditPage.includes('data-barsh-admin-audit-history="true"') && auditPage.includes('data-barsh-admin-users-audit-history-focus="read-only"'), "audit-history page remains read-only authenticated reachability target candidate");
assert(adminPage.includes("/admin/audit-history") || usersPage.includes("/admin/audit-history"), "admin UI links to audit-history first target");
assert(usersPage.includes("admin.auditHistory.view"), "users UI still exposes audit-history permission planning key");

assert(proxy.includes("permissions") && proxy.includes("blocked") && proxy.includes("NextResponse"), "proxy retains future permission decision wiring");
assert(proxy.includes("/admin/permissions"), "proxy retains blocked fallback to never-block permissions diagnostics");
assert(!proxy.includes("BARSH_ADMIN_PERMISSIONS_ENFORCEMENT=1"), "proxy does not persistently activate enforcement");

assert(phase8Smoke.includes("BARSH_ADMIN_PERMISSIONS_ENFORCEMENT") && phase8Smoke.includes("child") && phase8Smoke.includes("/api/auth/session"), "existing opt-in smoke remains child-process/rollback based");
assert(scripts["smoke:admin-users-phase8-ephemeral-audit-history"], "opt-in Phase 8 smoke remains registered but separate");
for (const [name, value] of Object.entries(scripts)) {
  const text = String(value);
  assert(!text.includes("BARSH_ADMIN_PERMISSIONS_ENFORCEMENT=1"), `${name} does not persistently activate enforcement`);
  if (name.startsWith("verify:")) {
    assert(!text.includes("smoke:admin-users-phase8-ephemeral-audit-history"), `${name} does not automatically run the opt-in Phase 8 smoke command`);
  }
}

assert(writeContracts.includes("owner_admin effective permission required"), "owner_admin effective-permission precondition remains documented before any later activation");
assert(writeContracts.includes("bootstrap owner_admin must remain active") || writeContracts.includes("preserve at least one active bootstrapSafe owner_admin user"), "bootstrap owner_admin preservation remains documented before any later activation");
assert(planning.includes('key: "owner_admin"') && planning.includes("lockoutSafe: true"), "owner_admin remains lockout-safe bootstrap role");

for (const file of [
  "lib/adminPermissions.ts",
  "proxy.ts",
  "app/api/auth/session/route.ts",
  "app/api/admin/permissions/route.ts",
  "app/api/admin/permissions/check/route.ts",
  "app/admin/audit-history/page.tsx",
  "app/admin/permissions/page.tsx",
  "app/admin/users/page.tsx",
  "package.json"
]) {
  const src = read(file);
  assert(!/process[.]env[.]BARSH_ADMIN_PERMISSIONS_ENFORCEMENT\s*=/.test(src), `source does not assign process.env enforcement flag: ${file}`);
  assert(!/^\s*BARSH_ADMIN_PERMISSIONS_ENFORCEMENT\s*=\s*1\s*$/m.test(src), `source does not contain standalone BARSH_ADMIN_PERMISSIONS_ENFORCEMENT=1 activation line: ${file}`);
  assert(!/enforcementPlanned\s*[:=]\s*true/.test(src), `source does not set enforcementPlanned true: ${file}`);
}

console.log("PHASE_9B_DECISION=authenticated/no-lockout smoke readiness can be locked without activating enforcement");
console.log("PHASE_9B_AUTH_PATH=/api/auth/session remains the rollback/session proof path");
console.log("PHASE_9B_REACHABILITY_TARGET=/admin/audit-history remains a read-only authenticated reachability target while enforcementPlanned remains false");
console.log("PHASE_9B_BOUNDARY=blocked-route behavior still cannot be proven until a later separate guarded phase changes first-target enforcement planning");
console.log("PHASE_9B_NEXT=add an opt-in authenticated/no-lockout smoke harness or proceed to a separate first-target enforcement-planning phase only after owner_admin/bootstrap preconditions are verified");

if (failures.length) {
  console.error("FAILURES:");
  for (const failure of failures) console.error("- " + failure);
  process.exit(1);
}

console.log("PASS: Phase 9B locks authenticated session/no-lockout smoke readiness without activating enforcement or changing first-target enforcement planning.");
