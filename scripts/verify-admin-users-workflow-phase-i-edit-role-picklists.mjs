import fs from "node:fs";

const page = fs.readFileSync("app/admin/users/page.tsx", "utf8");
const api = fs.readFileSync("app/api/admin/users/planning/route.ts", "utf8");
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const failures = [];
const must = (condition, message) => { if (!condition) failures.push(message); };

for (const token of [
  "function adminRoleOptions",
  "function roleOptionKey",
  "function roleOptionLabel",
  "function editAssignableRoleOptions",
  "function editRemovableRoleOptions",
  "data-barsh-admin-users-edit-role-assign-picklist=\"true\"",
  "data-barsh-admin-users-edit-role-remove-picklist=\"true\"",
  "No role assignment",
  "No role removal",
  "editAssignableRoleOptions().map",
  "editRemovableRoleOptions().map",
  "setEditRoleToAssign(event.target.value)",
  "setEditRoleToRemove(event.target.value)",
  "Assign role from edit",
  "Remove role from edit",
]) must(page.includes(token), "missing edit role picklist token: " + token);

for (const forbidden of [
  "data-barsh-admin-users-edit-role-assign=\"true\"",
  "data-barsh-admin-users-edit-role-remove=\"true\"",
  "placeholder=\"Optional role key\"",
  "placeholder={`Current: ${roleLabelForUser(editUser)}`}",
]) must(!page.includes(forbidden), "free-text role input must not remain: " + forbidden);

must(page.includes("data?.databasePreview?.roles") || page.includes("data?.roles"), "role picklists must derive from planning data roles.");
must(api.includes("roles") || api.includes("dbRoles"), "planning API must expose roles for picklists.");

const assignSelectIndex = page.indexOf("data-barsh-admin-users-edit-role-assign-picklist");
const assignMapIndex = page.indexOf("editAssignableRoleOptions().map", assignSelectIndex);
const removeSelectIndex = page.indexOf("data-barsh-admin-users-edit-role-remove-picklist");
const removeMapIndex = page.indexOf("editRemovableRoleOptions().map", removeSelectIndex);
must(assignSelectIndex >= 0 && assignMapIndex > assignSelectIndex, "assign role picklist must render assignable role options.");
must(removeSelectIndex >= 0 && removeMapIndex > removeSelectIndex, "remove role picklist must render removable current-role options.");

must(pkg.scripts?.["verify:admin-users-workflow-phase-i-edit-role-picklists"] === "node scripts/verify-admin-users-workflow-phase-i-edit-role-picklists.mjs", "package script missing");

if (failures.length) {
  console.error("FAIL: Admin Users Workflow Phase I edit role picklists verifier failed");
  for (const failure of failures) console.error(" - " + failure);
  process.exit(1);
}

console.log("PASS: Admin Users Workflow Phase I edit role picklists locked.");
