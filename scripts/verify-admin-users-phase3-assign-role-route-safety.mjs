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

const routeFile = "app/api/admin/users/assign-role/route.ts";
const adminPermFile = "lib/adminPermissions.ts";
const packageFile = "package.json";

if (!fs.existsSync(routeFile)) {
  fail("assign admin role route exists");
} else {
  pass("assign admin role route exists");
  requireIncludes(routeFile, 'isAdminRequestAuthorized(req)', "authenticated admin session required");
  requireIncludes(routeFile, 'key: "owner_admin"', "active owner_admin actor required");
  requireIncludes(routeFile, 'status: "active"', "active actor/role/user checks present");
  requireIncludes(routeFile, 'actorEmail is required', "actorEmail required before write");
  requireIncludes(routeFile, 'targetEmail', "target user email required");
  requireIncludes(routeFile, 'roleKey', "role key required");
  requireIncludes(routeFile, 'activeBootstrapOwnerAdminCount', "bootstrap owner count protection present");
  requireIncludes(routeFile, 'bootstrapSafe: true', "bootstrapSafe owner protection checks bootstrap flag");
  requireIncludes(routeFile, 'At least one active bootstrapSafe owner_admin user must exist before role assignment.', "lockout protection blocks unsafe state");
  requireIncludes(routeFile, 'Admin role must be active before assignment.', "inactive role blocked");
  requireIncludes(routeFile, 'Target admin user must be active before role assignment.', "inactive target user blocked");
  requireIncludes(routeFile, 'duplicateAssignmentPrevented: true', "duplicate assignment prevention reported");
  requireIncludes(routeFile, 'if (!apply)', "preview mode default branch present");
  requireIncludes(routeFile, 'applyRequiredForWrite: true', "apply flag required for write");
  requireIncludes(routeFile, 'tx.adminUserRole.create', "single AdminUserRole create write present");
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
if (adminPermSource.includes("/api/admin/users/assign-role") && adminPermSource.includes("enforcementPlanned: false")) pass("assign-role route mapped for Phase 4 readiness only with enforcementPlanned false");
else fail("assign-role route mapped for Phase 4 readiness only with enforcementPlanned false");

const packageJson = JSON.parse(fs.readFileSync(packageFile, "utf8"));
if (packageJson.scripts?.["verify:admin-users-phase3-assign-role-route-safety"] === "node scripts/verify-admin-users-phase3-assign-role-route-safety.mjs") {
  pass("package assign-role verifier script registered");
} else {
  fail("package assign-role verifier script registered");
}
if (packageJson.scripts?.["verify:admin-users-phase3-create-user-route-safety"] === "node scripts/verify-admin-users-phase3-create-user-route-safety.mjs") {
  pass("create-user route verifier remains registered");
} else {
  fail("create-user route verifier remains registered");
}

console.log("\nRESULT: admin users phase 3 assign role route safety verifier");
console.log(`FAILURES=${failures.length}`);
if (failures.length) {
  process.exitCode = 1;
} else {
  console.log("PASS: guarded assign-admin-role route is preview/apply only, owner_admin gated, duplicate-safe, audit logged, bootstrap-owner protected, and does not affect lockout/enforcement routes.");
}
