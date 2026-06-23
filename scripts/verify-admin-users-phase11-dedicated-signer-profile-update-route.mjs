import fs from "node:fs";

const checks = [];
const read = (p) => fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "";
const assert = (name, condition) => checks.push({ name, pass: Boolean(condition) });

const route = read("app/api/admin/users/signer-profile/route.ts");
const docs = read("docs/admin-users/signer-profile-phase11-dedicated-update-route.md");
const phase10 = read("docs/admin-users/signer-profile-phase10-create-user-api-signer-profile-wiring.md");
const phase5Apply = read("scripts/apply-admin-user-role-seed.mjs");
const phase5Preview = read("scripts/preview-admin-user-role-seed.mjs");

const requiredFields = ["firstName", "lastName", "displayName", "username", "emailNormalized", "usernameNormalized", "phoneExtension", "faxNumber", "signatureBlockName", "locked", "inactive", "twoFactorPhone", "twoFactorDisabled", "twoFactorPendingSetup"];

assert("Phase 11 route exists", route.includes("export async function PATCH"));
assert("Phase 11 docs exist", docs.includes("Dedicated Signer-Profile Update Route"));
assert("Phase 10 baseline documented", docs.includes("admin-users-phase10-create-user-api-signer-profile-wiring-20260623"));
assert("route uses Phase 7 payload contract", route.includes("buildAdminUserSignerProfileWritePayloadPhase7"));
assert("route uses changed-field helper for audit", route.includes("getAdminUserSignerProfileChangedFieldsPhase7"));
assert("route requires owner_admin actor", route.includes("owner_admin") && route.includes("requireOwnerAdminActor"));
assert("route supports preview mode", route.includes("previewOnly") && route.includes("apply"));
assert("route writes required signer/profile fields", requiredFields.every((field) => route.includes(field)));
assert("route has case-insensitive duplicate guards", route.includes("emailNormalized") && route.includes("usernameNormalized") && route.includes("id: { not: userId }"));
assert("route writes audit log", route.includes("createMatterAuditLogEntry") && route.includes("admin-user-signer-profile-update"));
assert("route does not implement password reset", route.includes("reset password") === false && route.includes("passwordHash") === false);
assert("route does not use lockout route", docs.includes("Does not use lockout"));
assert("Phase 10 create wiring preserved", phase10.includes("Create-User API Signer/Profile Field Wiring"));
assert("Phase 5 owner-admin marker preserved in apply script", phase5Apply.includes("ADMIN_USERS_PHASE5_OWNER_ADMIN_ALL_PERMISSIONS_ENFORCEMENT"));
assert("Phase 5 owner-admin marker preserved in preview script", phase5Preview.includes("ADMIN_USERS_PHASE5_OWNER_ADMIN_ALL_PERMISSIONS_ENFORCEMENT"));
assert("docs prohibit document-generation signer validation", docs.includes("Does not wire production document-generation signer validation"));
assert("docs prohibit DOCX mutation", docs.includes("Does not change DOCX templates"));

const failed = checks.filter((check) => check.pass === false);
for (const check of checks) {
  console.log(`${check.pass ? "PASS" : "FAIL"}: ${check.name}`);
}
if (failed.length > 0) process.exit(1);
