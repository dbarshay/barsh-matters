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

const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
const adminPermSource = fs.readFileSync("lib/adminPermissions.ts", "utf8");
const pageFile = "app/admin/users/page.tsx";

const requiredFiles = [
  "app/api/admin/users/create/route.ts",
  "app/api/admin/users/assign-role/route.ts",
  "app/api/admin/users/remove-role/route.ts",
  "app/api/admin/users/permission-override/route.ts",
  "scripts/verify-admin-users-phase3-create-user-route-safety.mjs",
  "scripts/verify-admin-users-phase3-create-user-ui-safety.mjs",
  "scripts/verify-admin-users-phase3-assign-role-route-safety.mjs",
  "scripts/verify-admin-users-phase3-assign-role-ui-safety.mjs",
  "scripts/verify-admin-users-phase3-remove-role-route-safety.mjs",
  "scripts/verify-admin-users-phase3-remove-role-ui-safety.mjs",
  "scripts/verify-admin-users-phase3-permission-override-route-safety.mjs",
  "scripts/verify-admin-users-phase3-permission-override-ui-safety.mjs",
];

for (const file of requiredFiles) {
  if (fs.existsSync(file)) pass(`${file} exists`);
  else fail(`${file} exists`);
}

const requiredScripts = [
  "verify:admin-users-phase3-create-user-route-safety",
  "verify:admin-users-phase3-create-user-ui-safety",
  "verify:admin-users-phase3-assign-role-route-safety",
  "verify:admin-users-phase3-assign-role-ui-safety",
  "verify:admin-users-phase3-remove-role-route-safety",
  "verify:admin-users-phase3-remove-role-ui-safety",
  "verify:admin-users-phase3-permission-override-route-safety",
  "verify:admin-users-phase3-permission-override-ui-safety",
];

for (const script of requiredScripts) {
  if (packageJson.scripts?.[script]) pass(`${script} registered`);
  else fail(`${script} registered`);
}

if (fs.existsSync(pageFile)) {
  pass("admin users page exists");
  requireIncludes(pageFile, 'data-barsh-admin-users-create-user-control="phase3-guarded"', "create user UI present");
  requireIncludes(pageFile, 'data-barsh-admin-users-assign-role-control="phase3-guarded"', "assign role UI present");
  requireIncludes(pageFile, 'data-barsh-admin-users-remove-role-control="phase3-guarded"', "remove role UI present");
  requireIncludes(pageFile, 'data-barsh-admin-users-permission-override-control="phase3-guarded"', "permission override UI present");
  requireIncludes(pageFile, 'Create Admin User, Assign Role, Remove Role, and Permission Override are active in guarded preview/apply mode.', "Phase 3 roadmap labels all guarded controls active");
  requireIncludes(pageFile, 'Enforcement Disabled', "enforcement disabled notice remains visible");
  requireIncludes(pageFile, 'Enforcement remains unavailable and separate.', "enforcement remains separate");
}

const writeRoutes = [
  "/api/admin/users/create",
  "/api/admin/users/assign-role",
  "/api/admin/users/remove-role",
  "/api/admin/users/permission-override",
];

for (const route of writeRoutes) {
  if (adminPermSource.includes(route) && adminPermSource.includes("enforcementPlanned: false")) pass(`${route} mapped for Phase 4 readiness with enforcementPlanned false`);
  else fail(`${route} mapped for Phase 4 readiness with enforcementPlanned false`);
}

requireIncludes("lib/adminPermissions.ts", "enforcementPlanned: false", "Phase 4 user-write route mappings remain non-activating");
const requiredNeverBlockPaths = ["/admin", "/admin/permissions", "/api/admin/permissions", "/api/admin/permissions/check"];
const missingNeverBlockPaths = requiredNeverBlockPaths.filter((path) => !adminPermSource.includes(path));
if (adminPermSource.includes("isAdminPermissionNeverBlockPath") && missingNeverBlockPaths.length === 0 && adminPermSource.includes("Never-block safety route remains allowed to prevent administrator lockout.")) {
  pass("never-block lockout routes remain hardcoded");
} else {
  fail(`never-block lockout routes remain hardcoded; missing=${missingNeverBlockPaths.join(",") || "function/reason"}`);
}

for (const file of requiredFiles.filter((file) => file.endsWith("/route.ts"))) {
  requireIncludes(file, 'isAdminRequestAuthorized(req)', `${file} requires authenticated session`);
  requireIncludes(file, 'key: "owner_admin"', `${file} requires owner_admin actor`);
  requireIncludes(file, 'if (!apply)', `${file} defaults to preview`);
  requireIncludes(file, 'applyRequiredForWrite: true', `${file} requires explicit apply for write`);
  requireIncludes(file, 'createMatterAuditLogEntry', `${file} audit logs apply`);
  requireIncludes(file, 'enforcementChanged: false', `${file} reports no enforcement change`);
  requireNotIncludes(file, 'BARSH_ADMIN_PERMISSIONS_ENFORCEMENT', `${file} does not enable enforcement`);
  requireNotIncludes(file, 'adminPermissionEnforcementDecision(', `${file} does not wire enforcement`);
}

requireIncludes("app/api/admin/users/permission-override/route.ts", 'Blocking this permission is not allowed because it maps to administrator lockout safety routes.', "permission override blocks safety-route block overrides");
requireIncludes("app/api/admin/users/remove-role/route.ts", 'Cannot remove owner_admin from the last active bootstrapSafe owner_admin user.', "remove role blocks last bootstrap owner removal");

console.log("\\nRESULT: admin users phase 3 completion safety verifier");
console.log(`FAILURES=${failures.length}`);
if (failures.length) {
  process.exitCode = 1;
} else {
  console.log("PASS: Phase 3 guarded admin user/role/override write controls are complete, preview/apply gated, audit logged, and enforcement remains disabled/separate.");
}
