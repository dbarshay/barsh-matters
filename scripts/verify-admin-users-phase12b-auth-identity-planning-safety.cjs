#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function pass(name) {
  console.log(`PASS: ${name}`);
}

function fail(name, detail) {
  console.error(`FAIL: ${name}`);
  if (detail) console.error(detail);
  process.exitCode = 1;
}

function assert(name, condition, detail) {
  if (condition) pass(name);
  else fail(name, detail);
}

console.log("RUN: Phase 12B auth identity planning safety verifier");
console.log("Verifier-only: no database reads, no database writes, no source mutation, no enforcement changes.");

const adminAuth = read("lib/adminAuth.ts");
const login = read("app/api/auth/login/route.ts");
const session = read("app/api/auth/session/route.ts");
const authorize = read("app/api/admin/authorize/route.ts");
const perms = read("lib/adminPermissions.ts");
const planning = read("app/api/admin/users/planning/route.ts");
const usersPage = read("app/admin/users/page.tsx");
const schema = read("prisma/schema.prisma");
const phase11aApply = read("scripts/apply-admin-users-phase11a-jane-doe-limited-test-user.cjs");
const phase11aVerifier = read("scripts/verify-admin-users-phase11a-limited-test-user-simulation-safety.cjs");
const packageJson = read("package.json");

assert("generic cookie name remains barsh_admin_gate", adminAuth.includes('ADMIN_COOKIE_NAME = "barsh_admin_gate"'));
assert("current authorization is token-cookie equality only", adminAuth.includes("actualToken === expectedToken"));
assert("cookie currently stores configured session token only", adminAuth.includes("response.cookies.set(ADMIN_COOKIE_NAME, sessionToken"));
assert("login route remains password-only", login.includes("const password = cleanAdminAuthValue(body?.password)") && !/body\?\.(email|adminEmail|userEmail)/.test(login));
assert("login response remains generic Administrator identity", login.includes('displayName: "Administrator"') && login.includes('role: "admin"'));
assert("session route currently returns generic Administrator identity", session.includes('displayName: "Administrator"'));
assert("session route currently grants all permissions to any authenticated generic admin session", session.includes("const permissions = authenticated ? allAdminPermissionKeys() : []"));
assert("session route does not yet resolve AdminUser.email from database", !/prisma\.adminUser|adminUser\.find/i.test(session));
assert("authorize route also sets only generic admin gate cookie", authorize.includes("setAdminGateCookie(response)") && !/body\?\.(email|adminEmail|userEmail)/.test(authorize));
assert("never-block admin paths remain hardcoded", perms.includes('"/admin"') && perms.includes('"/admin/permissions"') && perms.includes('"/api/admin/permissions"') && perms.includes('"/api/admin/permissions/check"'));
assert("admin permission check endpoint remains never-block listed", perms.includes('{ pattern: "/api/admin/permissions/check"'));
assert("Admin Users planning endpoint reads db users but does not write", planning.includes("prisma.adminUser.findMany") && !/\.create\(|\.update\(|\.delete\(|\$transaction/.test(planning));
assert("Admin Users UI still requires explicit actor email fields", usersPage.includes("data-barsh-admin-users-create-actor-email") && usersPage.includes("data-barsh-admin-users-assign-actor-email") && usersPage.includes("data-barsh-admin-users-remove-actor-email") && usersPage.includes("data-barsh-admin-users-override-actor-email"));
assert("AdminUser schema exists", schema.includes("model AdminUser"));
assert("AdminRole schema exists", schema.includes("model AdminRole"));
assert("AdminUserRole schema exists", schema.includes("model AdminUserRole"));
assert("AdminUserPermissionOverride schema exists", schema.includes("model AdminUserPermissionOverride"));
assert("Phase 11A apply package preserves protected owner email", phase11aApply.includes("dbarshay15@gmail.com"));
assert("Phase 11A apply package targets Jane Doe limited email", phase11aApply.includes("jane.doe.limited@example.com"));
assert("Phase 11A verifier package proves Jane read_only_admin role", phase11aVerifier.includes("jane.doe.limited@example.com") && phase11aVerifier.includes("read_only_admin"));
assert("Phase 11A apply package does not make Jane bootstrapSafe", phase11aApply.includes("bootstrapSafe") && phase11aApply.includes("false"));
assert("Phase 11A verifier package remains registered", packageJson.includes("verify:admin-users-phase11a-limited-test-user-simulation-safety"));
assert("Phase 11A verifier package contains limited-user safety contract", phase11aVerifier.includes("jane.doe.limited@example.com") && phase11aVerifier.includes("read_only_admin"));

console.log("CONTRACT: Phase 12B is intentionally source/verifier-only and avoids live DB access.");
console.log("CONTRACT: Phase 11A remains the DB-created Jane Doe proof point; Phase 12B records the auth identity gap.");
console.log("CONTRACT: Phase 12 implementation must not enforce Jane Doe limitations until authenticated session identity includes AdminUser.email.");
console.log("CONTRACT: Missing session email must preserve current owner-safe generic admin behavior until explicit owner identity login is proven.");
console.log("CONTRACT: /admin, /admin/permissions, /api/admin/permissions, and /api/admin/permissions/check must remain owner/admin reachable.");
console.log("CONTRACT: Phase 12C should add passive identity helpers/session diagnostics before any blocking behavior changes.");

if (process.exitCode) process.exit(process.exitCode);
