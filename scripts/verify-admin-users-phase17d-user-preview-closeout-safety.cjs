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

const phase17Start = page.indexOf('data-barsh-admin-permissions-user-effective-preview="read-only"');
const roleMatrixStart = page.indexOf('data-barsh-admin-permissions-role-matrix="true"');
const section = phase17Start >= 0 && roleMatrixStart > phase17Start ? page.slice(phase17Start, roleMatrixStart) : "";

pass("phase17_user_effective_preview_present", section.includes("Phase 17A User Effective-Permission Preview"));
pass("phase17_user_route_preview_present", section.includes("Selected User Route / Function Preview"));
pass("phase17_mismatch_diagnostics_present", section.includes("Effective Permission Mismatch Diagnostics"));
pass("phase17_read_only_claims", section.includes("Read-only planning preview") && section.includes("Read-only preview") && section.includes("Read-only diagnostic"));
pass("phase17_planning_get_only", page.includes('fetch("/api/admin/users/planning", { cache: "no-store" })'));
pass("phase17_no_write_endpoints", !section.includes("/api/admin/users/assign-role") && !section.includes("/api/admin/users/remove-role") && !section.includes("/api/admin/users/permission-override") && !section.includes("/api/admin/users/create") && !section.includes("/api/admin/users/lockout") && !section.includes("/api/admin/users/password-reset"));
pass("phase17_no_post_methods", !section.includes("method: \"POST\"") && !section.includes("method: 'POST'"));
pass("phase17_no_enforcement_flip", section.includes("runtimeEnforcementChanged: false") && !section.includes("setEnforcement") && !section.includes("enableEnforcement"));
pass("phase17_role_matrix_based", section.includes("selectedUserPermissionRows") && section.includes("selectedUserRouteRows") && section.includes("selectedUserMatrixAllowedKeys"));
pass("phase17_registered_verifiers", Boolean(pkg.scripts && pkg.scripts["verify:admin-users-phase17a-user-effective-preview-safety"] && pkg.scripts["verify:admin-users-phase17b-user-route-effective-preview-safety"] && pkg.scripts["verify:admin-users-phase17c-effective-mismatch-diagnostics-safety"]));

if (process.exitCode) process.exit(process.exitCode);
console.log("RESULT: Phase 17D user-preview closeout safety verifier passed");
