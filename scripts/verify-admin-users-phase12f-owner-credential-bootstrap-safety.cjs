#!/usr/bin/env node
const fs = require("fs");
const { Pool } = require("pg");
function loadLocalEnv(){ for (const file of [".env.local", ".env"]) { if (fs.existsSync(file) === false) continue; for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) { const trimmed = line.trim(); if (trimmed.length === 0 || trimmed.startsWith("#")) continue; const index = trimmed.indexOf("="); if (index < 1) continue; const key = trimmed.slice(0,index).trim(); let value = trimmed.slice(index+1).trim(); if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1,-1); if (process.env[key] === undefined) process.env[key] = value; } } }
loadLocalEnv();
function read(path){ if(fs.existsSync(path) === false){ console.error("FAIL missing "+path); process.exit(1); } return fs.readFileSync(path,"utf8"); }
function assert(label, ok){ if(ok === false){ console.error("FAIL: "+label); process.exit(1); } console.log("PASS: "+label); }
async function roleKeys(client,userId){ return (await client.query(`SELECT r.key, r.status FROM "AdminUserRole" ur JOIN "AdminRole" r ON r.id = ur."roleId" WHERE ur."userId" = $1`, [userId])).rows; }
async function main(){
 console.log("RUN: Phase 12F owner credential bootstrap safety verifier");
 const pkg=JSON.parse(read("package.json")); const schema=read("prisma/schema.prisma"); const migration=read("prisma/migrations/20260618095000_add_admin_user_credential_fields/migration.sql"); const bootstrap=read("scripts/bootstrap-admin-users-phase12f-owner-credential.cjs"); const login=read("app/api/auth/login/route.ts"); const session=read("app/api/auth/session/route.ts"); const adminAuth=read("lib/adminAuth.ts"); const permissions=read("lib/adminPermissions.ts");
 assert("package script registered for Phase 12F", pkg.scripts && pkg.scripts["verify:admin-users-phase12f-owner-credential-bootstrap-safety"] === "node scripts/verify-admin-users-phase12f-owner-credential-bootstrap-safety.cjs");
 assert("bcryptjs dependency installed for bootstrap/login package", pkg.dependencies && pkg.dependencies.bcryptjs);
 assert("pg dependency available for bootstrap/login package", pkg.dependencies && pkg.dependencies.pg);
 assert("AdminUser schema still has username", schema.includes("username               String?"));
 assert("AdminUser schema still has normalized username unique", schema.includes("normalizedUsername     String?   @unique"));
 assert("AdminUser schema still has passwordHash", schema.includes("passwordHash           String?"));
 assert("AdminUser schema still has passwordChangeRequired", schema.includes("passwordChangeRequired Boolean   @default(false)"));
 assert("credential migration still present", migration.includes("ADD COLUMN \"passwordHash\" TEXT"));
 assert("bootstrap script imports bcryptjs", bootstrap.includes("require(\"bcryptjs\")"));
 assert("bootstrap script uses direct pg", bootstrap.includes("require(\"pg\")") && bootstrap.includes("new Pool"));
 assert("bootstrap script targets owner email", bootstrap.includes("dbarshay15@gmail.com"));
 assert("bootstrap script targets owner username", bootstrap.includes("dbarshay"));
 assert("bootstrap script verifies owner_admin", bootstrap.includes("owner_admin"));
 assert("bootstrap script verifies bootstrapSafe", bootstrap.includes("bootstrapSafe"));
 assert("legacy gate cookie remains", adminAuth.includes("barsh_admin_gate"));
 assert("identity cookie remains separate", adminAuth.includes("barsh_admin_identity"));
 assert("BARSH_ADMIN_PASSWORD support remains", adminAuth.includes("BARSH_ADMIN_PASSWORD"));
 assert("login route preserves legacy fallback", login.includes('credentialMode: "legacy-admin-password"') && login.includes("configuredAdminPassword"));
 assert("login route does not set identity cookie before Phase 12H", login.includes("ADMIN_IDENTITY_COOKIE_NAME") === false);
 assert("session route remains passive diagnostics", session.includes("identityDiagnostics"));
 assert("session route still does not query AdminUser", /prisma\.adminUser|adminUser\.find|SELECT[\s\S]*AdminUser/i.test(session) === false);
 assert("never-block routes remain present", permissions.includes("/admin") && permissions.includes("/admin/permissions") && permissions.includes("/api/admin/permissions") && permissions.includes("/api/admin/permissions/check"));
 assert("DATABASE_URL is configured", typeof process.env.DATABASE_URL === "string" && process.env.DATABASE_URL.length > 0);
 const pool=new Pool({connectionString:process.env.DATABASE_URL, ssl:process.env.DATABASE_URL.includes("sslmode=require") ? undefined : {rejectUnauthorized:false}}); const client=await pool.connect();
 try { const owner=(await client.query(`SELECT * FROM "AdminUser" WHERE email=$1 LIMIT 1`,["dbarshay15@gmail.com"])).rows[0]; assert("DB owner exists", Boolean(owner)); assert("DB owner username is dbarshay", owner.username==="dbarshay"); assert("DB owner passwordHash exists", typeof owner.passwordHash==="string" && owner.passwordHash.startsWith("$2")); assert("DB owner status active", owner.status==="active"); assert("DB owner bootstrapSafe true", owner.bootstrapSafe===true); const ownerRoles=await roleKeys(client,owner.id); assert("DB owner owner_admin role retained", ownerRoles.some(role=>role.key==="owner_admin" && role.status==="active")); const jane=(await client.query(`SELECT * FROM "AdminUser" WHERE email=$1 LIMIT 1`,["jane.doe.limited@example.com"])).rows[0]; assert("DB Jane Doe exists", Boolean(jane)); assert("DB Jane Doe remains no-login username null", jane.username===null); assert("DB Jane Doe remains no-login passwordHash null", jane.passwordHash===null); } finally { client.release(); await pool.end(); }
 console.log("PASS: Phase 12F owner credential bootstrap remains locked as no-enforcement.");
}
main().catch(error=>{ console.error("FAIL:", error.message || error); process.exit(1); });
