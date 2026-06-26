import fs from "node:fs";

const page = fs.readFileSync("app/admin/users/page.tsx", "utf8");
const route = fs.readFileSync("app/api/admin/users/signer-profile/route.ts", "utf8");
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const failures = [];
const must = (condition, message) => { if (!condition) failures.push(message); };

for (const token of [
  "editNeedsReauth",
  "function isAdminUsersAuthExpiredError",
  "function goToAdminUsersReauthentication",
  "status 401",
  "Authenticated administrator session required",
  "Save user blocked: administrator session expired.",
  "data-barsh-admin-users-edit-reauth-panel",
  "data-barsh-admin-users-edit-reauth-button",
  "Re-authenticate",
  "/admin?next=",
  "encodeURIComponent(next)",
]) must(page.includes(token), "missing edit-save reauth token: " + token);

for (const token of [
  "action: \"admin-user-signer-profile-update\"",
  "mode: \"blocked\"",
  "Authenticated administrator session required.",
]) must(route.includes(token), "missing signer-profile auth response token: " + token);

const catchIndex = page.indexOf("isAdminUsersAuthExpiredError(error)");
const needsIndex = page.indexOf("setEditNeedsReauth(true)", catchIndex);
const messageIndex = page.indexOf("setEditMessage(\"Your administrator session expired", catchIndex);
must(catchIndex >= 0 && needsIndex > catchIndex && messageIndex > needsIndex, "save catch must detect 401 and show reauth state without clearing the edit form.");

const panelIndex = page.indexOf("data-barsh-admin-users-edit-reauth-panel");
const buttonIndex = page.indexOf("data-barsh-admin-users-edit-reauth-button", panelIndex);
const goIndex = page.indexOf("onClick={goToAdminUsersReauthentication}", panelIndex);
must(panelIndex >= 0 && buttonIndex > panelIndex && goIndex > panelIndex, "reauth panel must render a reauthenticate button wired to admin gate navigation.");

must(pkg.scripts?.["verify:admin-users-workflow-phase-k-edit-save-reauth"] === "node scripts/verify-admin-users-workflow-phase-k-edit-save-reauth.mjs", "package script missing");

if (failures.length) {
  console.error("FAIL: Admin Users Workflow Phase K edit-save reauth verifier failed");
  for (const failure of failures) console.error(" - " + failure);
  process.exit(1);
}

console.log("PASS: Admin Users Workflow Phase K edit-save reauth flow locked.");
