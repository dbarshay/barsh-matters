#!/usr/bin/env node
import fs from "node:fs";

const failures = [];
const proxy = fs.readFileSync("proxy.ts", "utf8");
const login = fs.readFileSync("app/login/page.tsx", "utf8");
const auth = fs.readFileSync("app/api/admin/authorize/route.ts", "utf8");
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));

for (const required of [
  "redirectUrl.pathname = \"/login\";",
  "redirectUrl.searchParams.set(\"from\", requestedPath);",
  "return adminUnauthorizedJson(401);",
  "pathname === ADMIN_AUTHORIZE_PATH",
  "matcher: [\"/admin/:path*\", \"/api/admin/:path*\"]",
]) {
  if (!proxy.includes(required)) failures.push(`proxy.ts missing login redirect fragment: ${required}`);
}

for (const forbidden of [
  "redirectUrl.pathname = \"/\";",
  "redirectUrl.searchParams.set(\"adminRequired\", \"1\");",
]) {
  if (proxy.includes(forbidden)) failures.push(`proxy.ts still has old home prompt redirect fragment: ${forbidden}`);
}

for (const required of [
  "safeReturnToFromSearch",
  "candidate.startsWith(\"/admin\")",
  "fetch(\"/api/auth/login\"",
  "window.location.href = clean(json.returnTo) || returnTo",
]) {
  if (!login.includes(required)) failures.push(`app/login/page.tsx missing login redirect receiver fragment: ${required}`);
}

for (const required of [
  "setAdminGateCookie(response)",
  "admin-authorize",
]) {
  if (!auth.includes(required)) failures.push(`app/api/admin/authorize/route.ts missing authorize fallback fragment: ${required}`);
}

if (pkg.scripts?.["verify:admin-login-redirect-safety"] !== "node scripts/verify-admin-login-redirect-safety.mjs") {
  failures.push("package.json missing verify:admin-login-redirect-safety script");
}

console.log("RESULT: admin login redirect safety verifier");

if (failures.length) {
  console.log(`FAILURES=${failures.length}`);
  for (const failure of failures) console.log(`FAIL=${failure}`);
  process.exit(1);
}

console.log("FAILURES=0");
console.log("PASS: admin page requests redirect to login, admin API requests stay JSON 401, authorize fallback remains.");

