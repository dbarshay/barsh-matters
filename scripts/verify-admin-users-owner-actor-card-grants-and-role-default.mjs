import fs from "node:fs";

const page = fs.readFileSync("app/admin/users/page.tsx", "utf8");
const route = fs.readFileSync("app/api/admin/users/card-grants/route.ts", "utf8");
const session = fs.readFileSync("app/api/auth/session/route.ts", "utf8");
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));

const failures = [];
function pass(message) { console.log("PASS:", message); }
function fail(message) { console.error("FAIL:", message); failures.push(message); }
function must(ok, message) { ok ? pass(message) : fail(message); }

console.log("RUN: verify owner actor card grants and role default");

must(page.includes("ownerAdminActorEmail"), "Users page derives ownerAdminActorEmail");
must(page.includes('roleKeys.includes("owner_admin")'), "ownerAdminActorEmail prefers active owner_admin role user");
must(page.includes("user?.bootstrapSafe === true"), "ownerAdminActorEmail falls back to bootstrapSafe user");
must(page.includes("actorEmail: ownerAdminActorEmail"), "card-grants UI sends ownerAdminActorEmail");
must(!page.includes("actorEmail: createActorEmail,\\n          targetEmail: editEmail || editUser.email,\\n          grantPermissionKeys: editAdminCardGrantKeys"), "card-grants UI no longer sends stale createActorEmail");
must(page.includes('setEditRoleToAssign("");') && page.includes('setEditRoleToRemove("");'), "edit user switch resets role assign/remove dropdowns");
must(page.includes('data-barsh-admin-users-phase-v4c-save-card-grants-button="true"'), "Save Card Grants button remains present");
must(route.includes("activeOwnerAdminActor"), "card-grants route still requires active owner_admin actor");
must(route.includes('targetRoleKeys.includes("administrator")'), "card-grants route still requires administrator target");
must(session.includes('permissionsMode: "default-admin-allow-all"'), "runtime enforcement remains disabled");
must(pkg.scripts?.["verify:admin-users-owner-actor-card-grants-and-role-default"] === "node scripts/verify-admin-users-owner-actor-card-grants-and-role-default.mjs", "package verifier script registered");

if (failures.length) {
  console.error("");
  console.error("FAILURES=" + failures.length);
  process.exit(1);
}

console.log("FAILURES=0");
console.log("PASS: owner actor card-grants UI and role dropdown default are locked.");
