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
const overrideRouteFile = "app/api/admin/users/permission-override/route.ts";
const packageFile = "package.json";

if (!fs.existsSync(pageFile)) {
  fail("admin users page exists");
} else {
  pass("admin users page exists");
  requireIncludes(pageFile, 'data-barsh-admin-users-permission-override-control="phase3-guarded"', "permission override guarded UI panel present");
  requireIncludes(pageFile, 'fetch("/api/admin/users/permission-override"', "UI calls locked permission override route");
  requireIncludes(pageFile, 'Preview Permission Override', "permission override preview button present");
  requireIncludes(pageFile, 'Apply Permission Override', "permission override apply button present");
  requireIncludes(pageFile, 'overridePreviewReady', "permission override apply button gated by matching preview");
  requireIncludes(pageFile, 'Preview the permission override before applying. Apply remains disabled until a matching preview succeeds.', "permission override preview/apply contract displayed");
  requireIncludes(pageFile, 'data-barsh-admin-users-override-target-email="true"', "target user selector present");
  requireIncludes(pageFile, 'data-barsh-admin-users-override-permission-key="true"', "permission key selector present");
  requireIncludes(pageFile, 'data-barsh-admin-users-override-action="true"', "allow/block selector present");
  requireIncludes(pageFile, 'data-barsh-admin-users-override-reason="true"', "reason field present");
  requireIncludes(pageFile, 'data-barsh-admin-users-override-actor-email="true"', "owner_admin actor email submitted");
  requireIncludes(pageFile, 'ADMIN_PERMISSION_KEYS', "UI exposes known permission key list");
  requireIncludes(pageFile, 'never-block safety routes, including /admin, /admin/permissions, /api/admin/permissions, and /api/admin/permissions/check', "UI discloses never-block safety-route protection");
  requireIncludes(pageFile, 'does not change roles, enable enforcement', "UI discloses no role/enforcement writes");
  requireIncludes(pageFile, 'Create Admin User, Assign Role, Remove Role, and Permission Override are active in guarded preview/apply mode.', "roadmap labels permission override active");
  requireIncludes(pageFile, 'Enforcement Disabled', "enforcement-disabled notice remains visible");
  requireNotIncludes(pageFile, 'Permission Override", "Require explicit allow/block reason, never permit blocking /admin or /admin/permissions safety routes.", "Preview only"', "stale permission override preview-only roadmap text removed");
}

if (!fs.existsSync(overrideRouteFile)) {
  fail("locked permission override route still exists");
} else {
  pass("locked permission override route still exists");
  requireIncludes(overrideRouteFile, 'isAdminRequestAuthorized(req)', "override route still requires authenticated session");
  requireIncludes(overrideRouteFile, 'key: "owner_admin"', "override route still requires owner_admin actor");
  requireIncludes(overrideRouteFile, 'Blocking this permission is not allowed because it maps to administrator lockout safety routes.', "override route still blocks safety-route blocks");
  requireIncludes(overrideRouteFile, 'if (!apply)', "override route still defaults to preview");
  requireIncludes(overrideRouteFile, 'tx.adminUserPermissionOverride.create', "override route still creates override on apply");
  requireIncludes(overrideRouteFile, 'tx.adminUserPermissionOverride.update', "override route still updates override on apply");
  requireIncludes(overrideRouteFile, 'createMatterAuditLogEntry', "override route still audit logs apply");
  requireIncludes(overrideRouteFile, 'enforcementChanged: false', "override route still reports no enforcement change");
  requireNotIncludes(overrideRouteFile, 'adminUserRole.create', "override route still does not assign roles");
  requireNotIncludes(overrideRouteFile, 'adminUserRole.delete', "override route still does not remove roles");
  requireNotIncludes(overrideRouteFile, 'BARSH_ADMIN_PERMISSIONS_ENFORCEMENT', "override route still does not enable enforcement");
}

const packageJson = JSON.parse(fs.readFileSync(packageFile, "utf8"));
if (packageJson.scripts?.["verify:admin-users-phase3-permission-override-ui-safety"] === "node scripts/verify-admin-users-phase3-permission-override-ui-safety.mjs") {
  pass("package permission override UI verifier script registered");
} else {
  fail("package permission override UI verifier script registered");
}
if (packageJson.scripts?.["verify:admin-users-phase3-permission-override-route-safety"] === "node scripts/verify-admin-users-phase3-permission-override-route-safety.mjs") {
  pass("permission override route verifier remains registered");
} else {
  fail("permission override route verifier remains registered");
}

console.log("\\nRESULT: admin users phase 3 permission override UI safety verifier");
console.log(`FAILURES=${failures.length}`);
if (failures.length) {
  process.exitCode = 1;
} else {
  console.log("PASS: /admin/users exposes the guarded permission override preview/apply UI and does not add role or enforcement controls.");
}
