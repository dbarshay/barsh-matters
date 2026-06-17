const fs = require("fs");

const failures = [];
const read = (file) => fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";

function assert(condition, message) {
  if (!condition) failures.push(message);
}

const pkg = JSON.parse(read("package.json"));
const scripts = pkg.scripts || {};
const harness = read("scripts/smoke-admin-users-phase9d-authenticated-no-lockout.cjs");
const phase9c = read("scripts/verify-admin-users-phase9c-opt-in-authenticated-no-lockout-smoke-readiness-safety.cjs");
const registry = read("lib/adminPermissions.ts");
const sessionRoute = read("app/api/auth/session/route.ts");

console.log("RESULT: admin users Phase 9D authenticated/no-lockout smoke harness safety verifier");

assert(scripts["smoke:admin-users-phase9d-authenticated-no-lockout"] === "node scripts/smoke-admin-users-phase9d-authenticated-no-lockout.cjs", "Phase 9D opt-in smoke command is registered");
assert(scripts["verify:admin-users-phase9d-authenticated-no-lockout-smoke-harness-safety"] === "node scripts/verify-admin-users-phase9d-authenticated-no-lockout-smoke-harness-safety.cjs", "Phase 9D safety verifier is registered");
assert(phase9c.includes("PHASE_9C_NEXT=build opt-in authenticated/no-lockout smoke harness"), "Phase 9C points to building this opt-in harness");

assert(harness.includes("BARSH_PHASE9D_AUTH_COOKIE"), "harness supports authenticated Cookie header input");
assert(harness.includes("/api/auth/session"), "harness checks /api/auth/session rollback/session proof");
assert(harness.includes(`request("/api/auth/session", { auth: true })`), "harness sends auth cookie to primary session authentication proof");
assert(harness.includes("/admin/audit-history"), "harness targets read-only audit-history reachability");
for (const path of ["/admin", "/admin/permissions", "/api/admin/permissions", "/api/admin/permissions/check"]) {
  assert(harness.includes(path), `harness checks never-block path: ${path}`);
}
assert(harness.includes("AUTHENTICATED_REACHABILITY=SKIPPED_NO_BARSH_PHASE9D_AUTH_COOKIE"), "harness skips authenticated target only when no auth cookie is supplied");
assert(harness.includes("did not report authenticated=true"), "harness fails when auth cookie is supplied but session is not authenticated");
assert(harness.includes("authenticated audit-history reachability must return 200"), "harness requires true authenticated audit-history 200 reachability when auth cookie is supplied");
assert(harness.includes("child.kill") && harness.includes("SIGTERM"), "harness stops its child process");
assert(harness.includes("BARSH_ADMIN_PERMISSIONS_ENFORCEMENT: \"\""), "harness clears enforcement env for child process");
assert(harness.includes("BARSH_ADMIN_PERMISSION_OVERRIDES_JSON: \"\""), "harness clears override env for child process");
assert(!harness.includes("BARSH_ADMIN_PERMISSIONS_ENFORCEMENT=1"), "harness does not persistently activate enforcement");
assert(!harness.includes("enforcementPlanned: true"), "harness does not set first-target enforcement planning true");

assert(registry.includes('enforcementPlanned: false') && !registry.includes('enforcementPlanned: true'), "registry remains enforcementPlanned false");
assert(sessionRoute.includes("permissionsEnforced") && sessionRoute.includes("authenticated"), "session route exposes rollback/auth diagnostics");

for (const [name, value] of Object.entries(scripts)) {
  const text = String(value);
  assert(!text.includes("BARSH_ADMIN_PERMISSIONS_ENFORCEMENT=1"), `${name} does not persistently activate enforcement`);
  if (name.startsWith("verify:")) {
    assert(!text.includes("smoke:admin-users-phase9d-authenticated-no-lockout"), `${name} does not automatically run Phase 9D opt-in smoke`);
    assert(!text.includes("smoke:admin-users-phase8-ephemeral-audit-history"), `${name} does not automatically run Phase 8 opt-in smoke`);
  }
}

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

console.log("PHASE_9D_BOUNDARY=smoke harness is opt-in only; normal verifiers do not execute it");
console.log("PHASE_9D_AUTH_MODE=BARSH_PHASE9D_AUTH_COOKIE supplies authenticated admin session Cookie header when available");
console.log("PHASE_9D_NEXT=run opt-in harness manually with authenticated cookie, then decide whether first-target enforcement planning can be separately guarded");

if (failures.length) {
  console.error("FAILURES:");
  for (const failure of failures) console.error("- " + failure);
  process.exit(1);
}

console.log("PASS: Phase 9D opt-in authenticated/no-lockout smoke harness is registered and safety-guarded without persistent activation.");
