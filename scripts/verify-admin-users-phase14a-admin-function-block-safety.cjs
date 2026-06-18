#!/usr/bin/env node
const fs = require("fs");
function read(path){ if(fs.existsSync(path) === false){ console.error("FAIL missing "+path); process.exit(1); } return fs.readFileSync(path,"utf8"); }
function assert(label, ok){ if(ok === false){ console.error("FAIL: "+label); process.exit(1); } console.log("PASS: "+label); }

console.log("RUN: Phase 14A admin-function enforcement safety verifier");

const pkg = JSON.parse(read("package.json"));
const middleware = read("middleware.ts");
const adminAuth = read("lib/adminAuth.ts");
const login = read("app/api/auth/login/route.ts");
const session = read("app/api/auth/session/route.ts");
const p13c = read("scripts/verify-admin-users-phase13c-non-owner-login-readiness-safety.cjs");

assert("package script registered for Phase 14A", pkg.scripts && pkg.scripts["verify:admin-users-phase14a-admin-function-block-safety"] === "node scripts/verify-admin-users-phase14a-admin-function-block-safety.cjs");
assert("middleware exists and targets admin surfaces", middleware.includes('matcher: ["/admin/:path*", "/api/admin/:path*"]'));
assert("middleware blocks admin pages and API admin routes", middleware.includes('pathname.startsWith("/admin/")') && middleware.includes('pathname.startsWith("/api/admin/")'));
assert("middleware preserves owner email access", middleware.includes('OWNER_ADMIN_EMAIL = "dbarshay15@gmail.com"') && middleware.includes("identityEmail === OWNER_ADMIN_EMAIL"));
assert("middleware preserves legacy/generic owner recovery", middleware.includes("if (!identityEmail) return NextResponse.next()"));
assert("middleware returns 403 for api admin blocked users", middleware.includes("NextResponse.json") && middleware.includes("status: 403"));
assert("middleware redirects blocked admin pages", middleware.includes("adminBlocked") && middleware.includes("NextResponse.redirect"));
assert("signed gate payload carries identity", adminAuth.includes("identity?: AdminIdentityCookieInput") || adminAuth.includes("identity?: AdminIdentityCookieInput | null"));
assert("setAdminGateCookie accepts optional identity", adminAuth.includes("setAdminGateCookie(response: NextResponse, identity?: AdminIdentityCookieInput | null)"));
assert("login writes identity into signed gate", login.includes("setAdminGateCookie(response, identityCookieInput)") && login.includes("setAdminIdentityCookie(response, identityCookieInput)"));
assert("session refresh writes identity into signed gate", session.includes("setAdminGateCookie(response, identityCookieInput)"));
assert("non-owner login remains allowed from Phase 13C", p13c.includes("Phase 13C permits active non-owner AdminUsers with passwordHash to authenticate."));
assert("permission enforcement is scoped to admin functions only", middleware.includes('permissionEnforcementScope: "admin-functions-only"'));
assert("no password viewing or impersonation added", !middleware.includes("passwordHash") && !middleware.includes("impersonat"));

console.log("CONTRACT: Phase 14A blocks signed non-owner identities from /admin and /api/admin.");
console.log("CONTRACT: Phase 14A allows regular non-admin app access and keeps owner/generic recovery available.");
console.log("CONTRACT: Phase 14A does not add password viewing or impersonation.");
console.log("PASS: Phase 14A admin-function block is first-target enforcement safe.");
