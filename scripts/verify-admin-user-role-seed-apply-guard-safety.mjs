import fs from "node:fs";

const script = fs.readFileSync("scripts/apply-admin-user-role-seed.mjs", "utf8");
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const failures = [];

for (const required of [
  "--apply-admin-user-role-seed",
  "dry-run-refused",
  "guarded-apply",
  "No records were written",
  "changesEnforcement: false",
  "buildSeedSql",
  "INSERT INTO \"AdminRole\"",
  "INSERT INTO \"AdminRolePermission\"",
  "INSERT INTO \"AdminUser\"",
  "INSERT INTO \"AdminUserRole\"",
  "ON CONFLICT",
  "prisma\", \"db\", \"execute\"",
]) {
  if (!script.includes(required)) failures.push("guarded seed apply script missing required fragment: " + required);
}

for (const forbidden of [
  "import { prisma }",
  "from \"../lib/prisma.ts\"",
  "new PrismaClient",
  "BARSH_ADMIN_PERMISSIONS_ENFORCEMENT=1",
  "process.env.BARSH_ADMIN_PERMISSIONS_ENFORCEMENT",
  "AdminUserPermissionOverride",
  "DELETE FROM",
  "DROP TABLE",
  "TRUNCATE",
  "migrate deploy",
]) {
  if (script.includes(forbidden)) failures.push("guarded seed apply script contains forbidden fragment: " + forbidden);
}

if (pkg.scripts?.["apply:admin-user-role-seed"] !== "node scripts/apply-admin-user-role-seed.mjs") failures.push("package.json missing guarded dry-run apply script");
if (pkg.scripts?.["verify:admin-user-role-seed-apply-guard-safety"] !== "node scripts/verify-admin-user-role-seed-apply-guard-safety.mjs") failures.push("package.json missing verify:admin-user-role-seed-apply-guard-safety script");

console.log("RESULT: admin user/role guarded seed apply safety verifier");
if (failures.length) {
  console.log("FAILURES=" + failures.length);
  for (const failure of failures) console.log("FAIL=" + failure);
  process.exit(1);
}
console.log("FAILURES=0");
console.log("PASS: admin user/role seed apply script is guarded, refuses writes by default, uses reviewed SQL execution only with explicit flag, and does not enable enforcement.");
