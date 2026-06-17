import fs from "fs";

let failures = 0;
function pass(message) {
  console.log("PASS:", message);
}
function fail(message) {
  failures += 1;
  console.log("FAIL:", message);
}

const registryFile = "lib/adminPermissions.ts";
const checkRouteFile = "app/api/admin/permissions/check/route.ts";
const proxyFile = "proxy.ts";
const packageFile = "package.json";

const registry = fs.readFileSync(registryFile, "utf8");
const checkRoute = fs.readFileSync(checkRouteFile, "utf8");
const proxy = fs.readFileSync(proxyFile, "utf8");
const pkg = JSON.parse(fs.readFileSync(packageFile, "utf8"));

const requiredRegistryFragments = [
  "configuredAdminPermissionOverridesFromEnv",
  "permissionOverrideEntriesFromArray",
  "adminPermissionDryRunDecisions",
  "adminRoutePermissionDryRunDecisions",
  "configuredAdminPermissionsEnforcementEnabled",
  "adminPermissionEnforcementDecision",
  "isAdminPermissionNeverBlockPath",
  "adminPermissionForRoute",
  "Never-block safety route remains allowed to prevent administrator lockout.",
  "Enforcement disabled; route would be allowed.",
  "Enforcement disabled; route would be blocked if enforcement were enabled.",
  "No permission mapping matched; default allow until explicit mapping is added.",
];

for (const fragment of requiredRegistryFragments) {
  if (registry.includes(fragment)) pass(`registry contains dry-run/decision fragment: ${fragment}`);
  else fail(`registry contains dry-run/decision fragment: ${fragment}`);
}

const requiredRoutes = [
  ["/admin", "admin.home.view"],
  ["/admin/permissions", "admin.home.view"],
  ["/api/admin/permissions", "admin.home.view"],
  ["/api/admin/permissions/check", "admin.home.view"],
  ["/api/admin/users/create", "admin.users.manage"],
  ["/api/admin/users/assign-role", "admin.users.manage"],
  ["/api/admin/users/remove-role", "admin.users.manage"],
  ["/api/admin/users/permission-override", "admin.users.manage"],
];

for (const [route, permission] of requiredRoutes) {
  if (registry.includes(`pattern: "${route}"`) && registry.includes(`permission: "${permission}"`)) pass(`${route} maps to ${permission}`);
  else fail(`${route} maps to ${permission}`);
}

for (const route of ["/api/admin/users/create", "/api/admin/users/assign-role", "/api/admin/users/remove-role", "/api/admin/users/permission-override"]) {
  const routeIndex = registry.indexOf(`pattern: "${route}"`);
  const window = routeIndex >= 0 ? registry.slice(routeIndex, routeIndex + 220) : "";
  if (window.includes('method: "POST"') && window.includes("enforcementPlanned: false")) pass(`${route} is POST-only and non-activating`);
  else fail(`${route} is POST-only and non-activating`);
}

for (const required of [
  'safePath',
  'safeMethod',
  'adminPermissionEnforcementDecision(pathname, method)',
  'admin-permission-check',
  'Read-only permission decision check. This endpoint does not enforce blocking.',
]) {
  if (checkRoute.includes(required)) pass(`permission check endpoint contains: ${required}`);
  else fail(`permission check endpoint contains: ${required}`);
}

for (const required of [
  "adminPermissionEnforcementDecision",
  "isAdminApiRequest && permissionDecision.enforcementEnabled && permissionDecision.blocked",
  "admin-api-permission-blocked",
  "{ status: 403 }",
  "isAdminPageRequest && permissionDecision.enforcementEnabled && permissionDecision.blocked",
  'blockedUrl.pathname = "/admin/permissions"',
]) {
  if (proxy.includes(required)) pass(`proxy contains future enforcement wiring: ${required}`);
  else fail(`proxy contains future enforcement wiring: ${required}`);
}

for (const forbidden of [
  "BARSH_ADMIN_PERMISSIONS_ENFORCEMENT=1",
  "process.env.BARSH_ADMIN_PERMISSIONS_ENFORCEMENT =",
  "enforcementPlanned: true",
]) {
  if (registry.includes(forbidden) || proxy.includes(forbidden) || checkRoute.includes(forbidden)) fail(`activation fragment must not be present: ${forbidden}`);
  else pass(`activation fragment absent: ${forbidden}`);
}

if (pkg.scripts?.["verify:admin-users-phase4-dry-run-decision-path-safety"] === "node scripts/verify-admin-users-phase4-dry-run-decision-path-safety.mjs") {
  pass("package script registered");
} else {
  fail("package script registered");
}

console.log("\nRESULT: admin users phase 4 dry-run decision-path safety verifier");
console.log(`FAILURES=${failures}`);
if (failures) process.exit(1);
console.log("PASS: Phase 4 dry-run decision paths, diagnostic check endpoint, proxy future enforcement wiring, method-sensitive route mappings, and non-activation guards are present.");
