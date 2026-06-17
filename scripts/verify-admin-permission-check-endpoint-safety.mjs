#!/usr/bin/env node
import fs from "node:fs";
const failures=[];
const route=fs.readFileSync("app/api/admin/permissions/check/route.ts","utf8");
const registry=fs.readFileSync("lib/adminPermissions.ts","utf8");
const proxy=fs.readFileSync("proxy.ts","utf8");
const pkg=JSON.parse(fs.readFileSync("package.json","utf8"));
for (const required of ["adminPermissionEnforcementDecision", "admin-permission-check", "safePath", "safeMethod", "does not enforce blocking"]) if (!route.includes(required)) failures.push("check route missing "+required);
if (!registry.includes("pattern: \"/api/admin/permissions/check\"")) failures.push("registry missing /api/admin/permissions/check mapping");
if (proxy.includes("adminPermissionEnforcementDecision")) failures.push("proxy.ts should not enforce permission decisions in Phase 1P");
if (pkg.scripts?.["verify:admin-permission-check-endpoint-safety"]!=="node scripts/verify-admin-permission-check-endpoint-safety.mjs") failures.push("package script missing");
console.log("RESULT: admin permission check endpoint safety verifier");
if (failures.length){console.log("FAILURES="+failures.length); for (const f of failures) console.log("FAIL="+f); process.exit(1);}
console.log("FAILURES=0");
console.log("PASS: read-only permission decision check endpoint exists without proxy enforcement.");
