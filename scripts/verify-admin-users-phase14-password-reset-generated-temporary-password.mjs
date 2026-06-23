import fs from "node:fs";

const checks = [];
const read = (p) => fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "";
const assert = (name, condition) => checks.push({ name, pass: Boolean(condition) });

const route = read("app/api/admin/users/password-reset/route.ts");
const docs = read("docs/admin-users/signer-profile-phase14-password-reset-generated-temporary-password.md");
const passwordLib = read("src/lib/auth/admin-user-password-security-phase1.ts");
const signerRoute = read("app/api/admin/users/signer-profile/route.ts");

assert("Phase 14 docs exist", docs.includes("Password Reset Generated Temporary Password Alignment"));
assert("Phase 13 baseline documented", docs.includes("admin-users-phase13-password-reset-route-safety-20260623"));
assert("route imports Phase 1 password helpers", route.includes("generateTemporaryPassword") && route.includes("hashPasswordForPhase1") && route.includes("validatePasswordPolicy"));
assert("route uses password history last-3 helper", route.includes("passwordReusesLastThree") && route.includes("updatePasswordHistory"));
assert("route generates temporary password server-side", route.includes("let temporaryPassword = generateTemporaryPassword()"));
assert("route does not accept owner-supplied temporary password", route.includes("body.temporaryPassword") === false);
assert("route returns temporary password only on apply", route.includes("temporaryPasswordOneTimeDisplay") && route.includes("Preview only. Temporary password is generated only when Apply is submitted"));
assert("route stores hash and not plaintext", route.includes("passwordHash") && route.includes("temporaryPasswordStored: false"));
assert("route forces password change", route.includes("forcePasswordChange: true") && route.includes("passwordChangeRequired: true"));
assert("route updates password history", route.includes("passwordHistoryJson") && route.includes("passwordHistoryUpdated: true"));
assert("route resets failed login lockout", route.includes("failedLoginCount: 0") && route.includes("failedLoginLockedAt: null"));
assert("route is owner_admin gated", route.includes("owner_admin") && route.includes("requireOwnerAdminActor"));
assert("audit avoids temporary password value", route.includes("passwordExposedInAudit: false") && route.includes("temporaryPasswordReturnedOnlyOnce: true"));
assert("Phase 1 password library policy exists", passwordLib.includes("PASSWORD_HISTORY_LIMIT = 3") && passwordLib.includes("validatePasswordPolicy"));
assert("signer-profile route remains separate", signerRoute.includes("admin-user-signer-profile-update") && signerRoute.includes("passwordHash") === false);
assert("docs prohibit document generation wiring", docs.includes("Does not wire production document-generation signer validation"));
assert("docs prohibit DOCX mutation", docs.includes("Does not change DOCX templates"));

const failed = checks.filter((check) => check.pass === false);
for (const check of checks) {
  console.log(`${check.pass ? "PASS" : "FAIL"}: ${check.name}`);
}
if (failed.length > 0) process.exit(1);
