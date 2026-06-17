#!/usr/bin/env node
import fs from "node:fs";

const failures = [];
const page = fs.readFileSync("app/page.tsx", "utf8");
const proxy = fs.readFileSync("proxy.ts", "utf8");
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));

for (const forbidden of [
  "ADMINISTRATOR ACCESS REQUIRED",
  "params.get(\"adminRequired\") !== \"1\"",
  "barshMattersAdminGatePrompted",
  "void runAdministratorGate(\"Open Administrator Home\"",
  "fetch(\"/api/admin/authorize\"",
]) {
  if (page.includes(forbidden)) failures.push(`app/page.tsx still has obsolete home prompt fragment: ${forbidden}`);
}

for (const required of [
  "function openAdministratorMenu()",
  "window.location.href = \"/admin\";",
]) {
  if (!page.includes(required)) failures.push(`app/page.tsx missing admin navigation fragment: ${required}`);
}

for (const required of [
  "redirectUrl.pathname = \"/login\";",
  "redirectUrl.searchParams.set(\"from\", requestedPath);",
  "return adminUnauthorizedJson(401);",
]) {
  if (!proxy.includes(required)) failures.push(`proxy.ts missing login redirect fragment: ${required}`);
}

if (pkg.scripts?.["verify:admin-home-login-redirect-cleanup-safety"] !== "node scripts/verify-admin-home-login-redirect-cleanup-safety.mjs") {
  failures.push("package.json missing verify:admin-home-login-redirect-cleanup-safety script");
}

console.log("RESULT: admin home login redirect cleanup safety verifier");
if (failures.length) {
  console.log(`FAILURES=${failures.length}`);
  for (const failure of failures) console.log(`FAIL=${failure}`);
  process.exit(1);
}
console.log("FAILURES=0");
console.log("PASS: home page no longer owns obsolete adminRequired prompt flow; /admin navigation relies on login redirect.");

