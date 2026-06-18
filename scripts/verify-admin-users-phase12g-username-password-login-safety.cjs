#!/usr/bin/env node
const fs = require("fs");
const { Pool } = require("pg");
function loadLocalEnv(){ for (const file of [".env.local", ".env"]) { if (fs.existsSync(file) === false) continue; for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) { const trimmed = line.trim(); if (trimmed.length === 0 || trimmed.startsWith("#")) continue; const index = trimmed.indexOf("="); if (index < 1) continue; const key = trimmed.slice(0,index).trim(); let value = trimmed.slice(index+1).trim(); if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1,-1); if (process.env[key] === undefined) process.env[key] = value; } } }
loadLocalEnv();
function read(path){ if(fs.existsSync(path) === false){ console.error("FAIL missing "+path); process.exit(1); } return fs.readFileSync(path,"utf8"); }
function assert(label, ok){ if(ok === false){ console.error("FAIL: "+label); process.exit(1); } console.log("PASS: "+label); }
async function main(){
 console.log("RUN: Phase 12G username/password login UI safety verifier");
 const pkg=JSON.parse(read("package.json")); const login=read("app/api/auth/login/route.ts"); const loginPage=read("app/login/page.tsx"); const session=read("app/api/auth/session/route.ts"); const adminAuth=read("lib/adminAuth.ts"); const permissions=read("lib/adminPermissions.ts");
 assert("package script registered for Phase 12G", pkg.scripts && pkg.scripts["verify:admin-users-phase12g-username-password-login-safety"] === "node scripts/verify-admin-users-phase12g-username-password-login-safety.cjs");
 assert("bcryptjs dependency is direct", Boolean(pkg.dependencies && pkg.dependencies.bcryptjs));
 assert("pg dependency is direct", Boolean(pkg.dependencies && pkg.dependencies.pg));
 assert("login route imports bcryptjs", login.includes('import * as bcrypt from "bcryptjs"'));
 assert("login route uses pg Pool", login.includes('require("pg")') && login.includes("new Pool"));
 assert("login route reads username", login.includes("body?.username"));
 assert("login route compares password hash", login.includes("bcrypt.compare(password, user.passwordHash)"));
 assert("login route restricts credential login to bootstrapSafe owner_admin", login.includes("userIsEligibleForPhase12GOwnerLogin") && login.includes("owner_admin") && login.includes("bootstrapSafe === true"));
 assert("login route records failed login only", login.includes("recordFailedCredentialLogin") && login.includes('"failedLoginCount" = COALESCE("failedLoginCount", 0) + 1'));
 assert("login route records successful login timestamp", login.includes("recordSuccessfulCredentialLogin") && login.includes('"lastLoginAt" = CURRENT_TIMESTAMP'));
 assert("login route preserves legacy fallback", login.includes('credentialMode: "legacy-admin-password"') && login.includes("configuredAdminPassword"));
 assert("login route sets generic gate cookie", login.includes("setAdminGateCookie(response)"));
 assert("login route does not set identity cookie", login.includes("ADMIN_IDENTITY_COOKIE_NAME") === false);
 assert("login route states identity binding remains Phase 12H", login.includes("session-bound AdminUser identity remains planned for Phase 12H"));
 assert("login page has username state", loginPage.includes("const [username, setUsername] = useState"));
 assert("login page renders username input", loginPage.includes('data-barsh-login-username="true"'));
 assert("login page submits username", loginPage.includes("username: trimmedUsername || undefined"));
 assert("login page explains legacy fallback remains", loginPage.includes("legacy administrator password still works if the username field is left blank"));
 assert("session route remains passive diagnostics", session.includes("identityDiagnostics"));
 assert("session route does not query AdminUser", /prisma\.adminUser|adminUser\.find|SELECT[\s\S]*AdminUser/i.test(session) === false);
 assert("session mode remains default admin allow-all", session.includes('permissionsMode: "default-admin-allow-all"'));
 assert("legacy gate cookie remains", adminAuth.includes("barsh_admin_gate"));
 assert("identity cookie name remains planned only", adminAuth.includes("barsh_admin_identity"));
 assert("never-block routes remain present", permissions.includes("/admin") && permissions.includes("/admin/permissions") && permissions.includes("/api/admin/permissions") && permissions.includes("/api/admin/permissions/check"));
 assert("DATABASE_URL is configured", typeof process.env.DATABASE_URL === "string" && process.env.DATABASE_URL.length > 0);
 const pool=new Pool({connectionString:process.env.DATABASE_URL, ssl:process.env.DATABASE_URL.includes("sslmode=require") ? undefined : {rejectUnauthorized:false}}); const client=await pool.connect();
 try { const owner=(await client.query(`SELECT * FROM "AdminUser" WHERE email=$1 LIMIT 1`,["dbarshay15@gmail.com"])).rows[0]; assert("DB owner exists", Boolean(owner)); assert("DB owner username is dbarshay", owner.username==="dbarshay"); assert("DB owner passwordHash exists", typeof owner.passwordHash==="string" && owner.passwordHash.startsWith("$2")); assert("DB owner remains bootstrapSafe", owner.bootstrapSafe===true); const jane=(await client.query(`SELECT * FROM "AdminUser" WHERE email=$1 LIMIT 1`,["jane.doe.limited@example.com"])).rows[0]; assert("DB Jane Doe exists", Boolean(jane)); assert("DB Jane Doe remains no-login username null", jane.username===null); assert("DB Jane Doe remains no-login passwordHash null", jane.passwordHash===null); } finally { client.release(); await pool.end(); }
 console.log("CONTRACT: Phase 12G accepts owner username/password and legacy fallback.");
 console.log("CONTRACT: Phase 12G still writes only the generic gate cookie and does not bind AdminUser.id into the session.");
 console.log("CONTRACT: Phase 12G does not enable Jane Doe login or permission enforcement.");
 console.log("PASS: Phase 12G username/password login is locked as no-enforcement.");
}
main().catch(error=>{ console.error("FAIL:", error.message || error); process.exit(1); });
