import fs from "node:fs";

const failures = [];

function pass(label) {
  console.log(`PASS: ${label}`);
}

function fail(label) {
  failures.push(label);
  console.log(`FAIL: ${label}`);
}

function requireIncludes(file, text, label) {
  const source = fs.readFileSync(file, "utf8");
  if (source.includes(text)) pass(label);
  else fail(label);
}

function requireNotIncludes(file, text, label) {
  const source = fs.readFileSync(file, "utf8");
  if (!source.includes(text)) pass(label);
  else fail(label);
}

const pageFile = "app/admin/users/page.tsx";
const removeRouteFile = "app/api/admin/users/remove-role/route.ts";
const packageFile = "package.json";

if (!fs.existsSync(pageFile)) {
  fail("admin users page exists");
} else {
  pass("admin users page exists");
  requireIncludes(pageFile, 'data-barsh-admin-users-remove-role-control="phase3-guarded"', "remove role guarded UI panel present");
  requireIncludes(pageFile, 'fetch("/api/admin/users/remove-role"', "UI calls locked remove-role route");
  requireIncludes(pageFile, 'Preview Remove Role', "remove role preview button present");
  requireIncludes(pageFile, 'Apply Remove Role', "remove role apply button present");
  requireIncludes(pageFile, 'removePreviewReady', "remove role apply button gated by matching preview");
  requireIncludes(pageFile, 'Preview the role removal before applying. Apply remains disabled until a matching preview succeeds.', "remove role preview/apply contract displayed");
  requireIncludes(pageFile, 'data-barsh-admin-users-remove-target-email="true"', "target user selector present");
  requireIncludes(pageFile, 'data-barsh-admin-users-remove-role-key="true"', "assigned role selector present");
  requireIncludes(pageFile, 'data-barsh-admin-users-remove-actor-email="true"', "owner_admin actor email submitted");
  requireIncludes(pageFile, 'selectedRemoveUserRoleKeys', "remove UI uses assigned role keys for selected user");
  requireIncludes(pageFile, 'last active bootstrapSafe owner_admin user', "UI discloses last bootstrap owner protection");
  requireIncludes(pageFile, 'does not delete users, delete roles, create permission overrides, enable enforcement', "UI discloses no broader writes");
  requireIncludes(pageFile, 'Create Admin User, Assign Role, Remove Role, and Permission Override are active in guarded preview/apply mode.', "roadmap labels remove role active");
  requireIncludes(pageFile, 'Enforcement Disabled', "enforcement-disabled notice remains visible");
  requireNotIncludes(pageFile, 'Remove Role", "Block removal if it would leave no active bootstrapSafe owner_admin user.", "Preview only"', "stale remove-role preview-only roadmap text removed");
}

if (!fs.existsSync(removeRouteFile)) {
  fail("locked remove-role route still exists");
} else {
  pass("locked remove-role route still exists");
  requireIncludes(removeRouteFile, 'isAdminRequestAuthorized(req)', "remove route still requires authenticated session");
  requireIncludes(removeRouteFile, 'key: "owner_admin"', "remove route still requires owner_admin actor");
  requireIncludes(removeRouteFile, 'Cannot remove owner_admin from the last active bootstrapSafe owner_admin user.', "remove route still blocks last bootstrap owner removal");
  requireIncludes(removeRouteFile, 'if (!apply)', "remove route still defaults to preview");
  requireIncludes(removeRouteFile, 'tx.adminUserRole.delete', "remove route still deletes only join row on apply");
  requireIncludes(removeRouteFile, 'createMatterAuditLogEntry', "remove route still audit logs apply");
  requireIncludes(removeRouteFile, 'enforcementChanged: false', "remove route still reports no enforcement change");
  requireNotIncludes(removeRouteFile, 'adminUserPermissionOverride.create', "remove route still does not create overrides");
  requireNotIncludes(removeRouteFile, 'BARSH_ADMIN_PERMISSIONS_ENFORCEMENT', "remove route still does not enable enforcement");
}

const packageJson = JSON.parse(fs.readFileSync(packageFile, "utf8"));
if (packageJson.scripts?.["verify:admin-users-phase3-remove-role-ui-safety"] === "node scripts/verify-admin-users-phase3-remove-role-ui-safety.mjs") {
  pass("package remove-role UI verifier script registered");
} else {
  fail("package remove-role UI verifier script registered");
}
if (packageJson.scripts?.["verify:admin-users-phase3-remove-role-route-safety"] === "node scripts/verify-admin-users-phase3-remove-role-route-safety.mjs") {
  pass("remove-role route verifier remains registered");
} else {
  fail("remove-role route verifier remains registered");
}

console.log("\\nRESULT: admin users phase 3 remove role UI safety verifier");
console.log(`FAILURES=${failures.length}`);
if (failures.length) {
  process.exitCode = 1;
} else {
  console.log("PASS: /admin/users exposes the guarded remove-role preview/apply UI and does not add override or enforcement controls.");
}
