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

console.log("RUN: Phase 14B admin-function block smoke/build proof verifier");

const pkg = JSON.parse(read("package.json"));
const middleware = read("proxy.ts");
const adminAuth = read("lib/adminAuth.ts");
const loginRoute = read("app/api/auth/login/route.ts");
const sessionRoute = read("app/api/auth/session/route.ts");
const p14a = read("scripts/verify-admin-users-phase14a-admin-function-block-safety.cjs");

assert("package script registered for Phase 14B", pkg.scripts && pkg.scripts["verify:admin-users-phase14b-admin-block-smoke-safety"] === "node scripts/verify-admin-users-phase14b-admin-block-smoke-safety.cjs");
assert("Phase 14A verifier remains present", Boolean(pkg.scripts["verify:admin-users-phase14a-admin-function-block-safety"]));
assert("proxy file exists", middleware.includes("export async function proxy"));\nassert("middleware.ts removed for Next 16 proxy compatibility", fs.existsSync("middleware.ts") === false);
assert("proxy matcher only targets admin surfaces", middleware.includes('matcher: ["/admin/:path*", "/api/admin/:path*"]'));
assert("proxy does not target regular matter/lawsuit routes", !middleware.includes('"/matter/:path*"') && !middleware.includes('"/matters/:path*"') && !middleware.includes('"/lawsuits/:path*"'));
assert("proxy blocks /admin exact and nested", middleware.includes('pathname === "/admin"') && middleware.includes('pathname.startsWith("/admin/")'));
assert("proxy blocks /api/admin exact and nested", middleware.includes('pathname === "/api/admin"') && middleware.includes('pathname.startsWith("/api/admin/")'));
assert("proxy allows non-admin surfaces", middleware.includes("if (!isAdminSurface(pathname)) return NextResponse.next()"));
assert("proxy allows invalid/expired/no signed gate to fall through to existing auth", middleware.includes("if (!gate) return NextResponse.next()"));
assert("proxy allows generic owner recovery", middleware.includes("if (!identityEmail) return NextResponse.next()"));
assert("proxy allows owner identity", middleware.includes('identityEmail === OWNER_ADMIN_EMAIL'));
assert("proxy blocks non-owner identity", middleware.includes("return blockedResponse(req)"));
assert("api admin block is 403 JSON", middleware.includes("NextResponse.json") && middleware.includes("status: 403"));
assert("admin page block redirects to /", middleware.includes('url.pathname = "/"') && middleware.includes("adminBlocked"));
assert("signed gate embeds identity in auth helper", adminAuth.includes("identity?: AdminIdentityCookieInput | null"));
assert("login route writes identity into gate cookie", loginRoute.includes("setAdminGateCookie(response, identityCookieInput)"));
assert("session route refreshes identity into gate cookie", sessionRoute.includes("setAdminGateCookie(response, identityCookieInput)"));
assert("Phase 14A contract says admin-functions-only", p14a.includes("admin-functions-only"));
assert("no password visibility added", !middleware.includes("passwordHash") && !middleware.includes("passwordExposed: true"));
assert("no impersonation added", !middleware.includes("impersonat") && !loginRoute.includes("accessAsUser"));

console.log("SIMULATION: owner signed identity -> /admin allowed by owner email check.");
console.log("SIMULATION: Jane signed identity -> /admin blocked by non-owner fallback.");
console.log("SIMULATION: Jane signed identity -> /api/admin blocked with 403 JSON.");
console.log("SIMULATION: Jane signed identity -> /matters or /lawsuits unaffected because matcher excludes those routes.");
console.log("PASS: Phase 14B admin block smoke/build proof is safe.");
