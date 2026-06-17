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
const phase9b = read("scripts/verify-admin-users-phase9b-authenticated-no-lockout-smoke-readiness-safety.cjs");
const phase9a = read("scripts/verify-admin-users-phase9-auth-session-planning-safety.cjs");
const phase8Smoke = read("scripts/smoke-admin-users-phase8-ephemeral-audit-history.cjs");
const phase8SmokeSafety = read("scripts/verify-admin-users-phase8-ephemeral-smoke-harness-safety.cjs");
const auditPage = read("app/admin/audit-history/page.tsx");
const adminPage = read("app/admin/page.tsx");
const permissionsPage = read("app/admin/permissions/page.tsx");
const usersPage = read("app/admin/users/page.tsx");
const writeContracts = read("lib/adminUsersWriteContracts.ts");
const planning = read("lib/adminUsersPlanning.ts");

console.log("RESULT: admin users Phase 9C opt-in authenticated/no-lockout smoke readiness safety verifier");

assert(scripts["verify:admin-users-phase9b-authenticated-no-lockout-smoke-readiness-safety"] === "node scripts/verify-admin-users-phase9b-authenticated-no-lockout-smoke-readiness-safety.cjs", "Phase 9B verifier remains registered");
assert(phase9b.includes("PHASE_9B_NEXT=add an opt-in authenticated/no-lockout smoke harness"), "Phase 9B points to opt-in authenticated/no-lockout smoke harness as next safe path");
assert(phase9b.includes("without activating enforcement") && (phase9b.includes("without changing first-target enforcement planning") || phase9b.includes("without activating enforcement or changing first-target enforcement planning")), "Phase 9B remains non-activating");

assert(registry.includes('pattern: "/admin/audit-history"') && registry.includes('permission: "admin.auditHistory.view"'), "first target remains /admin/audit-history mapped to admin.auditHistory.view");
assert(registry.includes('enforcementPlanned: false') && !registry.includes('enforcementPlanned: true'), "Phase 9C keeps all mapped routes enforcementPlanned=false");
assert(registry.includes('return String(process.env.BARSH_ADMIN_PERMISSIONS_ENFORCEMENT ?? "").trim() === "1"'), "enforcement remains exact-match env gated");

for (const route of ["/admin", "/admin/permissions", "/api/admin/permissions", "/api/admin/permissions/check"]) {
  assert(registry.includes(`"${route}"`), `never-block route remains registered: ${route}`);
}
assert(registry.includes('if (pattern === "/admin") return cleanPath === "/admin"'), "/admin exact-only never-block match remains preserved");
assert(registry.includes("Never-block safety route remains allowed to prevent administrator lockout."), "never-block diagnostic remains preserved");

assert(sessionRoute.includes("permissionsEnforced") && sessionRoute.includes("authenticated"), "/api/auth/session remains rollback/authentication diagnostic path");
assert(auditPage.includes('data-barsh-admin-audit-history="true"') && auditPage.includes('data-barsh-admin-users-audit-history-focus="read-only"'), "audit-history remains read-only authenticated reachability target");
assert(adminPage.includes("/admin/audit-history") || usersPage.includes("/admin/audit-history"), "admin UI links to audit-history first target");
assert(usersPage.includes("admin.auditHistory.view"), "users UI still exposes audit-history permission planning key");
assert(permissionsPage.includes("No enforcement is active now") && permissionsPage.includes("Set BARSH_ADMIN_PERMISSIONS_ENFORCEMENT=1 only in a later enforcement phase"), "permissions page still discloses non-activation");

assert(proxy.includes("permissions") && proxy.includes("blocked") && proxy.includes("NextResponse"), "proxy retains future permission decision wiring");
assert(proxy.includes("/admin/permissions"), "proxy retains never-block fallback to permissions diagnostics");

assert(phase8Smoke.includes("child") && phase8Smoke.includes("/api/auth/session") && phase8Smoke.includes("/admin/audit-history"), "existing Phase 8 opt-in smoke demonstrates required child-process/session/target structure");
assert(phase8SmokeSafety.includes("normal verifier scripts do not execute the ephemeral smoke harness"), "existing smoke safety verifier locks opt-in-only command boundary");
assert(scripts["smoke:admin-users-phase8-ephemeral-audit-history"], "existing opt-in smoke remains registered separately");

for (const [name, value] of Object.entries(scripts)) {
  const text = String(value);
  assert(!text.includes("BARSH_ADMIN_PERMISSIONS_ENFORCEMENT=1"), `${name} does not persistently activate enforcement`);
  if (name.startsWith("verify:")) {
    assert(!text.includes("smoke:admin-users-phase8-ephemeral-audit-history"), `${name} does not automatically run existing opt-in smoke`);
    assert(!text.includes("smoke:admin-users-phase9c-authenticated-no-lockout"), `${name} does not automatically run future Phase 9C opt-in smoke`);
  }
}

assert(writeContracts.includes("owner_admin effective permission required"), "owner_admin effective-permission precondition remains documented");
assert(writeContracts.includes("bootstrap owner_admin must remain active") || writeContracts.includes("preserve at least one active bootstrapSafe owner_admin user"), "bootstrap owner_admin preservation remains documented");
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

console.log("PHASE_9C_DECISION=next executable smoke should be opt-in only and authenticated/no-lockout focused");
console.log("PHASE_9C_REQUIRED_SHAPE=future harness starts/stops its own child process, uses session diagnostics, checks never-block routes, checks authenticated reachability target, and proves rollback through /api/auth/session");
console.log("PHASE_9C_BOUNDARY=no first-target enforcement planning change yet; blocked-route behavior remains deferred");
console.log("PHASE_9C_NEXT=build opt-in authenticated/no-lockout smoke harness in a separate phase, still without persistent enforcement activation");

if (failures.length) {
  console.error("FAILURES:");
  for (const failure of failures) console.error("- " + failure);
  process.exit(1);
}

console.log("PASS: Phase 9C locks opt-in authenticated/no-lockout smoke harness readiness without activating enforcement or changing first-target enforcement planning.");
