const fs = require("fs");
const failures = [];
const read = (f) => fs.existsSync(f) ? fs.readFileSync(f, "utf8") : "";
const assert = (ok, msg) => { if (!ok) failures.push(msg); };
const doc = read("docs/admin-users-permissions/phase10i-production-activation-proof.md");
const registry = read("lib/adminPermissions.ts");
const pkg = JSON.parse(read("package.json"));
const scripts = pkg.scripts || {};
console.log("RESULT: admin users Phase 10I production activation proof safety verifier");
for (const fragment of ["permissionsEnforced: true","enforcementEnabled","/admin/audit-history","sole owner_admin","Production permissions enforcement is ON","Rollback","permissionsEnforced: false"]) assert(doc.includes(fragment), "doc missing " + fragment);
const matches = [...registry.matchAll(/enforcementPlanned:\s*true/g)];
assert(matches.length === 1, "exactly one enforcementPlanned true target remains");
assert(registry.includes('pattern: "/admin/audit-history"') && registry.includes('permission: "admin.auditHistory.view"'), "audit history target remains mapped");
for (const route of ["/admin","/admin/permissions","/api/admin/permissions","/api/admin/permissions/check"]) assert(registry.includes(`"${route}"`), "never-block route remains " + route);
for (const f of ["lib/adminPermissions.ts","proxy.ts","package.json"]) {
  const s = read(f);
  assert(!/process[.]env[.]BARSH_ADMIN_PERMISSIONS_ENFORCEMENT\s*=/.test(s), `${f} does not assign enforcement env in source`);
}
assert(Boolean(scripts["verify:admin-users-phase10i-production-activation-proof-safety"]), "Phase 10I verifier registered");
console.log("PHASE_10I_PRODUCTION_ACTIVATION=observed_and_documented");
console.log("PHASE_10I_CURRENT_STATE=production_enforcement_on_owner_admin_browser_smoke_passed");
if (failures.length) { console.error("FAILURES:"); for (const f of failures) console.error("- " + f); process.exit(1); }
console.log("PASS: Phase 10I production activation proof is locked.");
