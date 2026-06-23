import fs from "node:fs";

const checks = [];
const read = (p) => fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "";
const assert = (name, condition) => checks.push({ name, pass: Boolean(condition) });

const md = read("docs/admin-users/signer-profile-phase17-forced-password-change-auth-anchors.md");
const jsonText = read("docs/admin-users/signer-profile-phase17-forced-password-change-auth-anchors.json");
const passwordRoute = read("app/api/admin/users/password-reset/route.ts");
const passwordLib = read("src/lib/auth/admin-user-password-security-phase1.ts");
const schema = read("prisma/schema.prisma");
let parsed = null;
try {
  parsed = JSON.parse(jsonText);
} catch {
  parsed = null;
}

const loginCandidates = Array.isArray(parsed?.loginCandidates) ? parsed.loginCandidates : [];
const sessionCandidates = Array.isArray(parsed?.sessionCandidates) ? parsed.sessionCandidates : [];
const passwordCandidates = Array.isArray(parsed?.passwordCandidates) ? parsed.passwordCandidates : [];

assert("Phase 17 markdown exists", md.includes("Forced Password-Change Auth Flow Anchors"));
assert("Phase 17 JSON parses", parsed !== null);
assert("Phase 16 baseline documented", md.includes("admin-users-phase16-password-reset-one-time-modal-ui-20260623"));
assert("runtime mutation is false", parsed?.runtimeMutation === false);
assert("login candidates found", loginCandidates.length > 0);
assert("session/auth candidates found", sessionCandidates.length > 0);
assert("password candidates found", passwordCandidates.length > 0);
assert("password reset sets force change", passwordRoute.includes("forcePasswordChange: true") && passwordRoute.includes("passwordChangeRequired: true"));
assert("password policy/history helpers present", passwordLib.includes("validatePasswordPolicy") && passwordLib.includes("passwordReusesLastThree") && passwordLib.includes("updatePasswordHistory"));
assert("schema has force-change fields", schema.includes("forcePasswordChange") && schema.includes("passwordChangeRequired"));
assert("Phase 18 rules require current/temp password", md.includes("temporary/current password"));
assert("Phase 18 rules require last-3 history", md.includes("last 3 passwords"));
assert("Phase 18 rules require audit without plaintext", md.includes("audit without plaintext password logging"));
assert("Phase 18 rules preserve password reset behavior", md.includes("Do not alter password reset generated-temp behavior"));
assert("Phase 18 rules prohibit DOCX mutation", md.includes("DOCX templates"));
assert("Phase 18 rules prohibit document generation changes", md.includes("document-generation behavior"));

const failed = checks.filter((check) => check.pass === false);
for (const check of checks) {
  console.log(`${check.pass ? "PASS" : "FAIL"}: ${check.name}`);
}
if (failed.length > 0) process.exit(1);
