import fs from "node:fs";

const page = fs.readFileSync("app/admin/users/page.tsx", "utf8");
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const failures = [];
const must = (condition, message) => { if (!condition) failures.push(message); };

for (const token of [
  "data-barsh-admin-users-2fa-setup-panel",
  "data-barsh-admin-users-2fa-setup-phone=\"true\"",
  "value={twoFactorSetupPhone}",
  "onChange={(event) => setTwoFactorSetupPhone(event.target.value)}",
  "placeholder=\"Expected format: (631) 555-1234\"",
  "inputMode=\"tel\"",
  "autoComplete=\"tel\"",
  "Start 2FA Setup",
  "pending setup only",
]) must(page.includes(token), "missing 2FA phone format token: " + token);

for (const forbidden of [
  "onChange={(event)  placeholder=",
  " /> setTwoFactorSetupPhone",
  "placeholder=\"Mobile number for 2FA\"",
  "window.prompt(`2FA phone",
  "window.prompt(\"2FA phone",
  "activateTwoFactorFromRow(user",
  "2FA enforced for",
]) must(!page.includes(forbidden), "stale or malformed 2FA token must not remain: " + forbidden);

must(pkg.scripts?.["verify:admin-users-workflow-phase-n-2fa-phone-format"] === "node scripts/verify-admin-users-workflow-phase-n-2fa-phone-format.mjs", "package script missing");

if (failures.length) {
  console.error("FAIL: Admin Users Workflow Phase N 2FA phone format verifier failed");
  for (const failure of failures) console.error(" - " + failure);
  process.exit(1);
}

console.log("PASS: Admin Users Workflow Phase N 2FA phone format hint locked.");
