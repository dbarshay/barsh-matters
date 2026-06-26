import fs from "node:fs";

const page = fs.readFileSync("app/admin/users/page.tsx", "utf8");
const route = fs.readFileSync("app/api/admin/users/signer-profile/route.ts", "utf8");
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const failures = [];
const must = (condition, message) => { if (!condition) failures.push(message); };

for (const token of [
  "function openTwoFactorSetupPanel",
  "function closeTwoFactorSetupPanel",
  "function startTwoFactorSetupFromPanel",
  "data-barsh-admin-users-2fa-setup-panel",
  "data-barsh-admin-users-2fa-setup-phone",
  "data-barsh-admin-users-2fa-setup-start-button",
  "data-barsh-admin-users-2fa-setup-cancel-button",
  "Start 2FA Setup",
  "pending setup only",
  "twoFactorPendingSetup: true",
  "twoFactorDisabled: false",
  "onClick={() => openTwoFactorSetupPanel(user)}",
  "2FA setup started for",
  "data-barsh-admin-users-2fa-setup-reauth-panel",
]) must(page.includes(token), "missing 2FA setup panel token: " + token);

for (const forbidden of [
  "window.prompt(`2FA phone",
  "window.prompt(\"2FA phone",
  "activateTwoFactorFromRow(user",
  "2FA enforced for",
]) must(!page.includes(forbidden), "prompt/direct 2FA enforcement token must not remain: " + forbidden);

for (const token of [
  "Sole bootstrapSafe owner_admin cannot be moved directly into enforced 2FA",
  "soleBootstrapOwnerProtection: true",
  "lockoutProtection: true",
  "payload.twoFactorPendingSetup === false",
]) must(route.includes(token), "missing route sole-owner 2FA guard token: " + token);

const rowButtonIndex = page.indexOf("data-barsh-admin-users-activate-2fa-row-button");
const openIndex = page.indexOf("openTwoFactorSetupPanel(user)", rowButtonIndex);
must(rowButtonIndex >= 0 && openIndex > rowButtonIndex, "Activate 2FA row button must open setup panel.");

const startIndex = page.indexOf("function startTwoFactorSetupFromPanel");
const pendingIndex = page.indexOf("twoFactorPendingSetup: true", startIndex);
const patchIndex = page.indexOf("/api/admin/users/signer-profile", startIndex);
must(startIndex >= 0 && patchIndex > startIndex && pendingIndex > patchIndex, "Start setup must call signer-profile route and only mark pending setup.");

must(pkg.scripts?.["verify:admin-users-workflow-phase-m-2fa-setup-panel"] === "node scripts/verify-admin-users-workflow-phase-m-2fa-setup-panel.mjs", "package script missing");

if (failures.length) {
  console.error("FAIL: Admin Users Workflow Phase M 2FA setup panel verifier failed");
  for (const failure of failures) console.error(" - " + failure);
  process.exit(1);
}

console.log("PASS: Admin Users Workflow Phase M 2FA setup panel locked.");
