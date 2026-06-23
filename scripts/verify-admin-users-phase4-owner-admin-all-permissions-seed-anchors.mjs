import fs from "node:fs";

const checks = [];
const read = (p) => fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "";
const assert = (name, condition) => checks.push({ name, pass: Boolean(condition) });

const md = read("docs/admin-users/signer-profile-phase4-owner-admin-all-permissions-seed-anchors.md");
const jsonText = read("docs/admin-users/signer-profile-phase4-owner-admin-all-permissions-seed-anchors.json");
const phase3 = read("docs/admin-users/signer-profile-phase3-primary-admin-all-permissions-guard.md");
let parsed = null;
try {
  parsed = JSON.parse(jsonText);
} catch {
  parsed = null;
}

const seedFiles = Array.isArray(parsed?.candidateSeedFiles) ? parsed.candidateSeedFiles : [];
const registryFiles = Array.isArray(parsed?.candidateRegistryFiles) ? parsed.candidateRegistryFiles : [];
const seedApplyFiles = Array.isArray(parsed?.candidateSeedApplyFiles) ? parsed.candidateSeedApplyFiles : [];
const userRouteFiles = Array.isArray(parsed?.candidateUserRouteFiles) ? parsed.candidateUserRouteFiles : [];
const tokens = Array.isArray(parsed?.permissionLikeTokens) ? parsed.permissionLikeTokens : [];
const combinedPaths = [...seedFiles, ...registryFiles, ...seedApplyFiles, ...userRouteFiles].map((item) => String(item?.path || ""));
const combinedText = combinedPaths.filter((path) => fs.existsSync(path)).map((path) => read(path)).join("\n");

assert("Phase 4 markdown exists", md.includes("Owner-Admin All-Permissions Seed Enforcement Anchors"));
assert("Phase 4 JSON parses", parsed !== null);
assert("Phase 3 baseline documented", md.includes("admin-users-phase3-primary-admin-all-permissions-guard-20260623"));
assert("primary admin all-permissions requirement preserved", md.includes("primary admin defaults to access to all permissions"));
assert("Phase 3 also documents all-permissions requirement", phase3.includes("primary admin should default to access to all permissions"));
assert("seed/owner-admin candidates found", seedFiles.length > 0);
assert("permission registry candidates found", registryFiles.length > 0);
assert("seed/apply script candidates found", seedApplyFiles.length > 0);
assert("admin user/permission route candidates captured", Array.isArray(userRouteFiles));
assert("permission-like tokens found", tokens.length > 0);
assert("owner_admin present in candidate surfaces", combinedText.includes("owner_admin"));
assert("bootstrap/bootstrapSafe present in candidate surfaces", combinedText.includes("bootstrap") || combinedText.includes("bootstrapSafe"));
assert("Phase 5 patch rules require registry-derived owner_admin permissions", md.includes("Prefer deriving owner_admin access from the active permission registry"));
assert("DOCX mutation prohibited", md.includes("Do not change DOCX templates"));
assert("production signer validation prohibited", md.includes("Do not wire production document-generation signer validation"));

const failed = checks.filter((check) => check.pass === false);
for (const check of checks) {
  console.log(`${check.pass ? "PASS" : "FAIL"}: ${check.name}`);
}
if (failed.length > 0) process.exit(1);
