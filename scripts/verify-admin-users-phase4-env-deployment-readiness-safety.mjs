import fs from "fs";

let failures = 0;
function pass(message) {
  console.log("PASS:", message);
}
function fail(message) {
  failures += 1;
  console.log("FAIL:", message);
}

function readIfExists(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
}

const envConfigFiles = [
  ".env",
  ".env.local",
  ".env.example",
  ".env.production",
  ".env.vercel",
  "vercel.json",
  "next.config.js",
  "next.config.mjs",
  "package.json",
];

const registry = readIfExists("lib/adminPermissions.ts");
const sessionRoute = readIfExists("app/api/auth/session/route.ts");
const permissionsRoute = readIfExists("app/api/admin/permissions/route.ts");
const permissionsPage = readIfExists("app/admin/permissions/page.tsx");
const proxy = readIfExists("proxy.ts");
const packageJson = JSON.parse(readIfExists("package.json") || "{}");

const activationPatterns = [
  /BARSH_ADMIN_PERMISSIONS_ENFORCEMENT\s*=\s*1/,
  /BARSH_ADMIN_PERMISSIONS_ENFORCEMENT["']?\s*:\s*["']?1/,
  /process\.env\.BARSH_ADMIN_PERMISSIONS_ENFORCEMENT\s*=/,
  /enforcementPlanned:\s*true/,
];

for (const file of envConfigFiles) {
  if (!fs.existsSync(file)) {
    pass(`${file} absent or not used for deployment config`);
    continue;
  }
  const text = readIfExists(file);
  const hits = activationPatterns.filter((pattern) => pattern.test(text));
  if (hits.length) fail(`${file} must not activate admin permission enforcement`);
  else pass(`${file} does not activate admin permission enforcement`);
}

for (const required of [
  "BARSH_ADMIN_PERMISSIONS_ENFORCEMENT",
  "configuredAdminPermissionsEnforcementEnabled",
  'return String(process.env.BARSH_ADMIN_PERMISSIONS_ENFORCEMENT ?? "").trim() === "1"',
  "BARSH_ADMIN_PERMISSION_OVERRIDES_JSON",
  "configuredAdminPermissionOverridesFromEnv",
]) {
  if (registry.includes(required)) pass(`registry exposes env flag/override hook: ${required}`);
  else fail(`registry exposes env flag/override hook: ${required}`);
}

for (const forbidden of [
  "process.env.BARSH_ADMIN_PERMISSIONS_ENFORCEMENT =",
  "enforcementPlanned: true",
]) {
  if (registry.includes(forbidden) || proxy.includes(forbidden) || sessionRoute.includes(forbidden) || permissionsRoute.includes(forbidden)) {
    fail(`runtime source must not activate enforcement via ${forbidden}`);
  } else {
    pass(`runtime source does not activate enforcement via ${forbidden}`);
  }
}

for (const required of [
  "permissionsEnforced: configuredAdminPermissionsEnforcementEnabled()",
  "permissionOverrideConfig",
  "permissionDryRun",
  'permissionsMode: "default-admin-allow-all"',
]) {
  if (sessionRoute.includes(required)) pass(`session route exposes diagnostic field: ${required}`);
  else fail(`session route exposes diagnostic field: ${required}`);
}

for (const required of [
  "enforcementEnabled: configuredAdminPermissionsEnforcementEnabled()",
  "overrideConfig: configuredAdminPermissionOverridesFromEnv()",
  "permissionDryRun: adminPermissionDryRunDecisions()",
  "routeDryRun: adminRoutePermissionDryRunDecisions()",
  'mode: "default-admin-allow-all"',
  "Read-only permissions registry",
]) {
  if (permissionsRoute.includes(required)) pass(`permissions API exposes read-only diagnostic field: ${required}`);
  else fail(`permissions API exposes read-only diagnostic field: ${required}`);
}

for (const required of [
  "Dry-run only",
  "No enforcement is active now",
  "Set BARSH_ADMIN_PERMISSIONS_ENFORCEMENT=1 only in a later enforcement phase",
  "Overrides are displayed for planning only and are not enforced yet",
  "Permission enforcement and user-configurable allow/block settings are deferred",
]) {
  if (permissionsPage.includes(required)) pass(`permissions page contains safety copy: ${required}`);
  else fail(`permissions page contains safety copy: ${required}`);
}

for (const required of [
  "adminPermissionEnforcementDecision",
  "permissionDecision.enforcementEnabled && permissionDecision.blocked",
  "admin-api-permission-blocked",
  'blockedUrl.pathname = "/admin/permissions"',
]) {
  if (proxy.includes(required)) pass(`proxy has future enforcement wiring but remains flag-gated: ${required}`);
  else fail(`proxy has future enforcement wiring but remains flag-gated: ${required}`);
}

if (packageJson.scripts?.["verify:admin-users-phase4-env-deployment-readiness-safety"] === "node scripts/verify-admin-users-phase4-env-deployment-readiness-safety.mjs") {
  pass("package script registered");
} else {
  fail("package script registered");
}

console.log("\nRESULT: admin users phase 4 env/deployment readiness safety verifier");
console.log(`FAILURES=${failures}`);
if (failures) process.exit(1);
console.log("PASS: Phase 4 environment/deployment readiness is safe: env/config does not activate enforcement, runtime surfaces are diagnostic, and future enforcement remains flag-gated.");
