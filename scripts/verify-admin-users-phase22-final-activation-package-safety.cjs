const fs = require("fs");

const jsonPath = "docs/implementation/admin-users-phase22-final-activation-package.json";
const mdPath = "docs/implementation/admin-users-phase22-final-activation-package.md";
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const lib = fs.readFileSync("lib/adminPermissions.ts", "utf8");
const json = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
const md = fs.readFileSync(mdPath, "utf8");

function pass(name, ok) {
  if (!ok) {
    console.error(`FAIL: ${name}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS: ${name}`);
  }
}

pass("phase22_json_present", json.phase === "22-combined-final-activation-package" && json.mode === "manual-env-activation-required");
pass("phase22_scope_admin_functions_only", json.scope === "admin-functions-only");
pass("phase22_activation_env_present", json.activationEnv.BARSH_ADMIN_PERMISSIONS_ENFORCEMENT_ENABLED === "true" && typeof json.activationEnv.BARSH_ADMIN_PERMISSION_OVERRIDES_JSON === "string");
pass("phase22_activation_overrides_valid", (() => { const parsed = JSON.parse(json.activationEnv.BARSH_ADMIN_PERMISSION_OVERRIDES_JSON); return Array.isArray(parsed.block) && parsed.block.includes("admin.users.manage") && parsed.block.includes("admin.backups.restorePreview") && Array.isArray(parsed.allow) && parsed.allow.includes("admin.home.view"); })());
pass("phase22_rollback_env_present", json.rollbackEnv.BARSH_ADMIN_PERMISSIONS_ENFORCEMENT_ENABLED === "false");
pass("phase22_smoke_requirements_present", json.verificationSequence.some((item) => item.includes("owner_admin")) && json.verificationSequence.some((item) => item.includes("read_only_admin/Jane Doe")) && json.verificationSequence.some((item) => item.includes("rollback env")));
pass("phase22_no_lockout_requirements_present", json.noLockoutRequirements.some((item) => item.includes("owner_admin")) && json.noLockoutRequirements.some((item) => item.includes("/admin/permissions")));
pass("phase22_forbidden_identity_features", json.forbidden.some((item) => item.includes("No password visibility")) && json.forbidden.some((item) => item.includes("No impersonation")));
pass("phase22_no_app_self_activation", json.forbidden.some((item) => item.includes("No app-side self-activation")) && !lib.includes("process.env.BARSH_ADMIN_PERMISSIONS_ENFORCEMENT_ENABLED ="));
pass("phase22_markdown_present", md.includes("Admin Users Phase 22 Final Activation Package") && md.includes("Activation environment") && md.includes("Rollback environment"));
pass("phase22_prior_verifiers_registered", Boolean(pkg.scripts["verify:admin-users-phase21-final-closeout-safety"] && pkg.scripts["verify:admin-users-phase20-combined-activation-safety"]));

if (process.exitCode) process.exit(process.exitCode);
console.log("RESULT: Phase 22 final activation package safety verifier passed");
