import fs from "node:fs";

const page = fs.readFileSync("app/admin/users/page.tsx", "utf8");
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const failures = [];
const must = (condition, message) => { if (!condition) failures.push(message); };

for (const token of [
  "data-barsh-admin-users-browser-back-action-history=\"true\"",
  "function pushAdminUsersActionHistory",
  "window.history.pushState",
  "barshAdminUsersAction",
  "popstate",
  "closeAdminUsersTransientActionState",
  "window.addEventListener(\"popstate\"",
  "window.removeEventListener(\"popstate\"",
  "setAdminUsersAction(\"none\")",
  "setEditUser(null)",
  "setPasswordResetOneTimePassword(\"\")",
  "pushAdminUsersActionHistory(\"create-user\")",
  "pushAdminUsersActionHistory(\"edit-user\")",
  "pushAdminUsersActionHistory(\"password-reset-one-time\")",
]) must(page.includes(token), "missing browser-back action token: " + token);

const createIndex = page.indexOf("function openCreateUserAction");
must(createIndex >= 0 && page.indexOf("pushAdminUsersActionHistory(\"create-user\")", createIndex) > createIndex, "Create User must push same-page history before opening.");

const editIndex = page.indexOf("function openEditAdminUserPanel");
must(editIndex >= 0 && page.indexOf("pushAdminUsersActionHistory(\"edit-user\")", editIndex) > editIndex, "Edit User must push same-page history before opening.");

const resetIndex = page.indexOf("setPasswordResetOneTimePassword(String(json.temporaryPassword))");
must(resetIndex >= 0 && page.lastIndexOf("pushAdminUsersActionHistory(\"password-reset-one-time\")", resetIndex) > 0, "One-time password modal must push same-page history before opening.");

for (const forbidden of ["window.location.href = \"/admin/users\"", "router.back()", "history.back()"]) {
  must(!page.includes(forbidden), "browser-back action repair must not force navigation: " + forbidden);
}

must(pkg.scripts?.["verify:admin-users-workflow-phase-d-browser-back-actions"] === "node scripts/verify-admin-users-workflow-phase-d-browser-back-actions.mjs", "package script missing");

if (failures.length) {
  console.error("FAIL: Admin Users Workflow Phase D browser-back verifier failed");
  for (const failure of failures) console.error(" - " + failure);
  process.exit(1);
}

console.log("PASS: Admin Users Workflow Phase D browser-back action state locked.");
