import fs from "node:fs";

const page = fs.readFileSync("app/admin/users/page.tsx", "utf8");
const route = fs.readFileSync("app/api/admin/users/planning/route.ts", "utf8");

const failures = [];

for (const required of [
  "async function readAdminUsersJsonResponse",
  "const text = await response.text();",
  "returned an empty response with status",
  "JSON.parse(text)",
  "returned non-JSON response with status",
]) {
  if (!page.includes(required)) failures.push(`Users page missing defensive JSON handling: ${required}`);
}

if (page.includes(".then((r) => r.json())")) failures.push("Users page still has raw r.json() promise parsing");
if (page.includes(".then((response) => response.json())")) failures.push("Users page still has raw response.json() promise parsing");

for (const required of [
  "try {",
  "catch (error)",
  "Admin users planning lookup failed",
  "return Response.json(",
  "databasePreview: { users: [], roles: [], userCount: 0, roleCount: 0 }",
]) {
  if (!route.includes(required)) failures.push(`Planning route missing JSON error fallback: ${required}`);
}

if (failures.length) {
  console.error("FAIL: Admin Users JSON response handling verifier failed");
  for (const failure of failures) console.error(" - " + failure);
  process.exit(1);
}

console.log("PASS: Admin Users page defensively handles empty/non-JSON API responses and planning route returns JSON on errors.");
