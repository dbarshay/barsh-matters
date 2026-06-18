const fs = require("fs");
const page = fs.readFileSync("app/admin/permissions/page.tsx", "utf8");
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));

function pass(name, ok) {
  if (!ok) {
    console.error(`FAIL: ${name}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS: ${name}`);
  }
}

const start = page.indexOf('data-barsh-admin-permissions-activation-design-contract="read-only"');
const end = page.indexOf('data-barsh-admin-permissions-activation-readiness-json="true"', start + 1);
const section = start >= 0 && end > start ? page.slice(start, end) : "";

pass("phase19_design_contract_present", section.includes("Phase 19A Activation Design Contract"));
pass("phase19_rollback_plan_present", section.includes("Phase 19B Rollback / No-Lockout Plan"));
pass("phase19_smoke_plan_present", section.includes("Phase 19C Activation Smoke-Test Plan"));
pass("phase19_all_read_only", section.includes("Read-only design contract") && section.includes("Read-only activation safety plan") && section.includes("Read-only smoke-test plan"));
pass("phase19_first_scope_admin_functions_only", page.includes('proposedFirstScope: "admin-functions-only"') && page.includes("administrator functions only"));
pass("phase19_owner_no_lockout_required", page.includes("ownerMustRetainAdminAccess: true") && page.includes("Smoke must prove owner_admin is not locked out"));
pass("phase19_readonly_admin_limited_scope", page.includes("read_only_admin/Jane Doe") && page.includes("non-admin operational pages remain available") && page.includes("administrator-function blocking is limited"));
pass("phase19_same_session_rollback_required", page.includes("sameSessionRollbackRequired: true") && page.includes("rollback can be applied in the same session before push"));
pass("phase19_no_impersonation_or_password_visibility", page.includes("Smoke must not require password visibility, impersonation, or access-as another user"));
pass("phase19_no_activation_controls", !section.includes("Activate Now") && !section.includes("Enable Enforcement") && !section.includes("activation button") || section.includes("does not create an activation button"));
pass("phase19_no_write_endpoints", !section.includes("/api/admin/users/assign-role") && !section.includes("/api/admin/users/remove-role") && !section.includes("/api/admin/users/permission-override") && !section.includes("/api/admin/users/create") && !section.includes("/api/admin/users/lockout") && !section.includes("/api/admin/users/password-reset"));
pass("phase19_no_post_methods", !section.includes("method: \"POST\"") && !section.includes("method: 'POST'"));
pass("phase19_no_enforcement_flip", page.includes("runtimeEnforcementChanged: false") && !section.includes("setEnforcement(") && !section.includes("enableEnforcement(") && !section.includes("enforcementEnabled = true") && !section.includes("runtimeEnforcementChanged: true"));
pass("phase19_readiness_json_includes_all_plans", page.includes("designContract: activationDesignContract") && page.includes("rollbackPlan: activationRollbackPlan") && page.includes("smokePlan: activationSmokePlan"));
pass("phase19_registered_verifiers", Boolean(pkg.scripts && pkg.scripts["verify:admin-users-phase19a-activation-design-contract-safety"] && pkg.scripts["verify:admin-users-phase19b-rollback-no-lockout-plan-safety"] && pkg.scripts["verify:admin-users-phase19c-activation-smoke-plan-safety"]));

if (process.exitCode) process.exit(process.exitCode);
console.log("RESULT: Phase 19D activation design closeout safety verifier passed");
