const fs = require("fs");
const page = fs.readFileSync("app/admin/permissions/page.tsx", "utf8");

function pass(name, ok) {
  if (!ok) {
    console.error(`FAIL: ${name}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS: ${name}`);
  }
}

const sectionStart = page.indexOf('data-barsh-admin-permissions-activation-rollback-plan="read-only"');
const sectionEnd = page.indexOf('data-barsh-admin-permissions-activation-readiness-json="true"', sectionStart + 1);
const section = sectionStart >= 0 && sectionEnd > sectionStart ? page.slice(sectionStart, sectionEnd) : "";

pass("phase19b_section_present", section.includes("Phase 19B Rollback / No-Lockout Plan"));
pass("phase19b_read_only_claims", section.includes("Read-only activation safety plan") && section.includes("does not enable enforcement") && section.includes("change environment flags") && section.includes("call write routes"));
pass("phase19b_plan_model_present", page.includes("activationRollbackPlan") && page.includes('phase: "19B"') && page.includes('mode: "rollback-plan-only"'));
pass("phase19b_same_session_required", page.includes("sameSessionRollbackRequired: true") && section.includes("Same-Session Rollback: Required"));
pass("phase19b_no_lockout_required", page.includes("noLockoutSmokeRequired: true") && section.includes("No-Lockout Smoke: Required"));
pass("phase19b_owner_access_required", page.includes("ownerMustRetainAdminAccess: true") && section.includes("Owner Admin Access: Must Retain"));
pass("phase19b_jane_doe_non_admin_preserved", page.includes("read_only_admin/Jane Doe") && page.includes("non-admin operational pages remain available"));
pass("phase19b_forbidden_mutations_present", page.includes("No runtime enforcement change") && page.includes("No write route invocation") && page.includes("No user, role, override, password, session, Clio, document, email, or print queue mutation"));
pass("phase19b_runtime_no_change", page.includes("runtimeEnforcementChanged: false"));
pass("phase19b_no_write_calls", !section.includes("method: \"POST\"") && !section.includes("method: 'POST'") && !section.includes("/api/admin/users/assign-role") && !section.includes("/api/admin/users/remove-role") && !section.includes("/api/admin/users/permission-override") && !section.includes("/api/admin/users/create") && !section.includes("/api/admin/users/lockout") && !section.includes("/api/admin/users/password-reset"));
pass("phase19b_no_enforcement_flip", !section.includes("setEnforcement") && !section.includes("enableEnforcement") && !section.includes("enforcementEnabled = true"));
pass("phase19b_readiness_json_includes_plan", page.includes("rollbackPlan: activationRollbackPlan"));

if (process.exitCode) process.exit(process.exitCode);
console.log("RESULT: Phase 19B rollback/no-lockout activation plan safety verifier passed");
