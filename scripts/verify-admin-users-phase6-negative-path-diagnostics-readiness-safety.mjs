#!/usr/bin/env node
import fs from "node:fs";

const failures = [];

function read(path) {
  return fs.existsSync(path) ? fs.readFileSync(path, "utf8") : "";
}

const pkg = JSON.parse(read("package.json"));
const registry = read("lib/adminPermissions.ts");
const proxy = read("proxy.ts");
const permissionsPage = read("app/admin/permissions/page.tsx");
const permissionCheck = read("app/api/admin/permissions/check/route.ts");
const phase5b = read("scripts/verify-admin-users-phase5-enforcement-simulation-negative-path-safety.mjs");
const phase5c = read("scripts/verify-admin-users-phase5-permission-check-negative-path-safety.mjs");
const phase6c = read("scripts/verify-admin-users-phase6-audit-visibility-readiness-safety.mjs");

function requireIncludes(label, text, needle) {
  if (!text.includes(needle)) failures.push(`${label} missing required fragment: ${needle}`);
}

for (const required of [
  "adminPermissionEnforcementDecision",
  "configuredAdminPermissionsEnforcementEnabled",
  "Enforcement disabled; route would be blocked if enforcement were enabled.",
  "Never-block safety route remains allowed to prevent administrator lockout.",
  "No permission mapping matched; default allow until explicit mapping is added.",
  "Permission blocked by current overrides.",
  '"/admin"',
  '"/admin/permissions"',
  '"/api/admin/permissions"',
  '"/api/admin/permissions/check"',
]) requireIncludes("lib/adminPermissions.ts", registry, required);

for (const required of [
  "isAdminApiRequest && permissionDecision.enforcementEnabled && permissionDecision.blocked",
  "admin-api-permission-blocked",
  "Admin API route is blocked by current admin permission overrides.",
  "{ status: 403 }",
  "isAdminPageRequest && permissionDecision.enforcementEnabled && permissionDecision.blocked",
  'blockedUrl.pathname = "/admin/permissions"',
  'blockedUrl.searchParams.set("blocked", "1")',
  'blockedUrl.searchParams.set("from", `${pathname}${req.nextUrl.search}`)',
  'blockedUrl.searchParams.set("permission", permissionDecision.permission)',
]) requireIncludes("proxy.ts", proxy, required);

for (const required of [
  'data-barsh-admin-permissions-blocked-notice="true"',
  "Access blocked:",
  "blockedRouteLabel",
  "blockedPermissionLabel",
  "Dry-run only",
  "No enforcement is active now",
  "Permission enforcement and user-configurable allow/block settings are deferred",
]) requireIncludes("app/admin/permissions/page.tsx", permissionsPage, required);

for (const required of [
  "decision.enforcementEnabled && decision.blocked",
  "admin-permission-check-blocked",
  "Permission check target is blocked by current admin permission overrides.",
  "{ status: 403 }",
  "Read-only permission decision check. This endpoint does not enforce blocking.",
  "safePath",
  "safeMethod",
]) requireIncludes("app/api/admin/permissions/check/route.ts", permissionCheck, required);

const writeRoutes = [
  ["app/api/admin/users/create/route.ts", "admin-user-create", ["Authenticated administrator session required.", "actorEmail is required so the route can verify an active owner_admin actor before any write.", "Active owner_admin actor required.", "A valid admin user email is required.", "Invalid status. Use active or inactive.", "An admin user with this email already exists."]],
  ["app/api/admin/users/assign-role/route.ts", "admin-user-assign-role", ["Authenticated administrator session required.", "actorEmail is required so the route can verify an active owner_admin actor before any write.", "Active owner_admin actor required.", "A valid target admin user email is required.", "roleKey is required.", "At least one active bootstrapSafe owner_admin user must exist before role assignment.", "Target admin user does not exist.", "Target admin user must be active before role assignment.", "Admin role does not exist.", "Admin role must be active before assignment."]],
  ["app/api/admin/users/remove-role/route.ts", "admin-user-remove-role", ["Authenticated administrator session required.", "actorEmail is required so the route can verify an active owner_admin actor before any write.", "Active owner_admin actor required.", "A valid target admin user email is required.", "roleKey is required.", "At least one active bootstrapSafe owner_admin user must exist before role removal.", "Target admin user does not exist.", "Admin role does not exist.", "Target admin user does not have this role."]],
  ["app/api/admin/users/permission-override/route.ts", "admin-user-permission-override", ["Authenticated administrator session required.", "actorEmail is required so the route can verify an active owner_admin actor before any write.", "Active owner_admin actor required.", "A valid target admin user email is required.", "A known admin permission key is required.", "overrideAction must be allow or block.", "An explicit reason of at least 6 characters is required for any permission override.", "Blocking this permission is not allowed because it maps to administrator lockout safety routes.", "Target admin user does not exist."]],
];

for (const [path, action, requiredMessages] of writeRoutes) {
  const route = read(path);
  requireIncludes(path, route, `action: "${action}"`);
  requireIncludes(path, route, 'mode: "blocked"');
  requireIncludes(path, route, 'mode: apply ? "apply-blocked" : "preview-blocked"');
  requireIncludes(path, route, "enforcementChanged: false");
  requireIncludes(path, route, "actorEmail");
  requireIncludes(path, route, "owner_admin");
  for (const message of requiredMessages) requireIncludes(path, route, message);
  for (const forbidden of [
    "BARSH_ADMIN_PERMISSIONS_ENFORCEMENT=1",
    "process.env.BARSH_ADMIN_PERMISSIONS_ENFORCEMENT =",
    "enforcementChanged: true",
    "writeClio",
    "sendEmail",
    "printQueue",
  ]) {
    if (route.includes(forbidden)) failures.push(`${path} contains forbidden activation/external side-effect fragment: ${forbidden}`);
  }
}

for (const required of [
  "temporary simulation blocks all four guarded admin users manage write routes",
  "never-block permission check API remains allowed during simulated enforcement",
  "verifier restores BARSH_ADMIN_PERMISSIONS_ENFORCEMENT after simulation",
]) requireIncludes("Phase 5B verifier", phase5b, required);

for (const required of [
  "permission-check endpoint remains explicitly read-only",
  "permission-check endpoint blocked branch remains gated by enforcement decision",
  "permission-check endpoint exposes blocked diagnostic message only when simulated/enabled decision blocks",
]) requireIncludes("Phase 5C verifier", phase5c, required);

for (const required of [
  "admin users write actions are audit logged",
  "visible through read-only audit history",
  "enforcement remains disabled",
]) requireIncludes("Phase 6C verifier", phase6c, required);

const runtimeSources = [read("package.json"), read("proxy.ts"), registry, read("app/api/auth/session/route.ts"), read("app/api/admin/permissions/route.ts"), permissionCheck].join("\\n");
for (const forbidden of [
  "process.env.BARSH_ADMIN_PERMISSIONS_ENFORCEMENT =",
  "enforcementPlanned: true",
]) {
  if (runtimeSources.includes(forbidden)) failures.push(`runtime/config sources contain forbidden activation fragment: ${forbidden}`);
}

if (pkg.scripts?.["verify:admin-users-phase6-negative-path-diagnostics-readiness-safety"] !== "node scripts/verify-admin-users-phase6-negative-path-diagnostics-readiness-safety.mjs") {
  failures.push("package.json missing verify:admin-users-phase6-negative-path-diagnostics-readiness-safety script");
}

console.log("RESULT: admin users phase 6 controlled negative-path diagnostics readiness verifier");
if (failures.length) {
  console.log(`FAILURES=${failures.length}`);
  for (const failure of failures) console.log(`FAIL=${failure}`);
  process.exit(1);
}
console.log("FAILURES=0");
console.log("PASS: admin users controlled negative-path diagnostics remain visible, read-only/test-only, lockout-safe, and non-activating after Phase 6 audit visibility.");
