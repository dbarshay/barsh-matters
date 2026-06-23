import fs from "node:fs";

const checks = [];
const read = (p) => fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "";
const exists = (p) => fs.existsSync(p);
const assert = (name, condition) => checks.push({ name, pass: Boolean(condition) });

const docs = read("docs/admin-users/signer-profile-combined-phase21-2fa-final-readiness.md");
const twoFactorHelper = read("src/lib/auth/admin-user-two-factor-runtime-phase21.ts");
const challengeRoute = read("app/api/auth/2fa/challenge/route.ts");
const verifyRoute = read("app/api/auth/2fa/verify/route.ts");
const loginRoute = read("app/api/auth/login/route.ts");
const sessionRoute = read("app/api/auth/session/route.ts");
const loginPage = read("app/login/page.tsx");
const passwordReset = read("app/api/admin/users/password-reset/route.ts");
const signerRoute = read("app/api/admin/users/signer-profile/route.ts");
const phase19 = read("scripts/verify-admin-users-combined-phase19-password-auth-runtime-foundation.mjs");
const phase20 = read("scripts/verify-admin-users-combined-phase20-session-signout-idle-controls.mjs");
const schema = read("prisma/schema.prisma");

assert("Combined Phase 21 docs exist", docs.includes("2FA Guards and Final Integrated Readiness"));
assert("Combined Phase 20 baseline documented", docs.includes("admin-users-combined-phase20-session-signout-idle-controls-20260623"));
assert("2FA helper exists with marker", twoFactorHelper.includes("ADMIN_USER_TWO_FACTOR_RUNTIME_PHASE21"));
assert("2FA helper decides required/bypass", twoFactorHelper.includes("adminUserTwoFactorRequiredPhase21") && twoFactorHelper.includes("twoFactorDisabled"));
assert("2FA helper hashes code", twoFactorHelper.includes("hashTwoFactorCodePhase21") && twoFactorHelper.includes("sha256"));
assert("2FA helper supports expiry and attempt lockout", twoFactorHelper.includes("twoFactorChallengeExpiredPhase21") && twoFactorHelper.includes("twoFactorChallengeLockedPhase21"));
assert("2FA challenge route exists", challengeRoute.includes("admin-user-2fa-challenge"));
assert("2FA challenge route stores hash not code", challengeRoute.includes("twoFactorChallengeHash") && challengeRoute.includes("codeReturned: false"));
assert("2FA challenge route audits no plaintext", challengeRoute.includes("codeStoredPlaintext: false"));
assert("2FA verify route exists", verifyRoute.includes("admin-user-2fa-verify"));
assert("2FA verify route clears challenge", verifyRoute.includes("buildTwoFactorChallengeClearDataPhase21"));
assert("2FA verify route tracks failed attempts", verifyRoute.includes("buildTwoFactorFailedAttemptDataPhase21"));
assert("2FA verify route audits no plaintext", verifyRoute.includes("codeStoredPlaintext: false"));
assert("login route has 2FA anchors", loginRoute.includes("ADMIN_USER_TWO_FACTOR_RUNTIME_PHASE21"));
assert("session route has 2FA anchors", sessionRoute.includes("ADMIN_USER_TWO_FACTOR_RUNTIME_PHASE21"));
assert("login page has 2FA anchors", loginPage.includes("ADMIN_USER_TWO_FACTOR_RUNTIME_PHASE21"));
assert("schema has 2FA fields", schema.includes("twoFactorPhone") && schema.includes("twoFactorDisabled") && schema.includes("twoFactorChallengeHash"));
assert("Phase 19 verifier preserved", phase19.includes("Password Auth Runtime Foundation"));
assert("Phase 20 verifier preserved", phase20.includes("Session, Signout, and Idle Timeout Runtime Controls"));
assert("password reset generated temp behavior preserved", passwordReset.includes("generateTemporaryPassword") && passwordReset.includes("temporaryPasswordOneTimeDisplay"));
assert("signer-profile route remains separate", signerRoute.includes("admin-user-signer-profile-update") && signerRoute.includes("twoFactorChallengeHash") === false);
assert("docs mention external SMS pending", docs.includes("External SMS delivery remains a pending integration"));
assert("docs prohibit DOCX mutation", docs.includes("Does not change DOCX templates"));
assert("docs prohibit document generation mutation", docs.includes("Does not change document-generation behavior"));

const requiredFiles = [
  "scripts/verify-admin-users-signer-profile-phase1.mjs",
  "scripts/verify-admin-users-password-auth-safety-phase1.mjs",
  "scripts/verify-admin-users-2fa-signout-timeout-phase1.mjs",
  "scripts/verify-admin-users-combined-phase19-password-auth-runtime-foundation.mjs",
  "scripts/verify-admin-users-combined-phase20-session-signout-idle-controls.mjs",
  "scripts/verify-admin-users-combined-phase21-2fa-final-readiness.mjs",
];
for (const file of requiredFiles) {
  assert(`required verifier exists: ${file}`, exists(file));
}

const failed = checks.filter((check) => check.pass === false);
for (const check of checks) {
  console.log(`${check.pass ? "PASS" : "FAIL"}: ${check.name}`);
}
if (failed.length > 0) process.exit(1);
