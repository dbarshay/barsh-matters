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

const simulatorRelatedLines = page
  .split(/\r?\n/)
  .filter((line) =>
    line.includes("simulator") ||
    line.includes("blockedNotice") ||
    line.includes("groupedRoleMatrix")
  );

pass("simulator_section_read_only", page.includes('data-barsh-admin-permissions-simulator="read-only"'));
pass("simulator_runtime_flag_no_change", page.includes("Runtime Enforcement Changed:</strong> No") && page.includes("runtimeEnforcementChanged: false"));
pass("simulator_role_select", page.includes("data-barsh-admin-permissions-simulator-role"));
pass("simulator_permission_select", page.includes("data-barsh-admin-permissions-simulator-permission"));
pass("simulator_result", page.includes("data-barsh-admin-permissions-simulator-result") && page.includes("Simulated Result:"));
pass("matrix_source_only", page.includes("Phase 15 static role matrix") && page.includes("simulatorRow"));
pass("typed_decision_dependency", page.includes("simulatorRow.decision") && page.includes("simulatorDecision"));
pass("no_typed_allowed_dependency", !page.includes("simulatorRow.allowed"));
pass("route_simulator_section_read_only", page.includes('data-barsh-admin-permissions-route-simulator="read-only"'));
pass("route_simulator_route_select", page.includes("data-barsh-admin-permissions-route-simulator-route"));
pass("route_simulator_result", page.includes("data-barsh-admin-permissions-route-simulator-result") && page.includes("Route Result:"));
pass("route_simulator_uses_route_permission", page.includes("simulatorRoutePermission") && page.includes("simulatorRouteMatrixRow"));
pass("route_simulator_runtime_no_change", page.includes("runtimeEnforcementChanged: false"));
pass("no_simulator_literal_slash_n", !simulatorRelatedLines.some((line) => line.includes("\\n")));
pass("no_write_fetch_added", !page.includes("method: \"POST\"") && !page.includes("method: 'POST'") && !page.includes("/api/admin/users/"));
pass("no_enforcement_claim", page.includes("does not save settings") && page.includes("enable runtime enforcement") && page.includes("does not enforce, save, or modify anything"));
pass("phase16c_diagnostics", page.includes("data-barsh-admin-permissions-simulator-diagnostics") && page.includes("data-barsh-admin-permissions-route-simulator-diagnostics"));
pass("phase16c_reason_enforcement_fields", page.includes("simulatorReason") && page.includes("simulatorEnforcementStatus") && page.includes("simulatorRouteReason") && page.includes("simulatorRouteEnforcementStatus"));

if (process.exitCode) process.exit(process.exitCode);
console.log("RESULT: Phase 16A/16B permission simulator safety verifier passed");
