const fs = require("fs");
const path = require("path");

const lib = fs.readFileSync("lib/adminPermissions.ts", "utf8");

function extractBlockArray() {
  const match = lib.match(/requiredBlockPermissionsForReadOnlyAdmin:\s*\[([\s\S]*?)\]\s*as AdminPermissionKey\[\]/);
  if (!match) throw new Error("Could not find requiredBlockPermissionsForReadOnlyAdmin");
  return match[1]
    .split("\n")
    .map((line) => line.trim().replace(/,$/, ""))
    .filter((line) => line.startsWith('"') && line.endsWith('"'))
    .map((line) => line.slice(1, -1));
}

const block = extractBlockArray();
const allow = ["admin.home.view"];
const overrides = { block, allow };
const activationEnv = {
  BARSH_ADMIN_PERMISSIONS_ENFORCEMENT_ENABLED: "true",
  BARSH_ADMIN_PERMISSION_OVERRIDES_JSON: JSON.stringify(overrides),
};
const rollbackEnv = {
  BARSH_ADMIN_PERMISSIONS_ENFORCEMENT_ENABLED: "false",
};

const packageJson = {
  phase: "22-combined-final-activation-package",
  mode: "manual-env-activation-required",
  generatedAt: new Date().toISOString(),
  scope: "admin-functions-only",
  activationEnv,
  rollbackEnv,
  verificationSequence: [
    "Before activation: run npm run verify:admin-users-phase22-final-activation-package-safety",
    "Apply activation env manually in deployment environment.",
    "Redeploy/restart.",
    "Confirm owner_admin can access /admin and /admin/permissions.",
    "Confirm read_only_admin/Jane Doe is blocked from administrator functions.",
    "Confirm read_only_admin/Jane Doe retains intended non-admin operational access.",
    "If any smoke fails, apply rollback env immediately and redeploy/restart.",
  ],
  noLockoutRequirements: [
    "owner_admin must retain /admin access.",
    "/admin/permissions must remain available as safety review path.",
    "Rollback env must be known before activation.",
  ],
  forbidden: [
    "No password visibility.",
    "No impersonation or access-as.",
    "No app-side self-activation.",
    "No user, role, override, password, session, Clio, document, email, or print queue mutation from this package.",
  ],
};

fs.mkdirSync("docs/implementation", { recursive: true });
fs.writeFileSync("docs/implementation/admin-users-phase22-final-activation-package.json", JSON.stringify(packageJson, null, 2) + "\n");

const md = `# Admin Users Phase 22 Final Activation Package

Generated: ${packageJson.generatedAt}

## Scope

admin-functions-only

## Activation environment

\`\`\`json
${JSON.stringify(activationEnv, null, 2)}
\`\`\`

## Rollback environment

\`\`\`json
${JSON.stringify(rollbackEnv, null, 2)}
\`\`\`

## Required smoke proof after manual env activation

1. owner_admin can access /admin.
2. owner_admin can access /admin/permissions.
3. read_only_admin/Jane Doe is blocked from administrator functions.
4. read_only_admin/Jane Doe retains intended non-admin operational access.
5. rollback env is available and can be applied immediately if any smoke fails.

## Forbidden

- No password visibility.
- No impersonation or access-as.
- No app-side self-activation.
- No mutation of users, roles, overrides, sessions, Clio, documents, email, or print queue from this package.
`;

fs.writeFileSync("docs/implementation/admin-users-phase22-final-activation-package.md", md);

console.log("PHASE22_ACTIVATION_ENV_JSON=" + JSON.stringify(activationEnv));
console.log("PHASE22_ROLLBACK_ENV_JSON=" + JSON.stringify(rollbackEnv));
console.log("PHASE22_WRITTEN=docs/implementation/admin-users-phase22-final-activation-package.json");
console.log("PHASE22_WRITTEN=docs/implementation/admin-users-phase22-final-activation-package.md");
