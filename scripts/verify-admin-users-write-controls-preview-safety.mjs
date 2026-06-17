import fs from "node:fs";

const page = fs.readFileSync("app/admin/users/page.tsx", "utf8");
const api = fs.readFileSync("app/api/admin/users/planning/route.ts", "utf8");
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const failures = [];

for (const required of [
  'data-barsh-admin-users-write-controls-preview="read-only"',
  "Future Write Controls Preview",
  "Planning only.",
  "No button in this section creates users",
  "Add Admin User",
  "Assign Role",
  "Remove Role",
  "Permission Override",
  "Enable Enforcement",
  "Preview only",
  "Not available",
]) {
  if (!page.includes(required)) failures.push("write controls preview page missing required fragment: " + required);
}

for (const forbidden of [
  "onClick={",
  "fetch(\\\"/api/admin/users",
  "method: \\\"POST\\\"",
  "method: \\\"PATCH\\\"",
  "method: \\\"PUT\\\"",
  "method: \\\"DELETE\\\"",
  ".create(",
  ".update(",
  ".delete(",
  ".upsert(",
  "BARSH_ADMIN_PERMISSIONS_ENFORCEMENT=1",
]) {
  if (page.includes(forbidden) || api.includes(forbidden)) failures.push("write controls preview must not include write/enforcement fragment: " + forbidden);
}

if (pkg.scripts?.["verify:admin-users-write-controls-preview-safety"] !== "node scripts/verify-admin-users-write-controls-preview-safety.mjs") failures.push("package.json missing verify:admin-users-write-controls-preview-safety script");

console.log("RESULT: admin users write-controls preview safety verifier");
if (failures.length) {
  console.log("FAILURES=" + failures.length);
  for (const failure of failures) console.log("FAIL=" + failure);
  process.exit(1);
}
console.log("FAILURES=0");
console.log("PASS: admin users page shows future write controls as read-only planning only, with no active write UI or enforcement wiring.");
