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

const start = page.indexOf('data-barsh-admin-permissions-activation-readiness="read-only"');
const end = page.indexOf('data-barsh-admin-permissions-user-effective-preview="read-only"');
const section = start >= 0 && end > start ? page.slice(start, end) : "";

pass("phase18_readiness_section_present", section.includes("Phase 18A Permission Activation Readiness"));
pass("phase18_preflight_section_present", section.includes("Activation Preflight Checklist"));
pass("phase18_decision_package_present", section.includes("Activation Decision Package"));
pass("phase18_read_only_claims", section.includes("Read-only readiness dashboard") && section.includes("Read-only checklist") && section.includes("Read-only go/no-go summary"));
pass("phase18_no_activation_control", !section.includes("Activate") && !section.includes("activation button") || section.includes("does not create an activation button"));
pass("phase18_no_write_endpoints", !section.includes("/api/admin/users/assign-role") && !section.includes("/api/admin/users/remove-role") && !section.includes("/api/admin/users/permission-override") && !section.includes("/api/admin/users/create") && !section.includes("/api/admin/users/lockout") && !section.includes("/api/admin/users/password-reset"));
pass("phase18_no_post_methods", !section.includes("method: \"POST\"") && !section.includes("method: 'POST'"));
pass("phase18_no_enforcement_flip", section.includes("runtimeEnforcementChanged: false") && !section.includes("setEnforcement") && !section.includes("enableEnforcement") && !section.includes("enforcementEnabled = true"));
pass("phase18_existing_read_models_only", page.includes("activationCatalogCount") && page.includes("activationRouteMappingCount") && page.includes("activationRoleMatrixCount") && page.includes("activationUserPreviewCount"));
pass("phase18_decision_package_model", page.includes("activationDecisionPackage") && page.includes('proposedScope: "admin-functions-only"') && page.includes("nextHumanDecision"));
pass("phase18_registered_verifiers", Boolean(pkg.scripts && pkg.scripts["verify:admin-users-phase18a-activation-readiness-safety"] && pkg.scripts["verify:admin-users-phase18b-activation-preflight-checklist-safety"] && pkg.scripts["verify:admin-users-phase18c-activation-decision-package-safety"]));

if (process.exitCode) process.exit(process.exitCode);
console.log("RESULT: Phase 18D activation readiness closeout safety verifier passed");
