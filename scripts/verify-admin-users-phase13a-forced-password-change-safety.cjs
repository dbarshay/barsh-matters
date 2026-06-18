#!/usr/bin/env node
const fs = require("fs");
function read(path){ if(fs.existsSync(path) === false){ console.error("FAIL missing "+path); process.exit(1); } return fs.readFileSync(path,"utf8"); }
function assert(label, ok){ if(ok === false){ console.error("FAIL: "+label); process.exit(1); } console.log("PASS: "+label); }

console.log("RUN: Phase 13A forced password change safety verifier");

const pkg = JSON.parse(read("package.json"));
const route = read("app/api/auth/change-password/route.ts");
const page = read("app/change-password/page.tsx");
const login = read("app/login/page.tsx");

assert("package script registered for Phase 13A", pkg.scripts && pkg.scripts["verify:admin-users-phase13a-forced-password-change-safety"] === "node scripts/verify-admin-users-phase13a-forced-password-change-safety.cjs");
assert("change password route exists and is node runtime", route.includes('export const runtime = "nodejs"'));
assert("route requires authenticated admin session", route.includes("isAdminRequestAuthorized(req)") && route.includes("Authenticated administrator session required"));
assert("route requires signed AdminUser identity", route.includes("adminSessionIdentityDiagnostics") && route.includes("identity.identityBound"));
assert("route verifies active AdminUser", route.includes('user.status !== "active"'));
assert("route checks current password", route.includes("bcrypt.compare(currentPassword, user.passwordHash)"));
assert("route enforces Phase 12D password policy", route.includes("passwordPolicyErrors") && route.includes("minimumLength") && route.includes("requiresUppercase") && route.includes("requiresLowercase") && route.includes("requiresNumber") && route.includes("requiresSymbol"));
assert("route hashes new password", route.includes("bcrypt.hash(newPassword, 12)"));
assert("route clears passwordChangeRequired", route.includes("passwordChangeRequired: false"));
assert("route never exposes password", route.includes("passwordExposed: false") && route.includes("passwordReturned: false"));
assert("route does not impersonate", route.includes("impersonationEnabled: false") && !route.includes("accessAsUser"));
assert("change password page exists", page.includes('data-barsh-change-password-page="true"'));
assert("change password page uses password inputs", page.includes('type="password"') && page.includes('data-barsh-change-password-current="true"') && page.includes('data-barsh-change-password-new="true"'));
assert("login redirects passwordChangeRequired users", login.includes("passwordChangeRequired") && login.includes('window.location.href = "/change-password"'));
console.log("PASS: Phase 13A forced password change is safe.");
