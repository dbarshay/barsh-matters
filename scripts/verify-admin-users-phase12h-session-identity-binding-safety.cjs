#!/usr/bin/env node
const fs = require("fs");
function read(path){ if(fs.existsSync(path) === false){ console.error("FAIL missing "+path); process.exit(1); } return fs.readFileSync(path,"utf8"); }
function assert(label, ok){ if(ok === false){ console.error("FAIL: "+label); process.exit(1); } console.log("PASS: "+label); }
console.log("RUN: Phase 12H session identity binding safety verifier");
const pkg = JSON.parse(read("package.json"));
const adminAuth = read("lib/adminAuth.ts");
const login = read("app/api/auth/login/route.ts");
const logout = read("app/api/auth/logout/route.ts");
const session = read("app/api/auth/session/route.ts");
const permissions = read("lib/adminPermissions.ts");
assert("package script registered for Phase 12H", pkg.scripts && pkg.scripts["verify:admin-users-phase12h-session-identity-binding-safety"] === "node scripts/verify-admin-users-phase12h-session-identity-binding-safety.cjs");
assert("adminAuth imports crypto HMAC", adminAuth.includes("createHmac") && adminAuth.includes("timingSafeEqual"));
assert("adminAuth keeps generic gate cookie", adminAuth.includes("barsh_admin_gate"));
assert("adminAuth keeps identity cookie separate", adminAuth.includes("barsh_admin_identity"));
assert("adminAuth creates signed identity cookie value", adminAuth.includes("createAdminIdentityCookieValue") && adminAuth.includes("signAdminIdentityPayload"));
assert("adminAuth reads signed identity cookie", adminAuth.includes("readSignedAdminIdentityCookie"));
assert("adminAuth identity diagnostics include AdminUser.id", adminAuth.includes("id: string | null") && adminAuth.includes("id: signedIdentity?.id || null"));
assert("adminAuth authorization still uses generic gate token equality", adminAuth.includes("actualToken === expectedToken"));
assert("adminAuth can set identity cookie", adminAuth.includes("setAdminIdentityCookie") && adminAuth.includes("response.cookies.set(ADMIN_IDENTITY_COOKIE_NAME"));
assert("adminAuth can clear identity cookie", adminAuth.includes("clearAdminIdentityCookie") && adminAuth.includes("maxAge: 0"));
assert("login imports setAdminIdentityCookie", login.includes("setAdminIdentityCookie"));
assert("login sets identity cookie after owner credential branch", login.includes("setAdminIdentityCookie(response, {") && login.includes("id: user.id"));
assert("login legacy fallback still exists", login.includes("legacy-admin-password") && login.includes("configuredAdminPassword"));
assert("login preserves generic gate cookie", login.includes("setAdminGateCookie(response)"));
assert("logout clears identity cookie", logout.includes("clearAdminIdentityCookie(response)"));
assert("session user exposes AdminUser.id from diagnostics", session.includes("id: identityDiagnostics.id"));
assert("session user exposes username from diagnostics", session.includes("username: identityDiagnostics.username"));
assert("session remains default allow-all", session.includes("default-admin-allow-all"));
assert("session does not query AdminUser table", /prisma\.adminUser|adminUser\.find|SELECT[\s\S]*AdminUser/i.test(session) === false);
assert("never-block routes remain present", permissions.includes("/admin") && permissions.includes("/admin/permissions") && permissions.includes("/api/admin/permissions") && permissions.includes("/api/admin/permissions/check"));
console.log("CONTRACT: Phase 12H binds signed session identity diagnostics to AdminUser.id for owner username/password login.");
console.log("CONTRACT: Phase 12H still authorizes from the generic gate cookie and does not enforce per-user permissions.");
console.log("PASS: Phase 12H session identity binding is locked as no-enforcement.");
