import fs from "node:fs";

// Locks the reworked permission model (see docs/permission-model.md).
// Supersedes the retired 2-role / env-override "planning-only" RBAC proofs.

const catalog = fs.readFileSync("lib/admin-permissions/catalog.ts", "utf8");
const matrix = fs.readFileSync("lib/admin-permissions/roleMatrix.ts", "utf8");

const failures = [];
const must = (cond, msg) => { if (!cond) failures.push(msg); };

// --- Catalog: five tiers ---
must(catalog.includes('export type AdminPermissionTier = "view" | "edit" | "process" | "admin" | "security"'), "catalog defines the five tiers");
must(catalog.includes("tier: AdminPermissionTier"), "catalog items carry a `tier`");
for (const t of ["view", "edit", "process", "admin", "security"]) {
  must(catalog.includes(`tier: "${t}"`), `catalog uses tier "${t}"`);
}
// security tier is only the two security permissions; admin.access is admin tier
must(/key: "admin\.users\.manage"[\s\S]*?tier: "security"/.test(catalog), "admin.users.manage is security tier");
must(/key: "admin\.permissions\.manage"[\s\S]*?tier: "security"/.test(catalog), "admin.permissions.manage is security tier");
must(/key: "admin\.access"[\s\S]*?tier: "admin"/.test(catalog), "admin.access is admin tier");
// no leftover old risk labels
for (const old of ['"financial"', '"destructive"', '"administrative"', "riskLevel", "AdminPermissionRiskLevel"]) {
  must(!catalog.includes(old), `catalog dropped old model token ${old}`);
}

// --- Role matrix: five roles, cumulative tiers + security split ---
must(matrix.includes('"owner" | "administrator" | "full_user" | "partial_user" | "view_only"'), "matrix defines the five role keys");
for (const [role, tiers] of Object.entries({
  owner: '["view", "edit", "process", "admin", "security"]',
  administrator: '["view", "edit", "process", "admin"]',
  full_user: '["view", "edit", "process"]',
  partial_user: '["view", "edit"]',
  view_only: '["view"]',
})) {
  must(matrix.includes(`${role}: ${tiers}`), `${role} allowed tiers = ${tiers}`);
}
// Administrator must NOT have security; view_only must NOT have edit
must(!/administrator: \[[^\]]*"security"/.test(matrix), "administrator excludes security");
must(!/view_only: \[[^\]]*"edit"/.test(matrix), "view_only excludes edit");
// no leftover old role keys
for (const old of ["owner_admin", "read_only_admin", "getReadOnlyAdmin"]) {
  must(!matrix.includes(old), `matrix dropped old model token ${old}`);
}
// resolver helpers present
for (const fn of ["roleAllowsPermission", "roleAllowsTier", "getAllowedPermissionKeysForRole", "isAdminPermissionRoleKey"]) {
  must(matrix.includes(`function ${fn}`), `matrix exports ${fn}`);
}

if (failures.length) {
  console.error("FAIL: permission model rework");
  for (const f of failures) console.error("- " + f);
  process.exit(1);
}
console.log("PASS: reworked permission model (5 tiers, 5 roles, security=owner-only) verified.");
