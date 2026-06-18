#!/usr/bin/env node
const fs = require("fs");
function read(path){ if(fs.existsSync(path) === false){ console.error("FAIL missing "+path); process.exit(1); } return fs.readFileSync(path,"utf8"); }
function assert(label, ok){ if(ok === false){ console.error("FAIL: "+label); process.exit(1); } console.log("PASS: "+label); }
console.log("RUN: Phase 12C passive auth identity diagnostics safety verifier");
console.log("Forward-compatible: validates authorization still depends on the generic gate cookie and permission enforcement remains off.");
const adminAuth = read("lib/adminAuth.ts");
const login = read("app/api/auth/login/route.ts");
const session = read("app/api/auth/session/route.ts");
const permissions = read("lib/adminPermissions.ts");
const pkg = JSON.parse(read("package.json"));
assert("existing generic admin gate cookie name remains unchanged", adminAuth.includes('ADMIN_COOKIE_NAME = "barsh_admin_gate"'));
assert("identity cookie name is separate from gate cookie", adminAuth.includes('ADMIN_IDENTITY_COOKIE_NAME = "barsh_admin_identity"'));
assert("authorization still depends on generic admin gate token equality only", adminAuth.includes("actualToken === expectedToken"));
assert("setAdminGateCookie still writes generic gate cookie", adminAuth.includes("response.cookies.set(ADMIN_COOKIE_NAME, sessionToken"));
assert("identity cookie setter is separate from gate cookie setter", adminAuth.includes("setAdminIdentityCookie") && adminAuth.includes("response.cookies.set(ADMIN_IDENTITY_COOKIE_NAME"));
assert("login route sets generic admin gate cookie", login.includes("setAdminGateCookie(response)"));
assert("diagnostic identity helper exists", adminAuth.includes("adminSessionIdentityDiagnostics"));
assert("session response exposes identityDiagnostics", session.includes("identityDiagnostics,"));
assert("session still computes authenticated from isAdminRequestAuthorized", session.includes("const authenticated = isAdminRequestAuthorized(req)"));
assert("session still grants all permissions to authenticated generic gate session", session.includes("const permissions = authenticated ? allAdminPermissionKeys() : []"));
assert("session still uses default-admin-allow-all mode", session.includes('permissionsMode: "default-admin-allow-all"'));
assert("permission never-block paths remain hardcoded", permissions.includes("/admin") && permissions.includes("/admin/permissions") && permissions.includes("/api/admin/permissions") && permissions.includes("/api/admin/permissions/check"));
assert("package script registered for Phase 12C", pkg.scripts && pkg.scripts["verify:admin-users-phase12c-passive-auth-identity-diagnostics-safety"] === "node scripts/verify-admin-users-phase12c-passive-auth-identity-diagnostics-safety.cjs");
console.log("CONTRACT: Generic owner/admin gate authorization remains intact.");
console.log("CONTRACT: Identity diagnostics may now be signed and bound, but permission enforcement remains off.");
