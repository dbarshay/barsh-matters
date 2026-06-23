import fs from "node:fs";

const checks = [];
const read = (p) => fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "";
const assert = (name, condition) => checks.push({ name, pass: Boolean(condition) });

const md = read("docs/admin-users/signer-profile-phase6-real-create-edit-anchors.md");
const jsonText = read("docs/admin-users/signer-profile-phase6-real-create-edit-anchors.json");
const schema = read("prisma/schema.prisma");
const phase5Apply = read("scripts/apply-admin-user-role-seed.mjs");
const phase5Preview = read("scripts/preview-admin-user-role-seed.mjs");
let parsed = null;
try {
  parsed = JSON.parse(jsonText);
} catch {
  parsed = null;
}

const usersPages = Array.isArray(parsed?.candidateUsersPages) ? parsed.candidateUsersPages : [];
const routes = Array.isArray(parsed?.candidateAdminUserRoutes) ? parsed.candidateAdminUserRoutes : [];
const libs = Array.isArray(parsed?.candidateAdminUserLibs) ? parsed.candidateAdminUserLibs : [];
const requiredSignerFields = Array.isArray(parsed?.requiredSignerCreateEditFields) ? parsed.requiredSignerCreateEditFields : [];
const requiredSecurityFields = Array.isArray(parsed?.requiredSecurityFields) ? parsed.requiredSecurityFields : [];

assert("Phase 6 markdown exists", md.includes("Real Create/Edit Signer-Profile Anchors"));
assert("Phase 6 JSON parses", parsed !== null);
assert("Phase 5 baseline documented", md.includes("admin-users-phase5-owner-admin-all-permissions-seed-enforcement-20260623"));
assert("runtime mutation is false", parsed?.runtimeMutation === false);
assert("required signer fields documented", requiredSignerFields.includes("phoneExtension") && requiredSignerFields.includes("signatureBlockName") && requiredSignerFields.includes("twoFactorPhone"));
assert("required security fields documented", requiredSecurityFields.includes("passwordHash") && requiredSecurityFields.includes("sessionInvalidatedAt"));
assert("Users admin page candidates found", usersPages.length > 0);
assert("Admin user route candidates found", routes.length > 0);
assert("Admin user library candidates captured", Array.isArray(libs));
assert("Phase 1 schema signer fields still present", ["firstName", "lastName", "displayName", "username", "phoneExtension", "faxNumber", "signatureBlockName", "twoFactorPhone"].every((field) => schema.includes(field)));
assert("Phase 1 security fields still present", ["passwordHash", "passwordHistoryJson", "failedLoginCount", "forcePasswordChange", "sessionInvalidatedAt"].every((field) => schema.includes(field)));
assert("Phase 5 owner-admin marker preserved in apply script", phase5Apply.includes("ADMIN_USERS_PHASE5_OWNER_ADMIN_ALL_PERMISSIONS_ENFORCEMENT"));
assert("Phase 5 owner-admin marker preserved in preview script", phase5Preview.includes("ADMIN_USERS_PHASE5_OWNER_ADMIN_ALL_PERMISSIONS_ENFORCEMENT"));
assert("Phase 7 rules preserve owner-admin all-permissions", md.includes("Preserve Phase 5 owner_admin all-permissions behavior"));
assert("DOCX mutation prohibited", md.includes("Do not change DOCX templates"));
assert("production signer validation prohibited", md.includes("Do not wire production document-generation signer validation"));

const failed = checks.filter((check) => check.pass === false);
for (const check of checks) {
  console.log(`${check.pass ? "PASS" : "FAIL"}: ${check.name}`);
}
if (failed.length > 0) process.exit(1);
