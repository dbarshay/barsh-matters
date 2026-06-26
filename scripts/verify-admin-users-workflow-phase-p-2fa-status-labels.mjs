import fs from "node:fs";

const page = fs.readFileSync("app/admin/users/page.tsx", "utf8");
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const failures = [];
const must = (condition, message) => { if (!condition) failures.push(message); };

for (const token of [
  "function twoFactorSetupPendingForUser",
  "user?.twoFactorPendingSetup === true",
  "user?.twoFactorPendingSetup !== true",
  "const twoFactorSetupPending = twoFactorSetupPendingForUser(user)",
  "data-barsh-admin-users-2fa-pending-label",
  "2FA Setup Pending",
  "data-barsh-admin-users-2fa-enforced-label",
  "2FA Enforced",
  "data-barsh-admin-users-activate-2fa-row-button",
]) must(page.includes(token), "missing 2FA status label token: " + token);

const pendingHelper = page.indexOf("function twoFactorSetupPendingForUser");
const enforcedHelper = page.indexOf("function twoFactorEnforcedForUser");
must(pendingHelper >= 0 && enforcedHelper > pendingHelper, "pending helper must be defined before enforced helper.");

const renderIndex = page.indexOf("data-barsh-admin-users-2fa-pending-label");
const enforcedIndex = page.indexOf("data-barsh-admin-users-2fa-enforced-label", renderIndex);
const activateIndex = page.indexOf("data-barsh-admin-users-activate-2fa-row-button", renderIndex);
must(renderIndex >= 0 && enforcedIndex > renderIndex && activateIndex > enforcedIndex, "row rendering must prefer pending, then enforced, then activate button.");

must(pkg.scripts?.["verify:admin-users-workflow-phase-p-2fa-status-labels"] === "node scripts/verify-admin-users-workflow-phase-p-2fa-status-labels.mjs", "package script missing");

if (failures.length) {
  console.error("FAIL: Admin Users Workflow Phase P 2FA status labels verifier failed");
  for (const failure of failures) console.error(" - " + failure);
  process.exit(1);
}

console.log("PASS: Admin Users Workflow Phase P 2FA pending/enforced labels locked.");
