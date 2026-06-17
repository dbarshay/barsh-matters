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

const routeFile = "app/api/admin/users/permission-override/route.ts";
const adminPermFile = "lib/adminPermissions.ts";
const packageFile = "package.json";

if (!fs.existsSync(routeFile)) {
  fail("permission override route exists");
} else {
  pass("permission override route exists");
  requireIncludes(routeFile, 'isAdminRequestAuthorized(req)', "authenticated admin session required");
  requireIncludes(routeFile, 'key: "owner_admin"', "active owner_admin actor required");
  requireIncludes(routeFile, 'actorEmail is required', "actorEmail required before write");
  requireIncludes(routeFile, 'targetEmail', "target user email required");
  requireIncludes(routeFile, 'permissionKey', "permission key required");
  requireIncludes(routeFile, 'isKnownAdminPermissionKey', "known permission validation used");
  requireIncludes(routeFile, 'overrideAction must be allow or block.', "allow/block action validation present");
  requireIncludes(routeFile, 'An explicit reason of at least 6 characters is required', "explicit reason required");
  requireIncludes(routeFile, 'neverBlockRoutesForPermission', "never-block permission route lookup present");
  requireIncludes(routeFile, 'Blocking this permission is not allowed because it maps to administrator lockout safety routes.', "never-block route blocking guard present");
  requireIncludes(routeFile, 'neverBlockPermissionKeys', "never-block permission keys reported");
  requireIncludes(routeFile, 'if (!apply)', "preview mode default branch present");
  requireIncludes(routeFile, 'applyRequiredForWrite: true', "apply flag required for write");
  requireIncludes(routeFile, 'wouldOverride', "preview returns override summary");
  requireIncludes(routeFile, 'tx.adminUserPermissionOverride.create', "AdminUserPermissionOverride create write present");
  requireIncludes(routeFile, 'tx.adminUserPermissionOverride.update', "AdminUserPermissionOverride update write present");
  requireIncludes(routeFile, 'createMatterAuditLogEntry', "audit logging helper used");
  requireIncludes(routeFile, 'enforcementChanged: false', "route reports no enforcement changes");
  requireIncludes(routeFile, 'rolesChanged: false', "route reports no role changes");
  requireNotIncludes(routeFile, 'BARSH_ADMIN_PERMISSIONS_ENFORCEMENT', "route does not enable enforcement env flag");
  requireNotIncludes(routeFile, 'adminPermissionEnforcementDecision(', "route does not wire enforcement");
  requireNotIncludes(routeFile, 'adminUserRole.create', "route does not assign roles");
  requireNotIncludes(routeFile, 'adminUserRole.delete', "route does not remove roles");
  requireNotIncludes(routeFile, 'adminUser.create', "route does not create admin users");
  requireNotIncludes(routeFile, 'adminRole.create', "route does not create roles");
}

const adminPermSource = fs.readFileSync(adminPermFile, "utf8");
const requiredNeverBlockPaths = ["/admin", "/admin/permissions", "/api/admin/permissions", "/api/admin/permissions/check"];
const missingNeverBlockPaths = requiredNeverBlockPaths.filter((path) => !adminPermSource.includes(path));
if (adminPermSource.includes("isAdminPermissionNeverBlockPath") && missingNeverBlockPaths.length === 0 && adminPermSource.includes("Never-block safety route remains allowed to prevent administrator lockout.")) {
  pass("never-block lockout routes remain hardcoded");
} else {
  fail(`never-block lockout routes remain hardcoded; missing=${missingNeverBlockPaths.join(",") || "function/reason"}`);
}
if (adminPermSource.includes("/api/admin/users/permission-override") && adminPermSource.includes("enforcementPlanned: false")) pass("permission-override route mapped for Phase 4 readiness only with enforcementPlanned false");
else fail("permission-override route mapped for Phase 4 readiness only with enforcementPlanned false");

const packageJson = JSON.parse(fs.readFileSync(packageFile, "utf8"));
if (packageJson.scripts?.["verify:admin-users-phase3-permission-override-route-safety"] === "node scripts/verify-admin-users-phase3-permission-override-route-safety.mjs") {
  pass("package permission override verifier script registered");
} else {
  fail("package permission override verifier script registered");
}
if (packageJson.scripts?.["verify:admin-users-phase3-remove-role-route-safety"] === "node scripts/verify-admin-users-phase3-remove-role-route-safety.mjs") {
  pass("remove-role route verifier remains registered");
} else {
  fail("remove-role route verifier remains registered");
}

console.log("\nRESULT: admin users phase 3 permission override route safety verifier");
console.log(`FAILURES=${failures.length}`);
if (failures.length) {
  process.exitCode = 1;
} else {
  console.log("PASS: guarded permission-override route is preview/apply only, owner_admin gated, reason-required, safety-route block protected, audit logged, and does not affect roles/enforcement.");
}
