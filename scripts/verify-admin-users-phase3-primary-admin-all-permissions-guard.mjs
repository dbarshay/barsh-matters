import fs from "node:fs";

const checks = [];
const read = (p) => fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "";
const assert = (name, condition) => checks.push({ name, pass: Boolean(condition) });

const md = read("docs/admin-users/signer-profile-phase3-primary-admin-all-permissions-guard.md");
const jsonText = read("docs/admin-users/signer-profile-phase3-primary-admin-all-permissions-guard.json");
const phase2 = read("docs/admin-users/signer-profile-phase2-real-wiring-map.md");
const schema = read("prisma/schema.prisma");

let parsed = null;
try {
  parsed = JSON.parse(jsonText);
} catch {
  parsed = null;
}

const candidatePermissionFiles = Array.isArray(parsed?.candidatePermissionFiles) ? parsed.candidatePermissionFiles : [];
const candidateRoleSeedFiles = Array.isArray(parsed?.candidateRoleSeedFiles) ? parsed.candidateRoleSeedFiles : [];
const candidateBootstrapFiles = Array.isArray(parsed?.candidateBootstrapFiles) ? parsed.candidateBootstrapFiles : [];
const candidatePermissionKeys = Array.isArray(parsed?.candidatePermissionKeys) ? parsed.candidatePermissionKeys : [];

const allCandidatePaths = [
  ...candidatePermissionFiles,
  ...candidateRoleSeedFiles,
  ...candidateBootstrapFiles,
].map((item) => String(item?.path || ""));

const allCandidateText = allCandidatePaths
  .filter((path) => fs.existsSync(path))
  .map((path) => read(path))
  .join("\n");

assert("Phase 3 markdown exists", md.includes("Primary Admin All-Permissions Guard"));
assert("Phase 3 JSON parses", parsed !== null);
assert("Phase 2 baseline documented", md.includes("admin-users-signer-profile-phase2-real-wiring-map-20260623"));
assert("admin all-permissions requirement documented", md.includes("primary admin should default to access to all permissions"));
assert("Phase 2 also documents all-permissions default", phase2.includes("primary admin should default to access to all permissions"));
assert("candidate permission files discovered", candidatePermissionFiles.length > 0);
assert("candidate role/seed files discovered", candidateRoleSeedFiles.length > 0);
assert("candidate bootstrap files discovered", candidateBootstrapFiles.length > 0);
assert("candidate permission keys discovered", candidatePermissionKeys.length > 0);
assert("owner_admin appears in discovered surfaces", allCandidateText.includes("owner_admin"));
assert("bootstrap or bootstrapSafe appears in discovered surfaces", allCandidateText.includes("bootstrap") || allCandidateText.includes("bootstrapSafe"));
assert("admin role schema exists", schema.includes("AdminRole") && schema.includes("AdminUserRole"));
assert("admin permission schema exists", schema.includes("AdminRolePermission") || schema.includes("AdminUserPermissionOverride"));
assert("DOCX mutation remains prohibited", md.includes("Do not change DOCX templates"));
assert("production signer validation remains unwired", md.includes("Do not wire production document-generation signer validation"));

const failed = checks.filter((check) => check.pass === false);
for (const check of checks) {
  console.log(`${check.pass ? "PASS" : "FAIL"}: ${check.name}`);
}
if (failed.length > 0) process.exit(1);
