#!/usr/bin/env node
import fs from "node:fs";

const failures = [];

function read(path) {
  return fs.existsSync(path) ? fs.readFileSync(path, "utf8") : "";
}

const loginRoute = read("app/api/auth/login/route.ts");
const logoutRoute = read("app/api/auth/logout/route.ts");
const sessionRoute = read("app/api/auth/session/route.ts");
const loginPage = read("app/login/page.tsx");
const proxy = read("proxy.ts");
const pkg = JSON.parse(read("package.json"));

for (const required of [
  "configuredAdminPassword",
  "configuredAdminSessionToken",
  "setAdminGateCookie(response)",
  "twoFactorPlanned",
  "safeReturnTo",
  'candidate.startsWith("/admin")',
]) {
  if (!loginRoute.includes(required)) {
    failures.push(`app/api/auth/login/route.ts missing login foundation fragment: ${required}`);
  }
}

for (const required of [
  "clearAdminGateCookie(response)",
  "auth-logout",
  "Administrator session cleared.",
]) {
  if (!logoutRoute.includes(required)) {
    failures.push(`app/api/auth/logout/route.ts missing logout fragment: ${required}`);
  }
}

for (const required of [
  "isAdminRequestAuthorized(req)",
  "auth-session",
  "authenticated",
  "role: \"admin\"",
]) {
  if (!sessionRoute.includes(required)) {
    failures.push(`app/api/auth/session/route.ts missing session fragment: ${required}`);
  }
}

for (const required of [
  'data-barsh-login-page="true"',
  'data-barsh-login-form="true"',
  'data-barsh-login-password="true"',
  'data-barsh-login-submit="true"',
  'fetch("/api/auth/session"',
  'fetch("/api/auth/login"',
  'fetch("/api/auth/logout"',
  "Two-factor authentication by SMS or phone push is planned for a later auth phase.",
]) {
  if (!loginPage.includes(required)) {
    failures.push(`app/login/page.tsx missing login UI fragment: ${required}`);
  }
}

for (const required of [
  'matcher: ["/admin/:path*", "/api/admin/:path*"]',
  "pathname === ADMIN_AUTHORIZE_PATH",
  "return adminUnauthorizedJson(401);",
  'redirectUrl.pathname = "/login";',
  'redirectUrl.searchParams.set("from", requestedPath);',
]) {
  if (!proxy.includes(required)) {
    failures.push(`proxy.ts should preserve current login redirect/admin API gate contract; missing: ${required}`);
  }
}

if (pkg.scripts?.["verify:admin-login-foundation-safety"] !== "node scripts/verify-admin-login-foundation-safety.mjs") {
  failures.push("package.json missing verify:admin-login-foundation-safety script");
}

console.log("RESULT: admin login foundation safety verifier");

if (failures.length) {
  console.log(`FAILURES=${failures.length}`);
  for (const failure of failures) console.log(`FAIL=${failure}`);
  process.exit(1);
}

console.log("FAILURES=0");
console.log("PASS: login/logout/session foundation exists without replacing the current admin login/proxy gate.");
