#!/usr/bin/env node
import fs from "node:fs";

const failures = [];

function read(path) {
  return fs.existsSync(path) ? fs.readFileSync(path, "utf8") : "";
}

const pkg = JSON.parse(read("package.json"));
const usersPage = read("app/admin/users/page.tsx");
const auditHistoryPage = read("app/admin/audit-history/page.tsx");
const auditLogRoute = read("app/api/audit-log/route.ts");

const writeRoutes = [
  ["app/api/admin/users/create/route.ts", "admin-user-create", "admin_user", "AdminUser"],
  ["app/api/admin/users/assign-role/route.ts", "admin-user-assign-role", "admin_user_role", "AdminUserRole"],
  ["app/api/admin/users/remove-role/route.ts", "admin-user-remove-role", "admin_user_role", "AdminUserRole"],
  ["app/api/admin/users/permission-override/route.ts", "admin-user-permission-override", "admin_user_permission_override", "AdminUserPermissionOverride"],
];

for (const [path, action, entityType, fieldName] of writeRoutes) {
  const route = read(path);
  if (!route) failures.push(`${path} missing`);
  for (const required of [
    "createMatterAuditLogEntry",
    `action: "${action}"`,
    `entityType: "${entityType}"`,
    `fieldName: "${fieldName}"`,
    'workflow: "admin-users-phase3"',
    "actorEmail",
    "enforcementChanged: false",
  ]) {
    if (!route.includes(required)) failures.push(`${path} missing audit/write-safety fragment: ${required}`);
  }
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
  'data-barsh-admin-audit-history="true"',
  "/api/audit-log?limit=100",
  "Read-only administrator view",
  "does not edit records",
  "does not edit records, delete entries, write Clio, send email, print, or queue documents",
]) {
  if (!auditHistoryPage.includes(required)) failures.push(`app/admin/audit-history/page.tsx missing read-only audit visibility fragment: ${required}`);
}

for (const required of [
  "prisma.auditLog.findMany",
  "take: limit",
  "orderBy",
]) {
  if (!auditLogRoute.includes(required)) failures.push(`app/api/audit-log/route.ts missing audit-log read fragment: ${required}`);
}

for (const required of [
  'data-barsh-admin-users-planning-page="phase3-guarded"',
  "audit logging on apply",
  "AdminUser",
  "AdminUserRole",
  "AdminUserPermissionOverride",
  "Enforcement Disabled",
]) {
  if (!usersPage.includes(required)) failures.push(`app/admin/users/page.tsx missing admin-users audit/readiness UI fragment: ${required}`);
}

if (!usersPage.includes("/admin/audit-history") && !usersPage.includes("Audit History") && !usersPage.includes("audit-history")) {
  failures.push("app/admin/users/page.tsx does not yet expose a visible link or focused panel for admin-users audit/history review");
}

if (!auditHistoryPage.includes("admin-user-create") && !auditHistoryPage.includes("admin-user-assign-role") && !auditHistoryPage.includes("admin-user-remove-role") && !auditHistoryPage.includes("admin-user-permission-override")) {
  failures.push("app/admin/audit-history/page.tsx does not yet include focused admin-users action labels/filters for create/assign/remove/override audit review");
}

if (pkg.scripts?.["verify:admin-users-phase6-audit-visibility-readiness-safety"] !== "node scripts/verify-admin-users-phase6-audit-visibility-readiness-safety.mjs") {
  failures.push("package.json missing verify:admin-users-phase6-audit-visibility-readiness-safety script");
}

console.log("RESULT: admin users phase 6 audit visibility readiness verifier");
if (failures.length) {
  console.log(`FAILURES=${failures.length}`);
  for (const failure of failures) console.log(`FAIL=${failure}`);
  process.exit(1);
}
console.log("FAILURES=0");
console.log("PASS: admin users write actions are audit logged and visible through read-only audit history with focused admin-users audit review affordances, while enforcement remains disabled.");
