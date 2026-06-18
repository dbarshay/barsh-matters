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
pass("simulator_section_read_only", page.includes('data-barsh-admin-permissions-simulator="read-only"'));
pass("simulator_runtime_flag_no_change", page.includes("Runtime Enforcement Changed:</strong> No") && page.includes("runtimeEnforcementChanged: false"));
pass("simulator_role_select", page.includes("data-barsh-admin-permissions-simulator-role"));
pass("simulator_permission_select", page.includes("data-barsh-admin-permissions-simulator-permission"));
pass("simulator_result", page.includes("data-barsh-admin-permissions-simulator-result") && page.includes("Simulated Result:"));
pass("matrix_source_only", page.includes("Phase 15 static role matrix") && page.includes("simulatorRow"));
pass("no_write_fetch_added", !page.includes("method: \"POST\"") && !page.includes("method: 'POST'") && !page.includes("/api/admin/users/"));
pass("no_enforcement_claim", page.includes("does not save settings") && page.includes("does not") && page.includes("enable runtime enforcement"));
if (process.exitCode) process.exit(process.exitCode);
console.log("RESULT: Phase 16A permission simulator safety verifier passed");
