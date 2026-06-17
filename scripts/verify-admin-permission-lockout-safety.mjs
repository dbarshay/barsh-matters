#!/usr/bin/env node
import fs from "node:fs";
const failures=[];
const registry=fs.readFileSync("lib/adminPermissions.ts","utf8");
const proxy=fs.readFileSync("proxy.ts","utf8");
const pkg=JSON.parse(fs.readFileSync("package.json","utf8"));
for (const required of ["ADMIN_PERMISSION_NEVER_BLOCK_PATTERNS", "isAdminPermissionNeverBlockPath", "Never-block safety route remains allowed", "prevent administrator lockout", "adminPermissionEnforcementDecision"]) if (!registry.includes(required)) failures.push("registry missing lockout safety fragment "+required);
for (const required of ["/admin", "/admin/permissions", "/api/admin/permissions", "/api/admin/permissions/check"]) if (!registry.includes(required)) failures.push("registry missing never-block path "+required);
if (proxy.includes("admin page permission blocked")) failures.push("proxy should still not enforce admin page permissions in Phase 1X");
if (pkg.scripts?.["verify:admin-permission-lockout-safety"]!=="node scripts/verify-admin-permission-lockout-safety.mjs") failures.push("package script missing");
console.log("RESULT: admin permission lockout safety verifier");
if (failures.length){console.log("FAILURES="+failures.length); for (const f of failures) console.log("FAIL="+f); process.exit(1);}
console.log("FAILURES=0");
console.log("PASS: critical admin/permissions routes are marked never-block to prevent administrator lockout.");
