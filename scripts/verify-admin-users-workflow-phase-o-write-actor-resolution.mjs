import fs from "node:fs";

const page = fs.readFileSync("app/admin/users/page.tsx", "utf8");
const route = fs.readFileSync("app/api/admin/users/signer-profile/route.ts", "utf8");
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const failures = [];
const must = (condition, message) => { if (!condition) failures.push(message); };

for (const token of [
  "function adminUsersWriteActorEmail",
  "dbUsers.find",
  "user?.status === \"active\"",
  "user?.locked !== true",
  "user?.inactive !== true",
  "user.roleKeys.includes(\"owner_admin\")",
  "String(activeOwner?.email || createActorEmail || \"\").trim().toLowerCase()",
  "actorEmail: adminUsersWriteActorEmail()",
  "startTwoFactorSetupFromPanel",
  "saveEditAdminUserPanel",
]) must(page.includes(token), "missing write actor resolution token: " + token);

must(!page.includes("actorEmail: createActorEmail"), "write payloads must not use stale createActorEmail directly.");

for (const routeToken of [
  "requireOwnerAdminActor(actorEmail)",
  "Only an active owner_admin user may edit admin signer profiles",
]) must(route.includes(routeToken), "signer-profile route must still enforce owner_admin actor: " + routeToken);

must(pkg.scripts?.["verify:admin-users-workflow-phase-o-write-actor-resolution"] === "node scripts/verify-admin-users-workflow-phase-o-write-actor-resolution.mjs", "package script missing");

if (failures.length) {
  console.error("FAIL: Admin Users Workflow Phase O write actor resolution verifier failed");
  for (const failure of failures) console.error(" - " + failure);
  process.exit(1);
}

console.log("PASS: Admin Users Workflow Phase O write actor resolution locked.");
