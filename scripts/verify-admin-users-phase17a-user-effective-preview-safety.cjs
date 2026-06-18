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

const sectionStart = page.indexOf('data-barsh-admin-permissions-user-effective-preview="read-only"');
const sectionEnd = page.indexOf('data-barsh-admin-permissions-role-matrix="true"');
const section = sectionStart >= 0 && sectionEnd > sectionStart ? page.slice(sectionStart, sectionEnd) : "";

pass("phase17a_section_present", section.includes("Phase 17A User Effective-Permission Preview"));
pass("phase17a_read_only_claims", section.includes("Read-only planning preview") && section.includes("does not assign roles") && section.includes("does not") && section.includes("enable enforcement"));
pass("phase17a_fetches_planning_only", page.includes('fetch("/api/admin/users/planning", { cache: "no-store" })'));
pass("phase17a_user_select_present", section.includes("data-barsh-admin-permissions-user-effective-select"));
pass("phase17a_role_and_counts_present", section.includes("data-barsh-admin-permissions-user-effective-role") && section.includes("data-barsh-admin-permissions-user-effective-counts"));
pass("phase17a_json_preview_present", section.includes("data-barsh-admin-permissions-user-effective-json") && section.includes("runtimeEnforcementChanged: false"));
pass("phase17a_matrix_based", page.includes("selectedUserPermissionRows") && page.includes("selectedUserAllowedCount") && page.includes("selectedUserBlockedCount"));
pass("phase17a_no_user_write_calls", !section.includes("/api/admin/users/assign-role") && !section.includes("/api/admin/users/remove-role") && !section.includes("/api/admin/users/permission-override") && !section.includes("method: \"POST\"") && !section.includes("method: 'POST'"));
pass("phase17a_no_enforcement_flip", !section.includes("setEnforcement") && !section.includes("enableEnforcement") && section.includes("Runtime Enforcement Changed:</strong> No"));

if (process.exitCode) process.exit(process.exitCode);
console.log("RESULT: Phase 17A user effective-permission preview safety verifier passed");
