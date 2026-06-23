import fs from "node:fs";

const checks = [];
const read = (p) => fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "";
const assert = (name, condition) => checks.push({ name, pass: Boolean(condition) });

const helper = read("src/lib/auth/admin-user-session-runtime-phase20.ts");
const signout = read("app/api/auth/signout/route.ts");
const stay = read("app/api/auth/stay-signed-in/route.ts");
const adminPage = read("app/admin/page.tsx");
const passwordReset = read("app/api/admin/users/password-reset/route.ts");
const signerRoute = read("app/api/admin/users/signer-profile/route.ts");
const docs = read("docs/admin-users/signer-profile-combined-phase20-session-signout-idle-controls.md");

assert("Combined Phase 20 docs exist", docs.includes("Session, Signout, and Idle Timeout Runtime Controls"));
assert("Combined Phase 19 baseline documented", docs.includes("admin-users-combined-phase19-password-auth-runtime-foundation-20260623"));
assert("session helper exists with marker", helper.includes("ADMIN_USER_SESSION_RUNTIME_PHASE20"));
assert("session helper defines idle timeout", helper.includes("ADMIN_USER_IDLE_TIMEOUT_MINUTES_PHASE20") && helper.includes("ADMIN_USER_IDLE_WARNING_SECONDS_PHASE20"));
assert("session helper detects invalidation", helper.includes("adminUserSessionInvalidatedPhase20") && helper.includes("sessionInvalidatedAt"));
assert("signout route exists", signout.includes("admin-user-signout"));
assert("signout clears cookies", signout.includes("clearAdminSessionCookies") && signout.includes("maxAge: 0"));
assert("signout updates session invalidation", signout.includes("lastSignOutAt") && signout.includes("sessionInvalidatedAt"));
assert("signout audits when authorized", signout.includes("createMatterAuditLogEntry") && signout.includes("admin-user-signout"));
assert("stay signed in route exists", stay.includes("admin-user-stay-signed-in"));
assert("stay signed in requires authorized request", stay.includes("isAdminRequestAuthorized"));
assert("stay signed in does not require password or 2FA", stay.includes("passwordRequired: false") && stay.includes("twoFactorRequired: false"));
assert("admin page has session modal contract", adminPage.includes("data-barsh-admin-session-timeout-modal-contract"));
assert("admin page labels are correct", adminPage.includes("Stay Signed In") && adminPage.includes("Sign Out Now"));
assert("admin page references signout and stay routes", adminPage.includes("/api/auth/signout") && adminPage.includes("/api/auth/stay-signed-in"));
assert("password reset generated temp behavior preserved", passwordReset.includes("generateTemporaryPassword") && passwordReset.includes("temporaryPasswordOneTimeDisplay"));
assert("signer-profile route still separate from session controls", signerRoute.includes("admin-user-signer-profile-update") && signerRoute.includes("sessionInvalidatedAt") === false);
assert("docs prohibit 2FA mutation", docs.includes("Does not change 2FA behavior"));
assert("docs prohibit DOCX mutation", docs.includes("Does not change DOCX templates"));
assert("docs prohibit document generation mutation", docs.includes("Does not change document-generation behavior"));

const failed = checks.filter((check) => check.pass === false);
for (const check of checks) {
  console.log(`${check.pass ? "PASS" : "FAIL"}: ${check.name}`);
}
if (failed.length > 0) process.exit(1);
