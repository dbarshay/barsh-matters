import fs from "node:fs";

const checks = [];
const read = (p) => fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "";
const assert = (name, condition) => checks.push({ name, pass: Boolean(condition) });

const md = read("docs/admin-users/signer-profile-qa-phase3-post-patch-gap-closure-report.md");
const jsonText = read("docs/admin-users/signer-profile-qa-phase3-post-patch-gap-closure-report.json");
const qa2Verifier = read("scripts/verify-admin-users-qa-phase2-runtime-enforcement-gap-patch.mjs");
let parsed = null;
try {
  parsed = JSON.parse(jsonText);
} catch {
  parsed = null;
}

const closedRuntimeGaps = Array.isArray(parsed?.closedRuntimeGaps) ? parsed.closedRuntimeGaps : [];
const knownDeferred = Array.isArray(parsed?.knownDeferred) ? parsed.knownDeferred : [];

assert("QA Phase 3 markdown exists", md.includes("Post-Patch Runtime Gap Closure Report"));
assert("QA Phase 3 JSON parses", parsed !== null);
assert("QA Phase 2 baseline documented", md.includes("admin-users-qa-phase2-runtime-enforcement-gap-patch-20260623"));
assert("runtime mutation is false", parsed?.runtimeMutation === false);
assert("QA2 verifier is source of truth", parsed?.sourceOfTruth === "scripts/verify-admin-users-qa-phase2-runtime-enforcement-gap-patch.mjs");
assert("QA2 verifier contains forced-password runtime assertions", qa2Verifier.includes("login route has runtime forced-password visibility") && qa2Verifier.includes("login page redirects forced-password users"));
assert("QA2 verifier contains 2FA runtime assertions", qa2Verifier.includes("login route has runtime 2FA visibility") && qa2Verifier.includes("login page has 2FA runtime UX"));
assert("QA2 verifier contains session/admin route assertions", qa2Verifier.includes("session route exposes 2FA runtime fields") && qa2Verifier.includes("admin page uses new signout route"));
assert("no unexpected open gaps", parsed?.unexpectedOpenGapCount === 0);
assert("ready for next workstream", parsed?.readyForNextWorkstream === true);
assert("closed runtime gap list is complete", closedRuntimeGaps.includes("loginRouteForcedPasswordRuntimeEnforcement") && closedRuntimeGaps.includes("loginPageTwoFactorRuntimeUx") && closedRuntimeGaps.includes("adminPageNewSignoutRouteRuntime"));
assert("external SMS remains known deferred", knownDeferred.some((gap) => gap.key === "externalSmsDeliveryImplemented" && gap.severity === "known-deferred"));
assert("docs prohibit DOCX mutation", md.includes("Does not change DOCX templates"));
assert("docs prohibit document-generation signer validation mutation", md.includes("production document-generation signer validation"));

const failed = checks.filter((check) => check.pass === false);
for (const check of checks) {
  console.log(`${check.pass ? "PASS" : "FAIL"}: ${check.name}`);
}
if (failed.length > 0) process.exit(1);
