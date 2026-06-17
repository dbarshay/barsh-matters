#!/usr/bin/env node
import fs from "node:fs";
const failures=[];
const page=fs.readFileSync("app/admin/page.tsx","utf8");
const logout=fs.readFileSync("app/api/auth/logout/route.ts","utf8");
const session=fs.readFileSync("app/api/auth/session/route.ts","utf8");
const pkg=JSON.parse(fs.readFileSync("package.json","utf8"));
for (const required of ["data-barsh-admin-session-control=\"true\"","data-barsh-admin-session-status=\"true\"","data-barsh-admin-logout-button=\"true\"","fetch(\"/api/auth/session\"","fetch(\"/api/auth/logout\"","/login?from=/admin"]) if (!page.includes(required)) failures.push("app/admin/page.tsx missing session/logout fragment: "+required);
for (const required of ["clearAdminGateCookie(response)","auth-logout","Administrator session cleared."]) if (!logout.includes(required)) failures.push("logout route missing fragment: "+required);
for (const required of ["auth-session","authenticated","permissionsEnforced: false"]) if (!session.includes(required)) failures.push("session route missing fragment: "+required);
if (pkg.scripts?.["verify:admin-session-control-safety"]!=="node scripts/verify-admin-session-control-safety.mjs") failures.push("package.json missing verify:admin-session-control-safety script");
console.log("RESULT: admin session control safety verifier");
if (failures.length){console.log("FAILURES="+failures.length); for (const f of failures) console.log("FAIL="+f); process.exit(1);} console.log("FAILURES=0"); console.log("PASS: Admin Home exposes session status and logout control using existing auth session/logout routes.");
