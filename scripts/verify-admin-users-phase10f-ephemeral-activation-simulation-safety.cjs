const fs = require("fs");

const failures = [];
const read = (file) => fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
function assert(condition, message) { if (!condition) failures.push(message); }

const pkg = JSON.parse(read("package.json"));
const scripts = pkg.scripts || {};
const harness = read("scripts/smoke-admin-users-phase10f-ephemeral-activation-simulation.cjs");
const phase10e = read("scripts/verify-admin-users-phase10e-activation-readiness-guardrails-safety.cjs");
const registry = read("lib/adminPermissions.ts");

console.log("RESULT: admin users Phase 10F ephemeral activation simulation safety verifier");

assert(scripts["smoke:admin-users-phase10f-ephemeral-activation-simulation"] === "node scripts/smoke-admin-users-phase10f-ephemeral-activation-simulation.cjs", "Phase 10F opt-in smoke script is registered");
assert(scripts["verify:admin-users-phase10f-ephemeral-activation-simulation-safety"] === "node scripts/verify-admin-users-phase10f-ephemeral-activation-simulation-safety.cjs", "Phase 10F safety verifier is registered");
assert(phase10e.includes("guarded ephemeral activation simulation"), "Phase 10E points to guarded ephemeral activation simulation");

assert(harness.includes('BARSH_ADMIN_PERMISSIONS_ENFORCEMENT: "1"'), "harness enables enforcement only inside child-process env object");
assert(harness.includes('BARSH_ADMIN_PERMISSION_OVERRIDES_JSON: ""'), "harness clears overrides in child process");
assert(harness.includes("BARSH_PHASE10F_ADMIN_PASSWORD"), "harness requires password env input without hardcoding password");
assert(harness.includes('"permissionsEnforced":true'), "harness proves child process sees permissionsEnforced true");
assert(harness.includes('"authenticated":true'), "harness proves authenticated session");
assert(harness.includes("/admin/audit-history"), "harness tests first planned target");
for (const path of ["/admin", "/admin/permissions", "/api/admin/permissions", "/api/admin/permissions/check"]) {
  assert(harness.includes(path), `harness tests never-block route: ${path}`);
}
assert(harness.includes("sole owner_admin must reach /admin/audit-history"), "harness encodes sole-user full-access expectation");
assert(harness.includes("child.kill") && harness.includes("SIGTERM"), "harness stops child process");

const plannedMatches = [...registry.matchAll(/enforcementPlanned:\s*true/g)];
assert(plannedMatches.length === 1, "exactly one planned target exists");
if (plannedMatches.length === 1) {
  const pos = plannedMatches[0].index || 0;
  const start = registry.lastIndexOf("pattern:", pos);
  const endRaw = registry.indexOf("pattern:", pos + 1);
  const block = registry.slice(start, endRaw > 0 ? endRaw : registry.length);
  assert(block.includes('pattern: "/admin/audit-history"') && block.includes('permission: "admin.auditHistory.view"'), "the only planned target is /admin/audit-history :: admin.auditHistory.view");
}

for (const [name, value] of Object.entries(scripts)) {
  const text = String(value);
  if (name.startsWith("verify:")) {
    assert(!text.includes("smoke:admin-users-phase10f-ephemeral-activation-simulation"), `${name} does not automatically run Phase 10F smoke`);
    assert(!text.includes("smoke:admin-users-phase9d-authenticated-no-lockout"), `${name} does not automatically run Phase 9D smoke`);
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
  assert(!/^\s*BARSH_ADMIN_PERMISSIONS_ENFORCEMENT\s*=\s*1\s*$/m.test(src), `source does not contain standalone enforcement env activation line: ${file}`);
}

console.log("PHASE_10F_BOUNDARY=activation simulation is child-process-only and opt-in");
console.log("PHASE_10F_REQUIRED_PASSWORD=BARSH_PHASE10F_ADMIN_PASSWORD supplied at runtime only");
console.log("PHASE_10F_NEXT=run opt-in smoke manually; if it passes, consider final persistent activation only in a separate phase");

if (failures.length) {
  console.error("FAILURES:");
  for (const failure of failures) console.error("- " + failure);
  process.exit(1);
}

console.log("PASS: Phase 10F ephemeral activation simulation is safety-guarded without persistent activation.");
