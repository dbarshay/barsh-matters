#!/usr/bin/env node
import fs from "node:fs";
const failures=[];
const read=p=>fs.existsSync(p)?fs.readFileSync(p,"utf8"):"";
const reg=read("lib/adminPermissions.ts"), api=read("app/api/admin/permissions/route.ts"), session=read("app/api/auth/session/route.ts"), page=read("app/admin/permissions/page.tsx"), pkg=JSON.parse(read("package.json"));
for (const s of ["BARSH_ADMIN_PERMISSION_OVERRIDES_JSON","configuredAdminPermissionOverridesFromEnv","AdminPermissionOverrideConfig","enforcementEnabled: false","Unknown admin permission override ignored"]) if (!reg.includes(s)) failures.push("registry missing "+s);
for (const s of ["configuredAdminPermissionOverridesFromEnv","overrideConfig:"]) if (!api.includes(s)) failures.push("api missing "+s);
for (const s of ["configuredAdminPermissionOverridesFromEnv","permissionOverrideConfig","permissionsEnforced: false"]) if (!session.includes(s)) failures.push("session missing "+s);
for (const s of ["data-barsh-admin-permissions-override-config=\"true\"","BARSH_ADMIN_PERMISSION_OVERRIDES_JSON","not enforced yet"]) if (!page.includes(s)) failures.push("page missing "+s);
if (pkg.scripts?.["verify:admin-permissions-config-preview-safety"]!=="node scripts/verify-admin-permissions-config-preview-safety.mjs") failures.push("package script missing");
console.log("RESULT: admin permissions config preview safety verifier");
if (failures.length){console.log("FAILURES="+failures.length); for (const f of failures) console.log("FAIL="+f); process.exit(1);} console.log("FAILURES=0"); console.log("PASS: permission override config preview is exposed without enforcement.");
