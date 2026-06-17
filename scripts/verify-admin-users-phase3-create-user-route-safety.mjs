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

const routeFile = "app/api/admin/users/create/route.ts";
const adminPermFile = "lib/adminPermissions.ts";
const packageFile = "package.json";

if (!fs.existsSync(routeFile)) {
  fail("create admin user route exists");
} else {
  pass("create admin user route exists");
  requireIncludes(routeFile, 'isAdminRequestAuthorized(req)', "authenticated admin session required");
  requireIncludes(routeFile, 'key: "owner_admin"', "active owner_admin actor required");
  requireIncludes(routeFile, 'status: "active"', "actor and role active status required");
  requireIncludes(routeFile, 'actorEmail is required', "actorEmail required before write");
  requireIncludes(routeFile, 'VALID_ADMIN_USER_STATUSES', "active/inactive status validation present");
  requireIncludes(routeFile, 'new Set(["active", "inactive"])', "only active/inactive statuses allowed");
  requireIncludes(routeFile, 'findUnique({ where: { email } })', "duplicate email check present");
  requireIncludes(routeFile, 'duplicateEmailPrevented: true', "duplicate email prevention reported");
  requireIncludes(routeFile, 'if (!apply)', "preview mode default branch present");
  requireIncludes(routeFile, 'applyRequiredForWrite: true', "apply flag required for write");
  requireIncludes(routeFile, 'tx.adminUser.create', "single AdminUser create write present");
  requireIncludes(routeFile, 'createMatterAuditLogEntry', "audit logging helper used");
  requireIncludes(routeFile, 'enforcementChanged: false', "route reports no enforcement changes");
  requireIncludes(routeFile, 'rolesAssigned: []', "route does not assign roles in Phase 3 first step");
  requireIncludes(routeFile, 'permissionOverridesCreated: []', "route does not create overrides in Phase 3 first step");
  requireNotIncludes(routeFile, 'BARSH_ADMIN_PERMISSIONS_ENFORCEMENT', "route does not enable enforcement env flag");
  requireNotIncludes(routeFile, 'adminPermissionEnforcementDecision(', "route does not wire enforcement");
  requireNotIncludes(routeFile, 'adminRole.create', "route does not create roles");
  requireNotIncludes(routeFile, 'adminUserRole.create', "route does not assign roles");
  requireNotIncludes(routeFile, 'adminUserPermissionOverride.create', "route does not create permission overrides");
}

const adminPermSource = fs.readFileSync(adminPermFile, "utf8");
const neverBlockFunctionMatch = adminPermSource.match(/function\\s+isAdminPermissionNeverBlockPath[\\s\\S]*?\\n}/) || adminPermSource.match(/const\\s+isAdminPermissionNeverBlockPath[\\s\\S]*?;\\n/);
const neverBlockSource = neverBlockFunctionMatch ? neverBlockFunctionMatch[0] : adminPermSource;
const requiredNeverBlockPaths = ["/admin", "/admin/permissions", "/api/admin/permissions", "/api/admin/permissions/check"];
const missingNeverBlockPaths = requiredNeverBlockPaths.filter((path) => !neverBlockSource.includes(path));
if (adminPermSource.includes("isAdminPermissionNeverBlockPath") && missingNeverBlockPaths.length === 0 && adminPermSource.includes("Never-block safety route remains allowed to prevent administrator lockout.")) {
  pass("never-block lockout routes remain hardcoded");
} else {
  fail(`never-block lockout routes remain hardcoded; missing=${missingNeverBlockPaths.join(",") || "function/reason"}`);
}
if (adminPermSource.includes("/api/admin/users/create") && adminPermSource.includes("enforcementPlanned: false")) pass("create-user route mapped for Phase 4 readiness only with enforcementPlanned false");
else fail("create-user route mapped for Phase 4 readiness only with enforcementPlanned false");

const packageJson = JSON.parse(fs.readFileSync(packageFile, "utf8"));
if (packageJson.scripts?.["verify:admin-users-phase3-create-user-route-safety"] === "node scripts/verify-admin-users-phase3-create-user-route-safety.mjs") {
  pass("package verifier script registered");
} else {
  fail("package verifier script registered");
}

console.log("\nRESULT: admin users phase 3 create user route safety verifier");
console.log(`FAILURES=${failures.length}`);
if (failures.length) {
  process.exitCode = 1;
} else {
  console.log("PASS: guarded create-admin-user route is preview/apply only, owner_admin gated, duplicate-safe, audit logged, and does not affect lockout/enforcement routes.");
}
