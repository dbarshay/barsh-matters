#!/usr/bin/env node
import fs from "node:fs";

const failures = [];

function read(path) {
  return fs.existsSync(path) ? fs.readFileSync(path, "utf8") : "";
}

function assert(condition, message) {
  if (!condition) failures.push(message);
  else console.log(`PASS: ${message}`);
}

const files = {
  pkg: "package.json",
  registry: "lib/adminPermissions.ts",
  proxy: "proxy.ts",
  usersPage: "app/admin/users/page.tsx",
  auditHistoryPage: "app/admin/audit-history/page.tsx",
  permissionsPage: "app/admin/permissions/page.tsx",
  permissionCheck: "app/api/admin/permissions/check/route.ts",
  phase6c: "scripts/verify-admin-users-phase6-audit-visibility-readiness-safety.mjs",
  phase6d: "scripts/verify-admin-users-phase6-negative-path-diagnostics-readiness-safety.mjs",
  phase5b: "scripts/verify-admin-users-phase5-enforcement-simulation-negative-path-safety.mjs",
  phase5c: "scripts/verify-admin-users-phase5-permission-check-negative-path-safety.mjs",
  phase5d: "scripts/verify-admin-users-phase5-simulation-completion-safety.mjs",
  phase4Completion: "scripts/verify-admin-users-phase4-completion-safety.mjs",
  phase4Env: "scripts/verify-admin-users-phase4-env-deployment-readiness-safety.mjs",
};

for (const [label, path] of Object.entries(files)) {
  assert(fs.existsSync(path), `${label} file exists: ${path}`);
}

const pkg = JSON.parse(read(files.pkg));
const registry = read(files.registry);
const proxy = read(files.proxy);
const usersPage = read(files.usersPage);
const auditHistoryPage = read(files.auditHistoryPage);
const permissionsPage = read(files.permissionsPage);
const permissionCheck = read(files.permissionCheck);
const phase6c = read(files.phase6c);
const phase6d = read(files.phase6d);
const phase5b = read(files.phase5b);
const phase5c = read(files.phase5c);
const phase5d = read(files.phase5d);
const phase4Completion = read(files.phase4Completion);
const phase4Env = read(files.phase4Env);

assert(pkg.scripts?.["verify:admin-users-phase6-audit-visibility-readiness-safety"] === "node scripts/verify-admin-users-phase6-audit-visibility-readiness-safety.mjs", "Phase 6C verifier script registered");
assert(pkg.scripts?.["verify:admin-users-phase6-negative-path-diagnostics-readiness-safety"] === "node scripts/verify-admin-users-phase6-negative-path-diagnostics-readiness-safety.mjs", "Phase 6D verifier script registered");
assert(pkg.scripts?.["verify:admin-users-phase6-completion-safety"] === "node scripts/verify-admin-users-phase6-completion-safety.mjs", "Phase 6E completion verifier script registered");

assert(registry.includes('"admin.users.manage"'), "admin.users.manage permission remains typed and defined");
assert(registry.includes('"Users / Roles"'), "Users / Roles category remains typed");
for (const route of ["/api/admin/users/create", "/api/admin/users/assign-role", "/api/admin/users/remove-role", "/api/admin/users/permission-override"]) {
  assert(registry.includes(`"${route}"`) && registry.includes('"admin.users.manage"') && registry.includes("enforcementPlanned: false"), `${route} remains mapped readiness-only to admin.users.manage`);
}
for (const route of ['"/admin"', '"/admin/permissions"', '"/api/admin/permissions"', '"/api/admin/permissions/check"']) {
  assert(registry.includes(route), `${route} remains present for never-block/lockout safety`);
}
assert(registry.includes("Never-block safety route remains allowed to prevent administrator lockout."), "never-block diagnostic reason remains present");
assert(registry.includes("Enforcement disabled; route would be blocked if enforcement were enabled."), "dry-run blocked diagnostic reason remains present");
assert(registry.includes('return String(process.env.BARSH_ADMIN_PERMISSIONS_ENFORCEMENT ?? "").trim() === "1"'), "enforcement remains exact-match env gated");

assert(proxy.includes("permissionDecision.enforcementEnabled && permissionDecision.blocked"), "proxy future enforcement remains flag-gated");
assert(proxy.includes('blockedUrl.pathname = "/admin/permissions"'), "blocked admin pages still redirect to never-block permissions page");
assert(proxy.includes('blockedUrl.searchParams.set("blocked", "1")'), "blocked page diagnostic query flag remains present");
assert(proxy.includes('blockedUrl.searchParams.set("from", `${pathname}${req.nextUrl.search}`)'), "blocked page diagnostic from path remains present");

assert(permissionsPage.includes('data-barsh-admin-permissions-blocked-notice="true"'), "permissions page blocked notice remains visible");
assert(permissionsPage.includes("Dry-run only"), "permissions page dry-run diagnostics remain visible");
assert(permissionsPage.includes("No enforcement is active now"), "permissions page non-enforcement copy remains visible");

assert(permissionCheck.includes("decision.enforcementEnabled && decision.blocked"), "permission-check blocked branch remains gated");
assert(permissionCheck.includes("Read-only permission decision check. This endpoint does not enforce blocking."), "permission-check endpoint remains read-only");
assert(permissionCheck.includes("Permission check target is blocked by current admin permission overrides."), "permission-check blocked diagnostic remains present");

assert(usersPage.includes('data-barsh-admin-users-audit-visibility="read-only"'), "admin users page exposes read-only audit visibility link/card");
assert(usersPage.includes('/admin/audit-history'), "admin users page links to audit history");
assert(usersPage.includes("Enforcement Disabled"), "admin users page enforcement disabled banner remains visible");
assert(usersPage.includes("Enable Enforcement") && usersPage.includes("Not available"), "admin users page keeps enforcement activation unavailable");

assert(auditHistoryPage.includes('data-barsh-admin-users-audit-history-focus="read-only"'), "audit history page exposes focused read-only admin users audit section");
for (const action of ["admin-user-create", "admin-user-assign-role", "admin-user-remove-role", "admin-user-permission-override"]) {
  assert(auditHistoryPage.includes(action), `audit history page labels ${action}`);
}

assert(phase6c.includes("admin users write actions are audit logged") && phase6c.includes("visible through read-only audit history") && phase6c.includes("enforcement remains disabled"), "Phase 6C audit visibility verifier contract remains intact");
assert(phase6d.includes("controlled negative-path diagnostics remain visible") && phase6d.includes("read-only/test-only") && phase6d.includes("lockout-safe") && phase6d.includes("non-activating"), "Phase 6D negative-path diagnostics verifier contract remains intact");

assert(phase5b.includes("temporary simulation blocks all four guarded admin users manage write routes"), "Phase 5B negative-path simulation remains locked");
assert(phase5b.includes("verifier restores BARSH_ADMIN_PERMISSIONS_ENFORCEMENT after simulation"), "Phase 5B env restoration remains locked");
assert(phase5c.includes("permission-check endpoint blocked branch remains gated by enforcement decision"), "Phase 5C permission-check negative path remains locked");
assert(phase5d.includes("Phase 5D confirms Phase 5 enforcement simulation and permission-check negative-path coverage are locked"), "Phase 5D completion contract remains locked");
assert(phase4Completion.includes("Phase 4 enforcement-readiness is complete"), "Phase 4 completion contract remains locked");
assert(phase4Env.includes("Phase 4 environment/deployment readiness is safe"), "Phase 4 env/deployment contract remains locked");

const runtimeSources = [
  read("package.json"),
  read("proxy.ts"),
  registry,
  read("app/api/auth/session/route.ts"),
  read("app/api/admin/permissions/route.ts"),
  permissionCheck,
].join("\n");

for (const forbidden of ["process.env.BARSH_ADMIN_PERMISSIONS_ENFORCEMENT =", "enforcementPlanned: true"]) {
  assert(!runtimeSources.includes(forbidden), `runtime/config sources do not contain activation fragment: ${forbidden}`);
}

console.log("RESULT: admin users phase 6 completion safety verifier");
if (failures.length) {
  console.log(`FAILURES=${failures.length}`);
  for (const failure of failures) console.log(`FAIL=${failure}`);
  process.exit(1);
}
console.log("FAILURES=0");
console.log("PASS: Phase 6 is complete: audit visibility and controlled negative-path diagnostics are locked while enforcement remains non-activating.");
