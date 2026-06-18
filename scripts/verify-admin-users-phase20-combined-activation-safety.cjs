const fs = require("fs");

const lib = fs.readFileSync("lib/adminPermissions.ts", "utf8");
const registry = fs.readFileSync("app/api/admin/permissions/route.ts", "utf8");
const activationRoute = fs.readFileSync("app/api/admin/permissions/activation-status/route.ts", "utf8");
const page = fs.readFileSync("app/admin/permissions/page.tsx", "utf8");

function pass(name, ok) {
  if (!ok) {
    console.error(`FAIL: ${name}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS: ${name}`);
  }
}

pass("phase20_contract_present", lib.includes("PHASE20_ADMIN_FUNCTIONS_ONLY_ACTIVATION") && lib.includes('phase: "20-combined"'));
pass("phase20_scope_admin_functions_only", lib.includes('scope: "admin-functions-only"'));
pass("phase20_env_flag_only", lib.includes('"BARSH_ADMIN_PERMISSIONS_ENFORCEMENT_ENABLED"') && lib.includes('runtimeDefault: "off-unless-env-enabled"'));
pass("phase20_recommended_blocks_present", lib.includes("requiredBlockPermissionsForReadOnlyAdmin") && lib.includes('"admin.users.manage"') && lib.includes('"admin.backups.restorePreview"'));
pass("phase20_never_block_paths_preserved", lib.includes("neverBlockPaths: ADMIN_PERMISSION_NEVER_BLOCK_PATTERNS") && lib.includes("ADMIN_PERMISSION_NEVER_BLOCK_PATTERNS"));
pass("phase20_activation_status_helper", lib.includes("phase20ActivationStatus") && lib.includes("missingRequiredBlocks") && lib.includes("readyForActivation"));
pass("phase20_registry_exposes_status", registry.includes("phase20ActivationStatus") && registry.includes("phase20Activation: phase20ActivationStatus()"));
pass("phase20_status_endpoint_read_only", activationRoute.includes("export async function GET()") && activationRoute.includes("phase20ActivationStatus") && activationRoute.includes("Read-only Phase 20 activation status"));
pass("phase20_no_status_post", !activationRoute.includes("export async function POST") && !activationRoute.includes("method: \"POST\"") && !activationRoute.includes("method: 'POST'"));
pass("phase20_ui_panel_present", page.includes('data-barsh-admin-permissions-phase20-activation-status="read-only"') && page.includes("Phase 20 Combined Activation Status"));
pass("phase20_ui_no_activation_button", !page.includes("Activate Now") && !page.includes("Enable Enforcement"));
pass("phase20_no_password_visibility_or_impersonation", !lib.includes("passwordHash") && !lib.includes("impersonat") && page.includes("does not enable enforcement"));
pass("phase20_no_write_endpoints", !activationRoute.includes("/api/admin/users/assign-role") && !activationRoute.includes("/api/admin/users/remove-role") && !activationRoute.includes("/api/admin/users/permission-override") && !activationRoute.includes("/api/admin/users/create") && !activationRoute.includes("/api/admin/users/lockout") && !activationRoute.includes("/api/admin/users/password-reset"));
pass("phase20_rollback_documented", lib.includes("Unset BARSH_ADMIN_PERMISSIONS_ENFORCEMENT_ENABLED or set it false"));

if (process.exitCode) process.exit(process.exitCode);
console.log("RESULT: Phase 20 combined guarded activation safety verifier passed");
