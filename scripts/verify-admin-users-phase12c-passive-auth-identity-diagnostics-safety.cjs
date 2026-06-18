#!/usr/bin/env node
const fs = require("fs");
function read(path){ if(fs.existsSync(path) === false){ console.error("FAIL missing "+path); process.exit(1); } return fs.readFileSync(path,"utf8"); }
function assert(label, ok){ if(ok === false){ console.error("FAIL: "+label); process.exit(1); } console.log("PASS: "+label); }
console.log("RUN: Phase 12C passive auth identity diagnostics safety verifier");
console.log("Forward-compatible: validates diagnostics remain passive and session authorization still depends on the generic gate cookie.");
const adminAuth = read("lib/adminAuth.ts");
const login = read("app/api/auth/login/route.ts");
const session = read("app/api/auth/session/route.ts");
const permissions = read("lib/adminPermissions.ts");
const pkg = JSON.parse(read("package.json"));
assert("existing generic admin gate cookie name remains unchanged", adminAuth.includes('ADMIN_COOKIE_NAME = "barsh_admin_gate"'));
assert("passive identity cookie name is separate from gate cookie", adminAuth.includes('ADMIN_IDENTITY_COOKIE_NAME = "barsh_admin_identity"'));
assert("authorization still depends on generic admin gate token equality only", adminAuth.includes("actualToken === expectedToken"));
assert("setAdminGateCookie still writes generic gate cookie", adminAuth.includes("response.cookies.set(ADMIN_COOKIE_NAME, sessionToken"));
assert("setAdminGateCookie does not write identity cookie", /setAdminGateCookie[\s\S]*ADMIN_IDENTITY_COOKIE_NAME[\s\S]*response\.cookies\.set/.test(adminAuth) === false);
assert("login route still sets generic admin gate cookie", login.includes("setAdminGateCookie(response)"));
assert("login route does not set identity cookie", login.includes("ADMIN_IDENTITY_COOKIE_NAME") === false);
assert("passive identity diagnostics type exists", adminAuth.includes("AdminSessionIdentityDiagnostics"));
assert("passive diagnostics helper exists", adminAuth.includes("adminSessionIdentityDiagnostics"));
assert("session imports passive diagnostics", session.includes("adminSessionIdentityDiagnostics"));
assert("session response exposes identityDiagnostics", session.includes("identityDiagnostics,"));
assert("session still computes authenticated from isAdminRequestAuthorized", session.includes("const authenticated = isAdminRequestAuthorized(req)"));
assert("session still grants all permissions to authenticated generic admin session", session.includes("const permissions = authenticated ? allAdminPermissionKeys() : []"));
assert("session still uses default-admin-allow-all mode", session.includes('permissionsMode: "default-admin-allow-all"'));
assert("session user exposes identityBound diagnostically only", session.includes("identityBound: identityDiagnostics.identityBound"));
assert("session route still does not query AdminUser table", /prisma\.adminUser|adminUser\.find|SELECT[\s\S]*AdminUser/i.test(session) === false);
assert("permission never-block paths remain hardcoded", permissions.includes("/admin") && permissions.includes("/admin/permissions") && permissions.includes("/api/admin/permissions") && permissions.includes("/api/admin/permissions/check"));
assert("package script registered for Phase 12C", pkg.scripts && pkg.scripts["verify:admin-users-phase12c-passive-auth-identity-diagnostics-safety"] === "node scripts/verify-admin-users-phase12c-passive-auth-identity-diagnostics-safety.cjs");
console.log("CONTRACT: Session identity diagnostics remain passive.");
console.log("CONTRACT: Generic owner/admin access remains intact.");
console.log("CONTRACT: No AdminUser identity is enforced in session authorization yet.");
