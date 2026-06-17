const fs = require("fs");

const failures = [];
const read = (file) => fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";

function assert(condition, message) {
  if (!condition) failures.push(message);
}

const pkg = JSON.parse(read("package.json"));
const scripts = pkg.scripts || {};
const registry = read("lib/adminPermissions.ts");
const sessionRoute = read("app/api/auth/session/route.ts");
const authSmoke = read("scripts/verify-prod-auth-admin-smoke.mjs");
const adminPage = read("app/admin/page.tsx");
const permissionsPage = read("app/admin/permissions/page.tsx");
const usersPage = read("app/admin/users/page.tsx");
const auditPage = read("app/admin/audit-history/page.tsx");
const writeContracts = read("lib/adminUsersWriteContracts.ts");
const planning = read("lib/adminUsersPlanning.ts");
const phase8 = read("scripts/verify-admin-users-phase8-completion-safety.cjs");
const phase8c = read("scripts/verify-admin-users-phase8c-smoke-execution-boundary-safety.cjs");

console.log("RESULT: admin users Phase 9A auth/session no-lockout planning safety verifier");

assert(registry.includes('pattern: "/admin/audit-history"') && registry.includes('permission: "admin.auditHistory.view"'), "first target remains /admin/audit-history mapped to admin.auditHistory.view");
assert(registry.includes('enforcementPlanned: false') && !registry.includes('enforcementPlanned: true'), "Phase 9A keeps every mapped route enforcementPlanned=false");
assert(registry.includes('return String(process.env.BARSH_ADMIN_PERMISSIONS_ENFORCEMENT ?? "").trim() === "1"'), "enforcement remains exact-match env gated");

for (const route of ["/admin", "/admin/permissions", "/api/admin/permissions", "/api/admin/permissions/check"]) {
  assert(registry.includes(`"${route}"`), `never-block route remains registered: ${route}`);
}
assert(registry.includes('if (pattern === "/admin") return cleanPath === "/admin"'), "/admin never-block matching remains exact-only");
assert(registry.includes("cleanPath.startsWith(`${pattern}/`)"), "subpath never-block matching remains narrowed for non-/admin entries");
assert(registry.includes("Never-block safety route remains allowed to prevent administrator lockout."), "never-block diagnostic remains present");

assert(sessionRoute.includes("authenticated") || sessionRoute.includes("admin"), "/api/auth/session exposes authentication/admin session state");
assert(authSmoke.includes('request("/api/auth/session", "GET", false)') && authSmoke.includes("/api/auth/session returns 200"), "existing auth smoke uses /api/auth/session as rollback/session proof");
assert(adminPage.includes('/api/auth/session') || usersPage.includes('/api/auth/session'), "admin UI has session-aware authentication check");
assert(permissionsPage.includes("No enforcement is active now") && permissionsPage.includes("Set BARSH_ADMIN_PERMISSIONS_ENFORCEMENT=1 only in a later enforcement phase"), "permissions page still discloses non-activation");
assert(auditPage.includes('data-barsh-admin-audit-history="true"') && auditPage.includes('data-barsh-admin-users-audit-history-focus="read-only"'), "audit-history remains read-only smoke target candidate");

assert(writeContracts.includes("owner_admin effective permission required"), "write contracts preserve owner_admin effective-permission precondition");
assert(writeContracts.includes("bootstrap owner_admin must remain active") || writeContracts.includes("preserve at least one active bootstrapSafe owner_admin user"), "write contracts preserve bootstrap owner_admin precondition");
assert(planning.includes('key: "owner_admin"') && planning.includes("lockoutSafe: true"), "owner_admin planning role remains lockout-safe bootstrap role");

assert(phase8.includes("without persistent activation") && phase8.includes("without enforcementPlanned=true"), "Phase 8 completion verifier remains non-activation guard");
assert(phase8c.includes("smoke execution boundary") && phase8c.includes("without activating enforcement"), "Phase 8C boundary remains locked");

assert(scripts["smoke:admin-users-phase8-ephemeral-audit-history"], "opt-in Phase 8 smoke command remains registered");
for (const [name, value] of Object.entries(scripts)) {
  const text = String(value);
  assert(!text.includes("BARSH_ADMIN_PERMISSIONS_ENFORCEMENT=1"), `${name} does not persistently activate enforcement`);
  if (name.startsWith("verify:")) {
    assert(!text.includes("smoke:admin-users-phase8-ephemeral-audit-history"), `${name} does not automatically run the opt-in smoke command`);
  }
}

for (const file of [
  "lib/adminPermissions.ts",
  "app/api/auth/session/route.ts",
  "app/api/admin/permissions/check/route.ts",
  "app/admin/audit-history/page.tsx",
  "app/admin/permissions/page.tsx",
  "app/admin/users/page.tsx",
  "package.json"
]) {
  const src = read(file);
  assert(!/process[.]env[.]BARSH_ADMIN_PERMISSIONS_ENFORCEMENT\s*=/.test(src), `runtime/package source does not assign enforcement flag: ${file}`);
}

console.log("PHASE_9A_DECISION=add authenticated/no-lockout smoke readiness before any first-target enforcementPlanned=true change");
console.log("PHASE_9A_BOUNDARY=/admin/audit-history can be authenticated-reachability smoke-tested while enforcementPlanned=false, but blocked-route behavior requires a later guarded first-target phase");
console.log("PHASE_9A_NEXT=Phase 9B should add authenticated session/no-lockout smoke readiness without activating enforcement; first-target enforcementPlanned=true belongs only in a later separate guarded verifier phase");

if (failures.length) {
  console.error("FAILURES:");
  for (const failure of failures) console.error("- " + failure);
  process.exit(1);
}

console.log("PASS: Phase 9A locks auth/session, no-lockout, rollback, env non-activation, and owner_admin/bootstrap planning without enabling enforcement.");
