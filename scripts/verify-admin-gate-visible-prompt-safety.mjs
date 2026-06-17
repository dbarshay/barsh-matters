#!/usr/bin/env node
import fs from "node:fs";

const failures = [];
const page = fs.readFileSync("app/page.tsx", "utf8");
const proxy = fs.readFileSync("proxy.ts", "utf8");
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));

for (const forbidden of [
  "adminRequired",
  "barshMattersAdminGatePrompted",
  "Open Administrator Home\", () =>",
]) {
  if (page.includes(forbidden)) failures.push(`app/page.tsx still has obsolete visible prompt fragment: ${forbidden}`);
}

for (const required of [
  "redirectUrl.pathname = \"/login\";",
  "redirectUrl.searchParams.set(\"from\", requestedPath);",
]) {
  if (!proxy.includes(required)) failures.push(`proxy.ts missing login redirect fragment: ${required}`);
}

if (pkg.scripts?.["verify:admin-gate-visible-prompt-safety"] !== "node scripts/verify-admin-gate-visible-prompt-safety.mjs") {
  failures.push("package.json missing verify:admin-gate-visible-prompt-safety script");
}

console.log("RESULT: admin gate visible prompt safety verifier");
if (failures.length) {
  console.log(`FAILURES=${failures.length}`);
  for (const failure of failures) console.log(`FAIL=${failure}`);
  process.exit(1);
}
console.log("FAILURES=0");
console.log("PASS: obsolete visible home prompt has been retired in favor of /login redirect.");

