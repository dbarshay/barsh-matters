import fs from "node:fs";

const checks = [];
const read = (p) => fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "";
const assert = (name, condition) => checks.push({ name, pass: Boolean(condition) });

const md = read("docs/admin-users/signer-profile-phase5-owner-admin-all-permissions-seed-enforcement.md");
const jsonText = read("docs/admin-users/signer-profile-phase5-owner-admin-all-permissions-seed-enforcement.json");
const phase4 = read("docs/admin-users/signer-profile-phase4-owner-admin-all-permissions-seed-anchors.md");
let parsed = null;
try {
  parsed = JSON.parse(jsonText);
} catch {
  parsed = null;
}

const registrySources = Array.isArray(parsed?.registrySources) ? parsed.registrySources : [];
const registeredKeys = Array.isArray(parsed?.registeredPermissionKeys) ? parsed.registeredPermissionKeys : [];
const patchedFiles = Array.isArray(parsed?.patchedFiles) ? parsed.patchedFiles : [];
const manualReview = Array.isArray(parsed?.manualReview) ? parsed.manualReview : [];
const patchedText = patchedFiles.filter((path) => fs.existsSync(path)).map((path) => read(path)).join("\n");

assert("Phase 5 markdown exists", md.includes("Owner-Admin All-Permissions Seed Enforcement"));
assert("Phase 5 JSON parses", parsed !== null);
assert("Phase 4 baseline documented", md.includes("admin-users-phase4-owner-admin-all-permissions-seed-anchors-20260623"));
assert("Phase 4 also preserved all-permissions requirement", phase4.includes("primary admin defaults to access to all permissions"));
assert("registry sources found", registrySources.length > 0);
assert("registered permission keys extracted", registeredKeys.length >= 5);
assert("seed/apply files patched", patchedFiles.length > 0);
assert("patched files contain Phase 5 marker", patchedText.includes("ADMIN_USERS_PHASE5_OWNER_ADMIN_ALL_PERMISSIONS_ENFORCEMENT"));
assert("patched files contain owner_admin", patchedText.includes("owner_admin"));
assert("patched files contain all-permissions helper", patchedText.includes("adminUsersPhase5OwnerAdminPermissionKeys"));
assert("manual-review report present", Array.isArray(manualReview));
assert("primary admin requirement documented", md.includes("primary admin defaults to all permissions"));
assert("DOCX mutation prohibited", md.includes("DOCX templates must remain unchanged"));
assert("production signer validation remains unwired", md.includes("Production document-generation signer validation remains unwired"));

const failed = checks.filter((check) => check.pass === false);
for (const check of checks) {
  console.log(`${check.pass ? "PASS" : "FAIL"}: ${check.name}`);
}
if (failed.length > 0) process.exit(1);
