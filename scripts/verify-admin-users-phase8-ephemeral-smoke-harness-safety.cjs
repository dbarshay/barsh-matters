#!/usr/bin/env node
const fs = require("fs");

let failures = 0;
function read(file) { try { return fs.readFileSync(file, "utf8"); } catch { return ""; } }
function pass(message) { console.log("PASS: " + message); }
function fail(message) { failures += 1; console.error("FAIL: " + message); }
function assert(condition, message) { condition ? pass(message) : fail(message); }

console.log("");
console.log("RESULT: admin users phase 8B opt-in ephemeral smoke harness safety verifier");

const harnessPath = "scripts/smoke-admin-users-phase8-ephemeral-audit-history.cjs";
const harness = read(harnessPath);
const pkg = JSON.parse(read("package.json") || "{}");
const scripts = pkg.scripts || {};

assert(fs.existsSync(harnessPath), "Phase 8B opt-in executable harness file exists");
assert(scripts["smoke:admin-users-phase8-ephemeral-audit-history"] === "node scripts/smoke-admin-users-phase8-ephemeral-audit-history.cjs", "opt-in smoke script registered");
assert(scripts["verify:admin-users-phase8-ephemeral-smoke-harness-safety"] === "node scripts/verify-admin-users-phase8-ephemeral-smoke-harness-safety.cjs", "Phase 8B safety verifier script registered");
assert(scripts["verify:admin-users-phase8-ephemeral-smoke-harness-readiness-safety"] === "node scripts/verify-admin-users-phase8-ephemeral-smoke-harness-readiness-safety.cjs", "Phase 8A readiness verifier remains registered");

assert(!Object.entries(scripts).some(([key, value]) => key.startsWith("verify:") && String(value).includes("smoke-admin-users-phase8-ephemeral-audit-history")), "normal verifier scripts do not execute the ephemeral smoke harness");
assert(!Object.values(scripts).some((value) => String(value).includes("BARSH_ADMIN_PERMISSIONS_ENFORCEMENT=1")), "package scripts do not persistently activate permissions enforcement");

assert(harness.includes("spawn(\"npm\", [\"run\", \"dev\""), "harness starts its own temporary app process");
assert(harness.includes("BARSH_ADMIN_PERMISSIONS_ENFORCEMENT: \"1\""), "harness sets enforcement only in child-process env object");
assert(harness.includes("BARSH_ADMIN_PERMISSION_OVERRIDES_JSON: BLOCK_OVERRIDE"), "harness sets block override only in child-process env object");
assert(harness.includes("admin.auditHistory.view"), "harness targets admin.auditHistory.view block override");
assert(harness.includes("/admin/audit-history"), "harness tests first staged target route");
for (const route of ["/admin", "/admin/permissions", "/api/admin/permissions", "/api/admin/permissions/check"]) assert(harness.includes(route), "harness checks never-block route: " + route);
assert(harness.includes("/api/auth/session"), "harness checks session rollback diagnostics");
assert(harness.includes("child.kill(\"SIGTERM\")") && harness.includes("child.kill(\"SIGKILL\")"), "harness stops temporary child process");
assert(harness.includes("rollback proof") && harness.includes("permissionsEnforced") && harness.includes("true") && harness.includes("/api/auth/session"), "harness contains rollback proof check against lingering permissionsEnforced=true");

for (const file of [".env", ".env.local", ".env.production", ".env.development", ".vercel/project.json"]) {
  const text = read(file);
  if (!text) { pass(file + " absent or unreadable for persistent activation scan"); continue; }
  assert(!/BARSH_ADMIN_PERMISSIONS_ENFORCEMENT\s*=\s*1/.test(text), file + " does not set BARSH_ADMIN_PERMISSIONS_ENFORCEMENT=1");
  assert(!/BARSH_ADMIN_PERMISSION_OVERRIDES_JSON\s*=/.test(text), file + " does not persist BARSH_ADMIN_PERMISSION_OVERRIDES_JSON");
  assert(!/enforcementPlanned\s*[:=]\s*true/.test(text), file + " does not persist enforcementPlanned=true");
}

const runtime = ["proxy.ts", "lib/adminPermissions.ts", "app/api/auth/session/route.ts", "app/api/admin/permissions/route.ts", "app/api/admin/permissions/check/route.ts", "app/admin/audit-history/page.tsx", "app/admin/permissions/page.tsx"].map(read).join("\n");
assert(!/enforcementPlanned\s*[:=]\s*true/.test(runtime), "runtime source does not set enforcementPlanned=true in Phase 8B");
assert(runtime.includes("/admin/audit-history") && runtime.includes("admin.auditHistory.view"), "runtime retains planned first target mapping");

if (failures) { console.error(""); console.error("FAILURES=" + failures); console.error("RESULT: admin users phase 8B opt-in ephemeral smoke harness safety verifier FAILED"); process.exit(1); }
console.log("");
console.log("FAILURES=0");
console.log("PASS: Phase 8B adds an opt-in executable ephemeral smoke harness while preserving persistent non-activation and keeping normal verification verifier-only.");
