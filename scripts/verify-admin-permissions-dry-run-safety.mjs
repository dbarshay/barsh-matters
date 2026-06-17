#!/usr/bin/env node
import fs from "node:fs";
const failures=[];
const read=p=>fs.existsSync(p)?fs.readFileSync(p,"utf8"):"";
const reg=read("lib/adminPermissions.ts"), api=read("app/api/admin/permissions/route.ts"), session=read("app/api/auth/session/route.ts"), page=read("app/admin/permissions/page.tsx"), pkg=JSON.parse(read("package.json"));
for (const s of ["AdminPermissionDryRunDecision","adminPermissionDryRunDecisions","adminRoutePermissionDryRunDecisions","wouldAllow","wouldBlock","enforcementEnabled: false"]) if (!reg.includes(s)) failures.push("registry missing "+s);
for (const s of ["adminPermissionDryRunDecisions","adminRoutePermissionDryRunDecisions","permissionDryRun:","routeDryRun:"]) if (!api.includes(s)) failures.push("api missing "+s);
for (const s of ["adminPermissionDryRunDecisions","permissionDryRun","permissionsEnforced: false"]) if (!session.includes(s)) failures.push("session missing "+s);
for (const s of ["data-barsh-admin-permissions-dry-run=\"true\"","Dry-run only","No enforcement is active now"]) if (!page.includes(s)) failures.push("page missing "+s);
if (pkg.scripts?.["verify:admin-permissions-dry-run-safety"]!=="node scripts/verify-admin-permissions-dry-run-safety.mjs") failures.push("package script missing");
console.log("RESULT: admin permissions dry-run safety verifier");
if (failures.length){console.log("FAILURES="+failures.length); for (const f of failures) console.log("FAIL="+f); process.exit(1);} console.log("FAILURES=0"); console.log("PASS: permission enforcement dry-run diagnostics are exposed without active blocking.");
