#!/usr/bin/env node
const fs = require("fs");

function read(path) {
  if (fs.existsSync(path) === false) {
    console.error("FAIL missing " + path);
    process.exit(1);
  }
  return fs.readFileSync(path, "utf8");
}

function assert(label, ok) {
  if (ok === false) {
    console.error("FAIL: " + label);
    process.exit(1);
  }
  console.log("PASS: " + label);
}

console.log("RUN: Phase 12I 60-minute inactivity timeout safety verifier");

const pkg = JSON.parse(read("package.json"));
const adminAuth = read("lib/adminAuth.ts");
const login = read("app/api/auth/login/route.ts");
const session = read("app/api/auth/session/route.ts");
const logout = read("app/api/auth/logout/route.ts");
const permissions = read("lib/adminPermissions.ts");

assert("package script registered for Phase 12I", pkg.scripts && pkg.scripts["verify:admin-users-phase12i-inactivity-timeout-safety"] === "node scripts/verify-admin-users-phase12i-inactivity-timeout-safety.cjs");
assert("60-minute timeout constant exists", adminAuth.includes("ADMIN_SESSION_INACTIVITY_TIMEOUT_SECONDS = 60 * 60"));
assert("generic gate cookie is signed", adminAuth.includes("createSignedAdminGateCookieValue") && adminAuth.includes('source: "signed-gate"'));
assert("generic gate cookie includes lastActivityAt", adminAuth.includes("lastActivityAt"));
assert("authorization reads signed gate cookie", adminAuth.includes("readSignedAdminGateCookie") && adminAuth.includes("req.cookies.get(ADMIN_COOKIE_NAME)?.value"));
assert("old raw token is not treated as active session", adminAuth.includes("if (!cookieValue.includes(\".\")) return null;"));
assert("timeout compares inactive age", adminAuth.includes("inactiveForMs") && adminAuth.includes("ADMIN_SESSION_INACTIVITY_TIMEOUT_SECONDS * 1000"));
assert("gate cookie maxAge is 60 minutes", adminAuth.includes("response.cookies.set(ADMIN_COOKIE_NAME") && adminAuth.includes("maxAge: ADMIN_SESSION_INACTIVITY_TIMEOUT_SECONDS"));
assert("identity cookie maxAge is 60 minutes", adminAuth.includes("response.cookies.set(ADMIN_IDENTITY_COOKIE_NAME") && adminAuth.includes("maxAge: ADMIN_SESSION_INACTIVITY_TIMEOUT_SECONDS"));
assert("login still sets generic gate cookie", login.includes("setAdminGateCookie(response)"));
assert("login still supports owner username password", login.includes("bcrypt.compare(password, user.passwordHash)") && login.includes("body?.username"));
assert("login still supports legacy fallback", login.includes('credentialMode: "legacy-admin-password"'));
assert("session refreshes gate cookie activity", session.includes("setAdminGateCookie(response)"));
assert("session refreshes identity cookie when identity-bound", session.includes("setAdminIdentityCookie(response") && session.includes("identityDiagnostics.identityBound"));
assert("logout clears gate cookie", logout.includes("clearAdminGateCookie(response)"));
assert("logout clears identity cookie", logout.includes("clearAdminIdentityCookie(response)"));
assert("session remains default allow-all", session.includes('permissionsMode: "default-admin-allow-all"'));
assert("session does not query AdminUser table", /prisma\.adminUser|adminUser\.find|SELECT[\s\S]*AdminUser/i.test(session) === false);
assert("never-block routes remain present", permissions.includes("/admin") && permissions.includes("/admin/permissions") && permissions.includes("/api/admin/permissions") && permissions.includes("/api/admin/permissions/check"));

console.log("CONTRACT: Phase 12I requires re-login after 60 minutes of inactivity.");
console.log("CONTRACT: Phase 12I refreshes activity through /api/auth/session while keeping permission enforcement off.");
console.log("PASS: Phase 12I inactivity timeout is locked as no-enforcement.");
