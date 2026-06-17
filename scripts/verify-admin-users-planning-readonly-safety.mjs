import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const failures = [];
const registry = read("lib/adminPermissions.ts");
const planning = read("lib/adminUsersPlanning.ts");
const api = read("app/api/admin/users/planning/route.ts");
const page = read("app/admin/users/page.tsx");
const home = read("app/admin/page.tsx");
const pkg = JSON.parse(read("package.json"));

for (const required of ["ADMIN_ROLE_PLANNING_DEFINITIONS", "ADMIN_USER_PLANNING_ROWS", "effectiveAdminUserPlanningRows", "planning-only"]) if (!planning.includes(required)) failures.push("planning registry missing " + required);
for (const required of ["action: \"admin-users-roles-planning-read-only\"", "configuredAdminPermissionsEnforcementEnabled", "does not create users", "does not create users, edit roles, assign permissions"]) if (!api.includes(required)) failures.push("planning API missing " + required);
for (const required of ["data-barsh-admin-users-planning-page=\"read-only\"", "data-barsh-admin-users-planning-summary=\"true\"", "data-barsh-admin-users-planning-users=\"true\"", "data-barsh-admin-users-planning-roles=\"true\"", "fetch(\"/api/admin/users/planning\""]) if (!page.includes(required)) failures.push("planning page missing " + required);
for (const forbidden of ["POST", "PUT", "PATCH", "DELETE", "prisma.", "create(", "update(", "delete("]) if (api.includes(forbidden) || page.includes(forbidden)) failures.push("users planning surface must remain read-only; found forbidden fragment " + forbidden);
for (const required of ["pattern: \"/admin/users\"", "pattern: \"/api/admin/users/planning\""]) if (!registry.includes(required)) failures.push("permissions registry missing " + required);
for (const required of ["label: \"Users / Roles\"", "href: \"/admin/users\""]) if (!home.includes(required)) failures.push("admin home missing users planning card " + required);
for (const required of ["\"/admin\"", "\"/admin/permissions\"", "\"/api/admin/permissions\"", "\"/api/admin/permissions/check\""]) if (!registry.includes(required)) failures.push("lockout safety route missing after users planning patch " + required);
if (pkg.scripts?.["verify:admin-users-planning-readonly-safety"] !== "node scripts/verify-admin-users-planning-readonly-safety.mjs") failures.push("package.json missing verify:admin-users-planning-readonly-safety script");

console.log("RESULT: admin users planning read-only safety verifier");
if (failures.length) {
  console.log("FAILURES=" + failures.length);
  for (const failure of failures) console.log("FAIL=" + failure);
  process.exit(1);
}
console.log("FAILURES=0");
console.log("PASS: read-only admin users/roles planning surface exists without write controls, persistence, or enforcement-default changes.");
