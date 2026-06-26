import fs from "node:fs";

const page = fs.readFileSync("app/admin/users/page.tsx", "utf8");
const route = fs.readFileSync("app/api/admin/users/signer-profile/route.ts", "utf8");
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const failures = [];
const must = (condition, message) => { if (!condition) failures.push(message); };

for (const token of [
  "data-barsh-admin-users-activate-2fa-row-button",
  "openTwoFactorSetupPanel",
  "startTwoFactorSetupFromPanel",
  "data-barsh-admin-users-2fa-setup-panel",
  "twoFactorPendingSetup: true",
  "2FA setup started for",
  "Complete and verify setup before treating it as enforced.",
  "/api/admin/users/signer-profile",
]) must(page.includes(token), "missing 2FA UI safety token: " + token);

for (const forbidden of [
  "async function activateTwoFactorFromRow",
  "window.prompt(`2FA phone",
  "window.prompt(\"2FA phone",
  "2FA enforced for",
]) must(!page.includes(forbidden), "old prompt/direct-enforcement 2FA flow must not remain: " + forbidden);

for (const token of [
  "activeBootstrapOwnerAdminCount",
  "targetIsSoleBootstrapOwner",
  "existing.bootstrapSafe === true",
  "existing.status === \"active\"",
  "existing.locked === false",
  "existing.inactive === false",
  "payload.twoFactorDisabled === false",
  "payload.twoFactorPendingSetup === false",
  "Boolean(payload.twoFactorPhone)",
  "Sole bootstrapSafe owner_admin cannot be moved directly into enforced 2FA",
  "soleBootstrapOwnerProtection: true",
  "lockoutProtection: true",
  "bootstrapSafe: true",
]) must(route.includes(token), "missing route 2FA sole-owner safety token: " + token);

const guardIndex = route.indexOf("targetIsSoleBootstrapOwner");
const blockIndex = route.indexOf("Sole bootstrapSafe owner_admin cannot be moved directly into enforced 2FA", guardIndex);
const updateIndex = route.indexOf("prisma.adminUser.update", guardIndex);
must(guardIndex >= 0 && blockIndex > guardIndex && updateIndex > blockIndex, "sole-owner 2FA enforcement guard must run before AdminUser update.");

const setupIndex = page.indexOf("function startTwoFactorSetupFromPanel");
const pendingIndex = page.indexOf("twoFactorPendingSetup: true", setupIndex);
const disabledIndex = page.indexOf("twoFactorDisabled: false", setupIndex);
must(setupIndex >= 0 && disabledIndex > setupIndex && pendingIndex > disabledIndex, "Start 2FA setup must set disabled false but keep setup pending.");

must(pkg.scripts?.["verify:admin-users-workflow-phase-l-2fa-owner-safety"] === "node scripts/verify-admin-users-workflow-phase-l-2fa-owner-safety.mjs", "package script missing");

if (failures.length) {
  console.error("FAIL: Admin Users Workflow Phase L 2FA owner safety verifier failed");
  for (const failure of failures) console.error(" - " + failure);
  process.exit(1);
}

console.log("PASS: Admin Users Workflow Phase L 2FA owner safety locked.");
