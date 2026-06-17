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
const assignRouteFile = "app/api/admin/users/assign-role/route.ts";
const packageFile = "package.json";

if (!fs.existsSync(pageFile)) {
  fail("admin users page exists");
} else {
  pass("admin users page exists");
  requireIncludes(pageFile, 'data-barsh-admin-users-assign-role-control="phase3-guarded"', "assign role guarded UI panel present");
  requireIncludes(pageFile, 'fetch("/api/admin/users/assign-role"', "UI calls locked assign-role route");
  requireIncludes(pageFile, 'Preview Assign Role', "assign role preview button present");
  requireIncludes(pageFile, 'Apply Assign Role', "assign role apply button present");
  requireIncludes(pageFile, 'assignPreviewReady', "assign role apply button gated by matching preview");
  requireIncludes(pageFile, 'Preview the role assignment before applying. Apply remains disabled until a matching preview succeeds.', "assign role preview/apply contract displayed");
  requireIncludes(pageFile, 'data-barsh-admin-users-assign-target-email="true"', "target active user selector present");
  requireIncludes(pageFile, 'data-barsh-admin-users-assign-role-key="true"', "active role selector present");
  requireIncludes(pageFile, 'data-barsh-admin-users-assign-actor-email="true"', "owner_admin actor email submitted");
  requireIncludes(pageFile, 'activeDbUsers', "assign UI uses active DB users");
  requireIncludes(pageFile, 'activeDbRoles', "assign UI uses active DB roles");
  requireIncludes(pageFile, 'bootstrapSafe owner_admin preservation', "UI discloses bootstrap owner preservation");
  requireIncludes(pageFile, 'does not create users, create roles, create permission overrides, enable enforcement', "UI discloses no broader writes");
  requireIncludes(pageFile, 'Create Admin User, Assign Role, and Remove Role are active in guarded preview/apply mode.', "roadmap labels assign role active");
  requireIncludes(pageFile, 'Enforcement Disabled', "enforcement-disabled notice remains visible");
  requireNotIncludes(pageFile, 'Assign Role", "Require owner_admin role, preserve at least one bootstrapSafe owner_admin user, and audit every change.", "Preview only"', "stale assign-role preview-only roadmap text removed");
}

if (!fs.existsSync(assignRouteFile)) {
  fail("locked assign-role route still exists");
} else {
  pass("locked assign-role route still exists");
  requireIncludes(assignRouteFile, 'isAdminRequestAuthorized(req)', "assign route still requires authenticated session");
  requireIncludes(assignRouteFile, 'key: "owner_admin"', "assign route still requires owner_admin actor");
  requireIncludes(assignRouteFile, 'activeBootstrapOwnerAdminCount', "assign route still has bootstrap owner protection");
  requireIncludes(assignRouteFile, 'if (!apply)', "assign route still defaults to preview");
  requireIncludes(assignRouteFile, 'tx.adminUserRole.create', "assign route still creates only join row on apply");
  requireIncludes(assignRouteFile, 'createMatterAuditLogEntry', "assign route still audit logs apply");
  requireIncludes(assignRouteFile, 'enforcementChanged: false', "assign route still reports no enforcement change");
  requireNotIncludes(assignRouteFile, 'adminUserPermissionOverride.create', "assign route still does not create overrides");
  requireNotIncludes(assignRouteFile, 'BARSH_ADMIN_PERMISSIONS_ENFORCEMENT', "assign route still does not enable enforcement");
}

const packageJson = JSON.parse(fs.readFileSync(packageFile, "utf8"));
if (packageJson.scripts?.["verify:admin-users-phase3-assign-role-ui-safety"] === "node scripts/verify-admin-users-phase3-assign-role-ui-safety.mjs") {
  pass("package assign-role UI verifier script registered");
} else {
  fail("package assign-role UI verifier script registered");
}
if (packageJson.scripts?.["verify:admin-users-phase3-assign-role-route-safety"] === "node scripts/verify-admin-users-phase3-assign-role-route-safety.mjs") {
  pass("assign-role route verifier remains registered");
} else {
  fail("assign-role route verifier remains registered");
}

console.log("\\nRESULT: admin users phase 3 assign role UI safety verifier");
console.log(`FAILURES=${failures.length}`);
if (failures.length) {
  process.exitCode = 1;
} else {
  console.log("PASS: /admin/users exposes the guarded assign-role preview/apply UI and does not add override or enforcement controls.");
}
