#!/usr/bin/env node
import fs from "node:fs";

const failures = [];

function read(path) {
  return fs.existsSync(path) ? fs.readFileSync(path, "utf8") : "";
}

const auth = read("lib/adminAuth.ts");
const authorize = read("app/api/admin/authorize/route.ts");
const proxy = read("proxy.ts");
const page = read("app/page.tsx");
const pkg = JSON.parse(read("package.json"));

for (const required of [
  "export const ADMIN_COOKIE_NAME = \"barsh_admin_gate\";",
  "export const ADMIN_AUTHORIZE_PATH = \"/api/admin/authorize\";",
  "configuredAdminPassword",
  "configuredAdminSessionToken",
  "isAdminRequestAuthorized",
  "setAdminGateCookie",
  "clearAdminGateCookie",
  "adminUnauthorizedJson",
]) {
  if (!auth.includes(required)) {
    failures.push(`lib/adminAuth.ts missing required auth foundation fragment: ${required}`);
  }
}

for (const forbidden of [
  "const ADMIN_COOKIE_NAME =",
  "function configuredAdminPassword()",
  "function configuredAdminSessionToken()",
]) {
  if (authorize.includes(forbidden)) {
    failures.push(`app/api/admin/authorize/route.ts still owns duplicated auth logic: ${forbidden}`);
  }
}

for (const required of [
  "from \"@/lib/adminAuth\"",
  "configuredAdminPassword",
  "configuredAdminSessionToken",
  "setAdminGateCookie(response)",
  "Administrator password is not configured.  Set BARSH_ADMIN_PASSWORD and BARSH_ADMIN_SESSION_TOKEN.",
]) {
  if (!authorize.includes(required)) {
    failures.push(`app/api/admin/authorize/route.ts missing centralized auth fragment: ${required}`);
  }
}

for (const required of [
  'pathname.startsWith("/admin")',
  'pathname.startsWith("/api/admin")',
  "pathname === ADMIN_AUTHORIZE_PATH",
  "isAdminRequestAuthorized(req)",
  "return adminUnauthorizedJson(401);",
  'matcher: ["/admin/:path*", "/api/admin/:path*"]',
  'const requestedPath = `${pathname}${req.nextUrl.search}`;',
  'redirectUrl.search = "";',
  
  'redirectUrl.pathname = "/login";',
  'redirectUrl.searchParams.set("from", requestedPath);',
]) {
  if (!proxy.includes(required)) {
    failures.push(`proxy.ts missing admin auth/proxy foundation fragment: ${required}`);
  }
}

for (const required of [
  'redirectUrl.pathname = "/login";',
  'redirectUrl.searchParams.set("from", requestedPath);',
  'return adminUnauthorizedJson(401);',
]) {
  if (!proxy.includes(required)) {
    failures.push(`proxy.ts missing current login redirect/admin API auth fragment: ${required}`);
  }
}

for (const forbidden of [
  'adminRequired',
  'barshMattersAdminGatePrompted',
  'void runAdministratorGate("Open Administrator Home"',
]) {
  if (page.includes(forbidden)) {
    failures.push(`app/page.tsx still has obsolete home prompt auth fragment: ${forbidden}`);
  }
}

if (pkg.scripts?.["verify:admin-auth-foundation-safety"] !== "node scripts/verify-admin-auth-foundation-safety.mjs") {
  failures.push("package.json missing verify:admin-auth-foundation-safety script");
}

console.log("RESULT: admin auth foundation safety verifier");

if (failures.length) {
  console.log(`FAILURES=${failures.length}`);
  for (const failure of failures) console.log(`FAIL=${failure}`);
  process.exit(1);
}

console.log("FAILURES=0");
console.log("PASS: admin auth foundation is centralized and proxy protects admin pages plus admin APIs while preserving login redirect authorization.");
