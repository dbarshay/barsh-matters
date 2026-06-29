import fs from "node:fs";

const api = fs.readFileSync("app/api/admin/users/planning/route.ts", "utf8");
const permissionsPage = fs.readFileSync("app/admin/permissions/page.tsx", "utf8");
const failures = [];

for (const required of [
  "effectivePermissionKeys",
  "effectivePermissionCount",
  "rolePermissionCount",
  "explicitBlocks",
  "explicitAllows",
  "databasePreview",
  "role: { include: { permissions: true } }",
]) {
  if (!api.includes(required)) failures.push("API missing effective permissions read-only fragment: " + required);
}

for (const required of [
  "fetch(\"/api/admin/users/planning\"",
  "selectedUserEffectiveKeys",
  "selectedUserMatrixAllowedKeys",
  "selectedUserEffectiveOnlyKeys",
  "selectedUserMatrixOnlyKeys",
  "selectedUserMismatchCount",
  "runtime-still-read-only",
  "Runtime enforcement remains unchanged",
  "runtimeEnforcementChanged: false",
  "Do not enable runtime enforcement",
]) {
  if (!permissionsPage.includes(required)) failures.push("permissions page missing effective permissions read-only fragment: " + required);
}

for (const forbidden of [
  ".create(",
  ".update(",
  ".delete(",
  ".upsert(",
  ".createMany(",
  ".updateMany(",
  ".deleteMany(",
  "BARSH_ADMIN_PERMISSIONS_ENFORCEMENT=1",
  "process.env.BARSH_ADMIN_PERMISSIONS_ENFORCEMENT =",
]) {
  if (api.includes(forbidden)) failures.push("effective permissions planning API must remain read-only/no-enforcement; found forbidden fragment: " + forbidden);
}

for (const forbidden of [
  "BARSH_ADMIN_PERMISSIONS_ENFORCEMENT=1",
  "process.env.BARSH_ADMIN_PERMISSIONS_ENFORCEMENT =",
]) {
  if (permissionsPage.includes(forbidden)) failures.push("permissions page must not enable runtime enforcement; found forbidden fragment: " + forbidden);
}

console.log("RESULT: admin users effective permissions read-only safety verifier");
if (failures.length) {
  console.log("FAILURES=" + failures.length);
  for (const failure of failures) console.log("FAIL=" + failure);
  process.exit(1);
}
console.log("FAILURES=0");
console.log("PASS: admin users planning API and permissions page show DB-backed effective permissions preview while runtime enforcement remains read-only/unchanged.");
