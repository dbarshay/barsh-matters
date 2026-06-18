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

const sectionStart = page.indexOf('data-barsh-admin-permissions-user-route-effective-preview="read-only"');
const sectionEnd = page.indexOf('data-barsh-admin-permissions-user-effective-json="true"', sectionStart + 1);
const section = sectionStart >= 0 && sectionEnd > sectionStart ? page.slice(sectionStart, sectionEnd) : "";

pass("phase17b_section_present", section.includes("Selected User Route / Function Preview"));
pass("phase17b_read_only_claims", section.includes("Read-only preview") && section.includes("does not write") && section.includes("enforce") && section.includes("change user permissions"));
pass("phase17b_route_permission_display", section.includes("data-barsh-admin-permissions-user-route-effective-route") && section.includes("simulatorRoutePermission"));
pass("phase17b_route_result_display", section.includes("data-barsh-admin-permissions-user-route-effective-result") && section.includes("User Route Result:"));
pass("phase17b_decision_display", section.includes("data-barsh-admin-permissions-user-route-effective-decision") && section.includes("selectedUserRouteDecision"));
pass("phase17b_json_preview", section.includes("data-barsh-admin-permissions-user-route-effective-json") && section.includes("runtimeEnforcementChanged: false"));
pass("phase17b_matrix_based", page.includes("selectedUserRouteRows") && page.includes("selectedUserRouteBlocked") && page.includes("selectedUserRouteAllowed"));
pass("phase17b_no_user_write_calls", !section.includes("/api/admin/users/assign-role") && !section.includes("/api/admin/users/remove-role") && !section.includes("/api/admin/users/permission-override") && !section.includes("/api/admin/users/create") && !section.includes("/api/admin/users/lockout") && !section.includes("/api/admin/users/password-reset") && !section.includes("method: \"POST\"") && !section.includes("method: 'POST'"));
pass("phase17b_no_enforcement_flip", !section.includes("setEnforcement") && !section.includes("enableEnforcement") && section.includes("runtimeEnforcementChanged: false"));

if (process.exitCode) process.exit(process.exitCode);
console.log("RESULT: Phase 17B user route/function effective preview safety verifier passed");
