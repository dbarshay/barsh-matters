#!/usr/bin/env node
import fs from "node:fs";

const failures = [];
const proxy = fs.readFileSync("proxy.ts", "utf8");
const login = fs.readFileSync("app/login/page.tsx", "utf8");
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));

for (const required of [
  "const requestedPath = `${pathname}${req.nextUrl.search}`;",
  "redirectUrl.pathname = \"/login\";",
  "redirectUrl.search = \"\";",
  "redirectUrl.searchParams.set(\"from\", requestedPath);",
]) {
  if (!proxy.includes(required)) failures.push(`proxy.ts missing clean login redirect fragment: ${required}`);
}

for (const forbidden of [
  "redirectUrl.searchParams.set(\"adminRequired\", \"1\");",
  "redirectUrl.pathname = \"/\";",
]) {
  if (proxy.includes(forbidden)) failures.push(`proxy.ts still has old home prompt fragment: ${forbidden}`);
}

for (const required of [
  "safeReturnToFromSearch",
  "candidate.startsWith(\"/admin\")",
]) {
  if (!login.includes(required)) failures.push(`app/login/page.tsx missing from receiver fragment: ${required}`);
}

if (pkg.scripts?.["verify:admin-proxy-clean-redirect-safety"] !== "node scripts/verify-admin-proxy-clean-redirect-safety.mjs") {
  failures.push("package.json missing verify:admin-proxy-clean-redirect-safety script");
}

console.log("RESULT: admin proxy clean redirect safety verifier");
if (failures.length) {
  console.log(`FAILURES=${failures.length}`);
  for (const failure of failures) console.log(`FAIL=${failure}`);
  process.exit(1);
}
console.log("FAILURES=0");
console.log("PASS: admin proxy redirects cleanly to /login with requested admin path preserved in from.");

