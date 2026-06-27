import fs from "node:fs";

const route = fs.readFileSync("app/api/admin/users/card-grants/route.ts", "utf8");
const session = fs.readFileSync("app/api/auth/session/route.ts", "utf8");
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));

const failures = [];
function must(ok, message) {
  if (ok) console.log("PASS:", message);
  else {
    console.error("FAIL:", message);
    failures.push(message);
  }
}

console.log("RUN: verify card-grants audit call");

must(route.includes('await createMatterAuditLogEntry({'), "card-grants route passes audit payload as first argument");
must(route.includes('}, tx);'), "card-grants route passes transaction as second audit argument");
must(!route.includes('await createMatterAuditLogEntry(tx, {'), "card-grants route no longer passes tx as first audit argument");
must(route.includes('action: "admin-user-card-grants"'), "audit payload includes action");
must(route.includes('summary: `Updated Administrator Admin-card grants'), "audit payload includes summary");
must(route.includes('entityType: "admin_user_permission_override"'), "audit payload includes entity type");
must(route.includes('changedBy: actorEmail'), "audit payload includes changedBy");
must(route.includes('adminUserPermissionOverride.upsert'), "card-grants persistence remains present");
must(route.includes('runtimeEnforcementChanged: false'), "runtime enforcement remains unchanged");
must(session.includes('permissionsMode: "default-admin-allow-all"'), "session remains default-admin-allow-all");
must(pkg.scripts?.["verify:admin-users-card-grants-audit-call"] === "node scripts/verify-admin-users-card-grants-audit-call.mjs", "package verifier script registered");

if (failures.length) {
  console.error("");
  console.error("FAILURES=" + failures.length);
  process.exit(1);
}

console.log("FAILURES=0");
console.log("PASS: card-grants audit call is fixed.");
