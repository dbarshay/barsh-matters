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

const routeFile = "app/api/admin/users/remove-role/route.ts";
const adminPermFile = "lib/adminPermissions.ts";
const packageFile = "package.json";

if (!fs.existsSync(routeFile)) {
  fail("remove admin role route exists");
} else {
  pass("remove admin role route exists");
  requireIncludes(routeFile, 'isAdminRequestAuthorized(req)', "authenticated admin session required");
  requireIncludes(routeFile, 'key: "owner_admin"', "active owner_admin actor required");
  requireIncludes(routeFile, 'actorEmail is required', "actorEmail required before write");
  requireIncludes(routeFile, 'targetEmail', "target user email required");
  requireIncludes(routeFile, 'roleKey', "role key required");
  requireIncludes(routeFile, 'activeBootstrapOwnerAdminCount', "bootstrap owner count protection present");
  requireIncludes(routeFile, 'bootstrapSafe: true', "bootstrapSafe owner protection checks bootstrap flag");
  requireIncludes(routeFile, 'Cannot remove owner_admin from the last active bootstrapSafe owner_admin user.', "last bootstrap owner lockout protection present");
  requireIncludes(routeFile, 'Target admin user does not have this role.', "missing assignment blocked");
  requireIncludes(routeFile, 'if (!apply)', "preview mode default branch present");
  requireIncludes(routeFile, 'applyRequiredForWrite: true', "apply flag required for write");
  requireIncludes(routeFile, 'wouldRemove', "preview returns removal summary");
  requireIncludes(routeFile, 'tx.adminUserRole.delete', "single AdminUserRole delete write present");
  requireIncludes(routeFile, 'createMatterAuditLogEntry', "audit logging helper used");
  requireIncludes(routeFile, 'enforcementChanged: false', "route reports no enforcement changes");
  requireIncludes(routeFile, 'permissionOverridesCreated: []', "route does not create overrides");
  requireNotIncludes(routeFile, 'BARSH_ADMIN_PERMISSIONS_ENFORCEMENT', "route does not enable enforcement env flag");
  requireNotIncludes(routeFile, 'adminPermissionEnforcementDecision(', "route does not wire enforcement");
  requireNotIncludes(routeFile, 'adminUser.create', "route does not create admin users");
  requireNotIncludes(routeFile, 'adminRole.create', "route does not create roles");
  requireNotIncludes(routeFile, 'adminUserPermissionOverride.create', "route does not create permission overrides");
}

const adminPermSource = fs.readFileSync(adminPermFile, "utf8");
const requiredNeverBlockPaths = ["/admin", "/admin/permissions", "/api/admin/permissions", "/api/admin/permissions/check"];
const missingNeverBlockPaths = requiredNeverBlockPaths.filter((path) => !adminPermSource.includes(path));
if (adminPermSource.includes("isAdminPermissionNeverBlockPath") && missingNeverBlockPaths.length === 0 && adminPermSource.includes("Never-block safety route remains allowed to prevent administrator lockout.")) {
  pass("never-block lockout routes remain hardcoded");
} else {
  fail(`never-block lockout routes remain hardcoded; missing=${missingNeverBlockPaths.join(",") || "function/reason"}`);
}
if (!adminPermSource.includes('/api/admin/users/remove-role')) pass("remove-role route not added to enforcement mapping");
else fail("remove-role route not added to enforcement mapping");

const packageJson = JSON.parse(fs.readFileSync(packageFile, "utf8"));
if (packageJson.scripts?.["verify:admin-users-phase3-remove-role-route-safety"] === "node scripts/verify-admin-users-phase3-remove-role-route-safety.mjs") {
  pass("package remove-role verifier script registered");
} else {
  fail("package remove-role verifier script registered");
}
if (packageJson.scripts?.["verify:admin-users-phase3-assign-role-route-safety"] === "node scripts/verify-admin-users-phase3-assign-role-route-safety.mjs") {
  pass("assign-role route verifier remains registered");
} else {
  fail("assign-role route verifier remains registered");
}

console.log("\nRESULT: admin users phase 3 remove role route safety verifier");
console.log(`FAILURES=${failures.length}`);
if (failures.length) {
  process.exitCode = 1;
} else {
  console.log("PASS: guarded remove-admin-role route is preview/apply only, owner_admin gated, audit logged, last-bootstrap-owner protected, and does not affect lockout/enforcement routes.");
}
