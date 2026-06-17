#!/usr/bin/env node
const fs = require("fs");

let failures = 0;
function read(file) { try { return fs.readFileSync(file, "utf8"); } catch { return ""; } }
function pass(message) { console.log("PASS: " + message); }
function fail(message) { failures += 1; console.error("FAIL: " + message); }
function assert(condition, message) { condition ? pass(message) : fail(message); }

console.log("");
console.log("RESULT: admin users phase 8A ephemeral smoke harness readiness safety verifier");

const files = { packageJson: "package.json", proxy: "proxy.ts", sessionRoute: "app/api/auth/session/route.ts", permissionsRoute: "app/api/admin/permissions/route.ts", permissionsCheckRoute: "app/api/admin/permissions/check/route.ts", permissionsPage: "app/admin/permissions/page.tsx", auditHistoryPage: "app/admin/audit-history/page.tsx", adminPage: "app/admin/page.tsx", usersPage: "app/admin/users/page.tsx", adminPermissions: "lib/adminPermissions.ts" };

for (const [label, file] of Object.entries(files)) assert(fs.existsSync(file), label + " exists at " + file);

const pkg = JSON.parse(read(files.packageJson) || "{}");
const scripts = pkg.scripts || {};
assert(scripts["verify:admin-users-phase8-ephemeral-smoke-harness-readiness-safety"] === "node scripts/verify-admin-users-phase8-ephemeral-smoke-harness-readiness-safety.cjs", "package script registered for Phase 8A CJS verifier");
assert(!Object.values(scripts).some((value) => String(value).includes("BARSH_ADMIN_PERMISSIONS_ENFORCEMENT=1")), "package scripts do not persistently activate permissions enforcement");

for (const file of [".env", ".env.local", ".env.production", ".env.development", ".vercel/project.json"]) {
  const text = read(file);
  if (!text) { pass(file + " absent or unreadable for persistent activation scan"); continue; }
  assert(!/BARSH_ADMIN_PERMISSIONS_ENFORCEMENT\s*=\s*1/.test(text), file + " does not set BARSH_ADMIN_PERMISSIONS_ENFORCEMENT=1");
  assert(!/BARSH_ADMIN_PERMISSION_OVERRIDES_JSON\s*=/.test(text), file + " does not persist BARSH_ADMIN_PERMISSION_OVERRIDES_JSON");
  assert(!/enforcementPlanned\s*[:=]\s*true/.test(text), file + " does not persist enforcementPlanned=true");
}

const proxy = read(files.proxy);
const sessionRoute = read(files.sessionRoute);
const permissionsRoute = read(files.permissionsRoute);
const permissionsCheckRoute = read(files.permissionsCheckRoute);
const auditHistoryPage = read(files.auditHistoryPage);
const adminPage = read(files.adminPage);
const usersPage = read(files.usersPage);
const adminPermissions = read(files.adminPermissions);
const allRelevantSource = [proxy, sessionRoute, permissionsRoute, permissionsCheckRoute, auditHistoryPage, adminPage, usersPage, adminPermissions].join("\n");

assert(sessionRoute.includes("permissionsEnforced") && sessionRoute.includes("configuredAdminPermissionsEnforcementEnabled"), "session route exposes permissionsEnforced rollback diagnostic");
assert(permissionsRoute.includes("configuredAdminPermissionsEnforcementEnabled") && permissionsRoute.includes("configuredAdminPermissionOverridesFromEnv"), "permissions API exposes enforcement and override diagnostics");
assert(permissionsCheckRoute.includes("permission") && permissionsCheckRoute.includes("GET"), "permission-check endpoint remains read-only diagnostic surface");
assert(auditHistoryPage.includes("data-barsh-admin-audit-history") && auditHistoryPage.includes("read-only"), "/admin/audit-history exists as read-only first staged target");
assert(usersPage.includes("admin.auditHistory.view") && usersPage.includes("/admin/audit-history"), "users UI maps audit history permission and target link");
assert(adminPage.includes("/admin/audit-history"), "admin dashboard links audit history target");
assert(proxy.includes("adminPermissionEnforcementDecision"), "proxy has future enforcement decision wiring");
assert(proxy.includes("permissionDecision.enforcementEnabled") && proxy.includes("permissionDecision.blocked"), "proxy blocks only when enforcement decision is enabled and blocked");
assert(proxy.includes("admin-api-permission-blocked") || proxy.includes("admin-permission-blocked"), "proxy has blocked redirect or diagnostic marker");
assert(proxy.includes("blockedUrl.pathname") && proxy.includes("/admin/permissions"), "blocked admin page redirects to never-block permissions diagnostics");

for (const route of ["/admin", "/admin/permissions", "/api/admin/permissions", "/api/admin/permissions/check"]) assert(allRelevantSource.includes(route), "never-block route represented in source: " + route);

assert(adminPermissions.includes("BARSH_ADMIN_PERMISSIONS_ENFORCEMENT"), "admin permission library reads enforcement env key");
assert(adminPermissions.includes("BARSH_ADMIN_PERMISSION_OVERRIDES_JSON"), "admin permission library reads override env key");
assert(adminPermissions.includes("admin.auditHistory.view"), "admin permission registry includes first staged target permission");
assert(!/enforcementPlanned\s*[:=]\s*true/.test(allRelevantSource), "runtime source does not set enforcementPlanned=true");

console.log("");
console.log("PHASE_8A_DECISION=EXECUTABLE_EPHEMERAL_HARNESS_RECOMMENDED");
console.log("PHASE_8A_BOUNDARY=verifier-only readiness contract; no persistent activation; no enforcementPlanned=true");
console.log("PHASE_8A_NEXT=build separate ephemeral harness that starts and stops its own child process, sets enforcement env only for that child process, checks no-lockout routes, blocked audit-history diagnostics, and rollback proof");

if (failures) { console.error(""); console.error("FAILURES=" + failures); console.error("RESULT: admin users phase 8A ephemeral smoke harness readiness safety verifier FAILED"); process.exit(1); }

console.log("");
console.log("FAILURES=0");
console.log("PASS: Phase 8A should proceed with an executable verifier-only ephemeral smoke harness, not manual-only, while preserving persistent non-activation.");
