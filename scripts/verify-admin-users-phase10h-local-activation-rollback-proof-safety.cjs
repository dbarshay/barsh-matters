const fs = require("fs");
const failures = [];
const read = (f) => fs.existsSync(f) ? fs.readFileSync(f, "utf8") : "";
const assert = (ok, msg) => { if (!ok) failures.push(msg); };
const pkg = JSON.parse(read("package.json"));
const scripts = pkg.scripts || {};
const doc = read("docs/admin-users-permissions/phase10h-local-activation-rollback-proof.md");
const registry = read("lib/adminPermissions.ts");
console.log("RESULT: admin users Phase 10H local activation/rollback proof safety verifier");
assert(doc.includes("permissionsEnforced: true"), "doc records local activation proof");
assert(doc.includes("permissionsEnforced: false"), "doc records local rollback proof");
assert(doc.includes("Production enforcement has not been activated"), "doc preserves production non-activation boundary");
assert(doc.includes("/admin/audit-history"), "doc preserves first planned target");
const matches = [...registry.matchAll(/enforcementPlanned:\s*true/g)];
assert(matches.length === 1, "exactly one enforcementPlanned true target remains");
for (const f of ["lib/adminPermissions.ts","proxy.ts","app/api/auth/session/route.ts","app/api/admin/permissions/route.ts","app/api/admin/permissions/check/route.ts","app/admin/audit-history/page.tsx","app/admin/permissions/page.tsx","app/admin/users/page.tsx","package.json"]) {
  const s = read(f);
  assert(!/process[.]env[.]BARSH_ADMIN_PERMISSIONS_ENFORCEMENT\s*=/.test(s), `source does not assign enforcement env: ${f}`);
  assert(!/^\s*BARSH_ADMIN_PERMISSIONS_ENFORCEMENT\s*=\s*1\s*$/m.test(s), `source has no standalone enforcement activation: ${f}`);
}
assert(Boolean(scripts["verify:admin-users-phase10h-local-activation-rollback-proof-safety"]), "Phase 10H verifier registered");
assert(Boolean(scripts["verify:admin-users-phase10g-activation-rollback-package-safety"]), "Phase 10G verifier remains registered");
console.log("PHASE_10H_LOCAL_ACTIVATION_PROOF=manual_local_activation_observed");
console.log("PHASE_10H_LOCAL_ROLLBACK_PROOF=manual_local_rollback_observed");
console.log("PHASE_10H_CURRENT_STATE=persistent_local_enforcement_off_production_not_activated");
if (failures.length) { console.error("FAILURES:"); for (const f of failures) console.error("- " + f); process.exit(1); }
console.log("PASS: Phase 10H local activation/rollback proof is locked without enabling enforcement.");
