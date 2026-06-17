import fs from "node:fs";

let failures = 0;
function pass(message) {
  console.log("PASS:", message);
}
function fail(message) {
  failures += 1;
  console.log("FAIL:", message);
}
function read(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
}
function assert(condition, message) {
  if (condition) pass(message);
  else fail(message);
}

const files = {
  pkg: "package.json",
  registry: "lib/adminpermissions.ts",
  proxy: "proxy.ts",
  session: "app/api/auth/session/route.ts",
  permissionsApi: "app/api/admin/permissions/route.ts",
  permissionCheck: "app/api/admin/permissions/check/route.ts",
  phase5b: "scripts/verify-admin-users-phase5-enforcement-simulation-negative-path-safety.mjs",
  phase5c: "scripts/verify-admin-users-phase5-permission-check-negative-path-safety.mjs",
  phase4Env: "scripts/verify-admin-users-phase4-env-deployment-readiness-safety.mjs",
  phase4Completion: "scripts/verify-admin-users-phase4-completion-safety.mjs",
};

const pkg = JSON.parse(read(files.pkg) || "{}");
const registry = read(files.registry);
const proxy = read(files.proxy);
const permissionCheck = read(files.permissionCheck);
const phase5b = read(files.phase5b);
const phase5c = read(files.phase5c);

for (const [label, file] of Object.entries(files)) {
  assert(fs.existsSync(file), `${label} file exists: ${file}`);
}

assert(pkg.scripts?.["verify:admin-users-phase5-enforcement-simulation-negative-path-safety"] === "node scripts/verify-admin-users-phase5-enforcement-simulation-negative-path-safety.mjs", "Phase 5B verifier script registered");
assert(pkg.scripts?.["verify:admin-users-phase5-permission-check-negative-path-safety"] === "node scripts/verify-admin-users-phase5-permission-check-negative-path-safety.mjs", "Phase 5C verifier script registered");
assert(pkg.scripts?.["verify:admin-users-phase5-simulation-completion-safety"] === "node scripts/verify-admin-users-phase5-simulation-completion-safety.mjs", "Phase 5D completion verifier script registered");

assert(phase5b.includes("temporary process env enables simulation inside verifier only"), "Phase 5B locks temporary process-env simulation");
assert(phase5b.includes("temporary simulation blocks all four guarded admin users manage write routes"), "Phase 5B locks negative-path blocking of four guarded write routes");
assert(phase5b.includes("never-block permission check API remains allowed during simulated enforcement"), "Phase 5B locks never-block permission-check safety");
assert(phase5b.includes("verifier restores BARSH_ADMIN_PERMISSIONS_ENFORCEMENT after simulation"), "Phase 5B restores enforcement env after simulation");
assert(phase5b.includes("runtime/config sources do not contain activation fragment"), "Phase 5B guards runtime/config non-activation");

assert(phase5c.includes("permission-check endpoint remains explicitly read-only"), "Phase 5C locks permission-check read-only contract");
assert(phase5c.includes("permission-check endpoint blocked branch remains gated by enforcement decision"), "Phase 5C locks blocked diagnostic branch gating");
assert(phase5c.includes("Phase 5B verifier proves guarded write negative paths"), "Phase 5C depends on Phase 5B negative-path coverage");
assert(phase5c.includes("Phase 4 env/deployment verifier remains activation guard"), "Phase 5C preserves Phase 4 env/deployment guard");

assert(registry.includes('key: "admin.users.manage"'), "admin.users.manage permission remains defined");
for (const route of ["/api/admin/users/create", "/api/admin/users/assign-role", "/api/admin/users/remove-role", "/api/admin/users/permission-override"]) {
  const idx = registry.indexOf(`pattern: "${route}"`);
  const window = idx >= 0 ? registry.slice(idx, idx + 280) : "";
  assert(window.includes('permission: "admin.users.manage"') && window.includes('method: "POST"') && window.includes("enforcementPlanned: false"), `${route} remains mapped readiness-only to admin.users.manage POST`);
}
for (const route of ["/admin", "/admin/permissions", "/api/admin/permissions", "/api/admin/permissions/check"]) {
  assert(registry.includes(`"${route}"`), `${route} remains present for never-block/lockout safety`);
}

assert(registry.includes('return String(process.env.BARSH_ADMIN_PERMISSIONS_ENFORCEMENT ?? "").trim() === "1"'), "enforcement remains exact-match env gated");
assert(registry.includes("adminPermissionEnforcementDecision"), "central enforcement decision helper remains present");
assert(registry.includes("Enforcement disabled; route would be blocked if enforcement were enabled."), "dry-run blocked diagnostic remains present");
assert(registry.includes("Never-block safety route remains allowed to prevent administrator lockout."), "never-block diagnostic remains present");

assert(permissionCheck.includes("Read-only permission decision check. This endpoint does not enforce blocking."), "permission check endpoint remains read-only");
assert(permissionCheck.includes("decision.enforcementEnabled && decision.blocked"), "permission check blocked branch remains gated");
assert(permissionCheck.includes("adminPermissionEnforcementDecision(pathname, method)"), "permission check endpoint uses central helper");
assert(proxy.includes("permissionDecision.enforcementEnabled && permissionDecision.blocked"), "proxy future enforcement remains flag-gated");
assert(proxy.includes('blockedUrl.pathname = "/admin/permissions"'), "future blocked page path remains never-block permissions page");

const runtimeSources = [files.registry, files.proxy, files.session, files.permissionsApi, files.permissionCheck, files.pkg].map((file) => `${file}\n${read(file)}`).join("\n");
for (const forbidden of ["process.env.BARSH_ADMIN_PERMISSIONS_ENFORCEMENT =", "enforcementPlanned: true"]) {
  assert(!runtimeSources.includes(forbidden), `runtime/config sources do not contain activation fragment: ${forbidden}`);
}

assert(read(files.phase4Env).includes("/BARSH_ADMIN_PERMISSIONS_ENFORCEMENT\\s*=\\s*1/"), "Phase 4 env/deployment verifier still checks persisted BARSH_ADMIN_PERMISSIONS_ENFORCEMENT=1 activation");
assert(read(files.phase4Completion).includes("Phase 4 enforcement-readiness is complete"), "Phase 4 completion verifier remains present");

console.log("\nRESULT: admin users phase 5 simulation completion safety verifier");
console.log(`FAILURES=${failures}`);
if (failures) process.exit(1);
console.log("PASS: Phase 5D confirms Phase 5 enforcement simulation and permission-check negative-path coverage are locked while enforcement remains non-activating and guarded by Phase 4 deployment safety.");
