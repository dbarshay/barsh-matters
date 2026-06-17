import fs from "fs";

let failures = 0;
function pass(message) {
  console.log("PASS:", message);
}
function fail(message) {
  failures += 1;
  console.log("FAIL:", message);
}

function read(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
}

const pkg = JSON.parse(read("package.json") || "{}");
const registry = read("lib/adminPermissions.ts");
const proxy = read("proxy.ts");
const sessionRoute = read("app/api/auth/session/route.ts");
const permissionsRoute = read("app/api/admin/permissions/route.ts");
const checkRoute = read("app/api/admin/permissions/check/route.ts");
const permissionsPage = read("app/admin/permissions/page.tsx");

const requiredFiles = [
  "scripts/verify-admin-users-phase4-route-map-readiness-safety.mjs",
  "scripts/verify-admin-users-phase4-dry-run-decision-path-safety.mjs",
  "scripts/verify-admin-users-phase4-env-deployment-readiness-safety.mjs",
];

for (const file of requiredFiles) {
  if (fs.existsSync(file)) pass(`${file} exists`);
  else fail(`${file} exists`);
}

const requiredScripts = [
  "verify:admin-users-phase4-route-map-readiness-safety",
  "verify:admin-users-phase4-dry-run-decision-path-safety",
  "verify:admin-users-phase4-env-deployment-readiness-safety",
];

for (const script of requiredScripts) {
  if (pkg.scripts?.[script]) pass(`${script} registered`);
  else fail(`${script} registered`);
}

if (registry.includes('key: "admin.users.manage"')) pass("admin.users.manage permission exists");
else fail("admin.users.manage permission exists");

const writeRoutes = [
  "/api/admin/users/create",
  "/api/admin/users/assign-role",
  "/api/admin/users/remove-role",
  "/api/admin/users/permission-override",
];

for (const route of writeRoutes) {
  const idx = registry.indexOf(`pattern: "${route}"`);
  const window = idx >= 0 ? registry.slice(idx, idx + 260) : "";
  if (window.includes('permission: "admin.users.manage"') && window.includes('method: "POST"') && window.includes("enforcementPlanned: false")) {
    pass(`${route} mapped to admin.users.manage POST with enforcementPlanned false`);
  } else {
    fail(`${route} mapped to admin.users.manage POST with enforcementPlanned false`);
  }
}

for (const required of [
  '"/admin"',
  '"/admin/permissions"',
  '"/api/admin/permissions"',
  '"/api/admin/permissions/check"',
  "ADMIN_PERMISSION_NEVER_BLOCK_PATTERNS",
  "isAdminPermissionNeverBlockPath",
  "Never-block safety route remains allowed to prevent administrator lockout.",
]) {
  if (registry.includes(required)) pass(`never-block safety preserved: ${required}`);
  else fail(`never-block safety preserved: ${required}`);
}

for (const required of [
  "configuredAdminPermissionOverridesFromEnv",
  "adminPermissionDryRunDecisions",
  "adminRoutePermissionDryRunDecisions",
  "configuredAdminPermissionsEnforcementEnabled",
  "adminPermissionEnforcementDecision",
  "Enforcement disabled; route would be blocked if enforcement were enabled.",
]) {
  if (registry.includes(required)) pass(`dry-run/decision core present: ${required}`);
  else fail(`dry-run/decision core present: ${required}`);
}

for (const required of [
  "adminPermissionEnforcementDecision",
  "isAdminApiRequest && permissionDecision.enforcementEnabled && permissionDecision.blocked",
  "admin-api-permission-blocked",
  "{ status: 403 }",
  "isAdminPageRequest && permissionDecision.enforcementEnabled && permissionDecision.blocked",
  'blockedUrl.pathname = "/admin/permissions"',
]) {
  if (proxy.includes(required)) pass(`future proxy enforcement remains flag-gated: ${required}`);
  else fail(`future proxy enforcement remains flag-gated: ${required}`);
}

for (const required of [
  "permissionsEnforced: configuredAdminPermissionsEnforcementEnabled()",
  "permissionOverrideConfig",
  "permissionDryRun",
  'permissionsMode: "default-admin-allow-all"',
]) {
  if (sessionRoute.includes(required)) pass(`session diagnostic exposure present: ${required}`);
  else fail(`session diagnostic exposure present: ${required}`);
}

for (const required of [
  "enforcementEnabled: configuredAdminPermissionsEnforcementEnabled()",
  "overrideConfig: configuredAdminPermissionOverridesFromEnv()",
  "permissionDryRun: adminPermissionDryRunDecisions()",
  "routeDryRun: adminRoutePermissionDryRunDecisions()",
  "Read-only permissions registry",
]) {
  if (permissionsRoute.includes(required)) pass(`permissions API diagnostic exposure present: ${required}`);
  else fail(`permissions API diagnostic exposure present: ${required}`);
}

for (const required of [
  "Read-only permission decision check. This endpoint does not enforce blocking.",
  "admin-permission-check",
  "safePath",
  "safeMethod",
]) {
  if (checkRoute.includes(required)) pass(`permission check diagnostic remains safe: ${required}`);
  else fail(`permission check diagnostic remains safe: ${required}`);
}

for (const required of [
  "Dry-run only",
  "No enforcement is active now",
  "later enforcement phase",
  "not enforced yet",
  "Permission enforcement and user-configurable allow/block settings are deferred",
]) {
  if (permissionsPage.includes(required)) pass(`permissions page safety copy present: ${required}`);
  else fail(`permissions page safety copy present: ${required}`);
}

const runtimeSources = [registry, proxy, sessionRoute, permissionsRoute, checkRoute].join("\n");
for (const forbidden of [
  "process.env.BARSH_ADMIN_PERMISSIONS_ENFORCEMENT =",
  "enforcementPlanned: true",
]) {
  if (runtimeSources.includes(forbidden)) fail(`runtime source must not activate enforcement via ${forbidden}`);
  else pass(`runtime source does not activate enforcement via ${forbidden}`);
}

if (pkg.scripts?.["verify:admin-users-phase4-completion-safety"] === "node scripts/verify-admin-users-phase4-completion-safety.mjs") {
  pass("package completion script registered");
} else {
  fail("package completion script registered");
}

console.log("\nRESULT: admin users phase 4 completion safety verifier");
console.log(`FAILURES=${failures}`);
if (failures) process.exit(1);
console.log("PASS: Phase 4 enforcement-readiness is complete: route-map readiness, dry-run decision paths, env/deployment safety, never-block protection, diagnostics, and non-activation guards are locked.");
