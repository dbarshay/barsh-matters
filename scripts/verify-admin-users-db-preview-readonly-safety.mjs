import fs from "node:fs";

const api = fs.readFileSync("app/api/admin/users/planning/route.ts", "utf8");
const page = fs.readFileSync("app/admin/users/page.tsx", "utf8");
const failures = [];

for (const required of [
  'import { prisma } from "@/lib/prisma"',
  "prisma.adminUser.findMany",
  "prisma.adminRole.findMany",
  "prisma.adminRolePermission.count",
  "prisma.adminUserRole.count",
  "prisma.adminUserPermissionOverride.count",
  'mode: "db-preview-plus-planning"',
  "databasePreview",
  "reads DB-backed admin user/role tables for preview only",
  "does not create users, edit roles, assign permissions",
]) {
  if (!api.includes(required)) failures.push("planning API missing DB preview fragment: " + required);
}

for (const required of [
  'data-barsh-admin-users-db-preview="read-only"',
  "Database-Backed Preview",
  "No persisted admin users yet.",
  "No persisted admin roles yet.",
  "These records are not used for enforcement yet.",
]) {
  if (!page.includes(required)) failures.push("planning page missing DB preview fragment: " + required);
}

for (const forbidden of ["prisma.adminUser.create", "prisma.adminUser.update", "prisma.adminUser.delete", "prisma.adminRole.create", "prisma.adminRole.update", "prisma.adminRole.delete", "POST", "PATCH", "PUT", "DELETE"]) {
  if (api.includes(forbidden) || page.includes(forbidden)) failures.push("DB preview must remain read-only; found forbidden fragment: " + forbidden);
}

console.log("RESULT: admin users DB preview read-only safety verifier");
if (failures.length) {
  console.log("FAILURES=" + failures.length);
  for (const failure of failures) console.log("FAIL=" + failure);
  process.exit(1);
}
console.log("FAILURES=0");
console.log("PASS: admin users page/API read persisted admin user-role tables for preview only, without write controls or enforcement wiring.");
