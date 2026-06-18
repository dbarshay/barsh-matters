const fs = require("fs");
const source = fs.readFileSync("lib/adminPermissions.ts", "utf8");

function pass(name, ok) {
  if (!ok) {
    console.error(`FAIL: ${name}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS: ${name}`);
  }
}

pass("activation_default_off_contract", source.includes('runtimeDefault: "off-unless-env-enabled"'));
pass("activation_flag_named", source.includes('"BARSH_ADMIN_PERMISSIONS_ENFORCEMENT_ENABLED"'));
pass("rollback_env_contract", source.includes("Unset BARSH_ADMIN_PERMISSIONS_ENFORCEMENT_ENABLED or set it false"));
pass("admin_functions_only_scope", source.includes('scope: "admin-functions-only"'));
pass("never_block_paths_include_admin_permissions", source.includes('"/admin/permissions"') && source.includes('"/api/admin/permissions/check"'));
pass("read_only_admin_blocks_are_recommendations_not_writes", source.includes("phase20RecommendedOverrideJson") && !source.includes("process.env.BARSH_ADMIN_PERMISSIONS_ENFORCEMENT_ENABLED ="));

if (process.exitCode) process.exit(process.exitCode);
console.log("RESULT: Phase 20 combined env smoke contract passed");
