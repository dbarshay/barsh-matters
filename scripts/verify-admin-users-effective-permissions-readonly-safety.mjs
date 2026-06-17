import fs from "node:fs";

const api = fs.readFileSync("app/api/admin/users/planning/route.ts", "utf8");
const page = fs.readFileSync("app/admin/users/page.tsx", "utf8");
const failures = [];

for (const required of [
  "effectivePermissionKeys",
  "effectivePermissionCount",
  "rolePermissionCount",
  "explicitBlocks",
  "explicitAllows",
  "databasePreview",
]) {
  if (!api.includes(required)) failures.push("API missing effective permissions read-only fragment: " + required);
}

for (const required of [
  'data-barsh-admin-users-enforcement-banner="disabled"',
  "Enforcement Disabled:",
  'data-barsh-admin-users-effective-permissions="read-only"',
  "Effective Permissions Preview",
  "Enforcement remains disabled.",
]) {
  if (!page.includes(required)) failures.push("page missing effective permissions read-only fragment: " + required);
}

for (const forbidden of [".create(", ".update(", ".delete(", ".upsert(", ".createMany(", ".updateMany(", ".deleteMany(", "BARSH_ADMIN_PERMISSIONS_ENFORCEMENT=1", "process.env.BARSH_ADMIN_PERMISSIONS_ENFORCEMENT ="]) {
  if (api.includes(forbidden) || page.includes(forbidden)) failures.push("effective permissions preview must remain read-only/no-enforcement; found forbidden fragment: " + forbidden);
}

console.log("RESULT: admin users effective permissions read-only safety verifier");
if (failures.length) {
  console.log("FAILURES=" + failures.length);
  for (const failure of failures) console.log("FAIL=" + failure);
  process.exit(1);
}
console.log("FAILURES=0");
console.log("PASS: admin users page/API show DB-backed effective permissions read-only while enforcement remains disabled.");
