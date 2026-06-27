import fs from "node:fs";

const failures = [];
const read = (path) => fs.readFileSync(path, "utf8");
const has = (text, token) => text.includes(token);
const must = (ok, message) => {
  if (ok) console.log("PASS:", message);
  else {
    console.error("FAIL:", message);
    failures.push(message);
  }
};

const schema = read("prisma/schema.prisma");
const report = JSON.parse(read("docs/admin-users/admin-users-phase-v4a-card-grant-schema-inspection.json"));
const roleModel = read("src/lib/admin-users/admin-users-final-role-model-phase-v1.ts");
const planning = read("app/api/admin/users/planning/route.ts");
const session = read("app/api/auth/session/route.ts");
const pkg = JSON.parse(read("package.json"));

console.log("RUN: Admin Users Phase V4A card-grant schema inspection verifier");

for (const modelName of ["AdminUser", "AdminRole", "AdminRolePermission", "AdminUserRole", "AdminUserPermissionOverride"]) {
  must(has(schema, `model ${modelName} {`), `Prisma model exists: ${modelName}`);
  must(report.inspectedModels[modelName] === true, `inspection report confirms model: ${modelName}`);
}

for (const key of [
  "admin.card.usersRoles",
  "admin.card.permissionsReview",
  "admin.card.auditHistory",
  "admin.card.documentTemplates",
  "admin.card.referenceData",
  "admin.card.claimIndex",
  "admin.card.ticklers",
  "admin.card.clientsBilling",
  "admin.card.backupRestore",
  "admin.card.readinessDashboard",
  "admin.card.documentReadiness",
  "admin.card.lawsuitCleanup",
]) {
  must(has(roleModel, key), `role model includes admin card grant key: ${key}`);
  must(report.adminCardGrantKeys.includes(key), `inspection report includes admin card grant key: ${key}`);
}

must(has(planning, "finalRoleModel"), "planning route still exposes finalRoleModel");
must(has(session, 'permissionsMode: "default-admin-allow-all"'), "session remains default-admin-allow-all");
must(report.runtimeEnforcementChanged === false, "report says runtime enforcement unchanged");
must(report.databaseMutated === false, "report says database not mutated");
must(report.sessionBehaviorChanged === false, "report says session unchanged");
must(pkg.scripts?.["verify:admin-users-workflow-phase-v4a-card-grant-schema-inspection"] === "node scripts/verify-admin-users-workflow-phase-v4a-card-grant-schema-inspection.mjs", "package verifier script registered");

if (failures.length) {
  console.error("");
  console.error("FAILURES=" + failures.length);
  process.exit(1);
}

console.log("FAILURES=0");
console.log("PASS: Admin Users Phase V4A card-grant schema inspection is verifier-locked.");
