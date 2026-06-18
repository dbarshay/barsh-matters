#!/usr/bin/env node
const fs = require("fs");
const { Pool } = require("pg");
function loadLocalEnv(){
  for (const file of [".env.local", ".env"]) {
    if (fs.existsSync(file) === false) continue;
    const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.length === 0 || trimmed.startsWith("#")) continue;
      const index = trimmed.indexOf("=");
      if (index < 1) continue;
      const key = trimmed.slice(0, index).trim();
      let value = trimmed.slice(index + 1).trim();
      if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith(") && value.endsWith("))) value = value.slice(1, -1);
      if (process.env[key] === undefined) process.env[key] = value;
    }
  }
}
loadLocalEnv();
function read(path){ if(fs.existsSync(path) === false){ console.error("FAIL missing "+path); process.exit(1); } return fs.readFileSync(path,"utf8"); }
function assert(label, ok){ if(ok === false){ console.error("FAIL: "+label); process.exit(1); } console.log("PASS: "+label); }
async function roleKeys(client, userId){ const result = await client.query(`SELECT r.key, r.status FROM "AdminUserRole" ur JOIN "AdminRole" r ON r.id = ur."roleId" WHERE ur."userId" = $1`, [userId]); return result.rows; }
async function main(){
  console.log("RUN: Phase 12F owner credential bootstrap safety verifier");
  console.log("Owner bootstrap only: validates owner credential storage exists while login/session/enforcement remain unchanged.");
  const pkg = JSON.parse(read("package.json"));
  const schema = read("prisma/schema.prisma");
  const migration = read("prisma/migrations/20260618095000_add_admin_user_credential_fields/migration.sql");
  const bootstrap = read("scripts/bootstrap-admin-users-phase12f-owner-credential.cjs");
  const login = read("app/api/auth/login/route.ts");
  const session = read("app/api/auth/session/route.ts");
  const adminAuth = read("lib/adminAuth.ts");
  const permissions = read("lib/adminPermissions.ts");
  assert("package script registered for Phase 12F", pkg.scripts && pkg.scripts["verify:admin-users-phase12f-owner-credential-bootstrap-safety"] === "node scripts/verify-admin-users-phase12f-owner-credential-bootstrap-safety.cjs");
  assert("bcryptjs dependency installed for bootstrap package", pkg.dependencies && pkg.dependencies.bcryptjs);
  assert("pg is available through dependency tree", Boolean(require.resolve("pg")));
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
  assert("bootstrap script requires password policy", bootstrap.includes("password is at least 10 characters") && bootstrap.includes("password has uppercase letter") && bootstrap.includes("password has lowercase letter") && bootstrap.includes("password has number") && bootstrap.includes("password has symbol"));
  assert("bootstrap script does not set Jane Doe credentials", bootstrap.includes("Jane Doe has no passwordHash in Phase 12F") && bootstrap.includes("Jane Doe has no username in Phase 12F"));
  assert("legacy gate cookie remains", adminAuth.includes("barsh_admin_gate"));
  assert("identity cookie remains separate", adminAuth.includes("barsh_admin_identity"));
  assert("BARSH_ADMIN_PASSWORD support remains", adminAuth.includes("BARSH_ADMIN_PASSWORD"));
  assert("login route remains legacy password-only", login.includes("body?.password") && /body\?\.(username|email|adminEmail|userEmail)/.test(login) === false);
  assert("login route still does not use bcrypt/passwordHash", /bcrypt|bcryptjs|argon2|passwordHash/i.test(login) === false);
  assert("session route remains passive diagnostics", session.includes("identityDiagnostics"));
  assert("session route still does not query AdminUser", /prisma\.adminUser|adminUser\.find/i.test(session) === false);
  assert("never-block route /admin remains present", permissions.includes("/admin"));
  assert("never-block route /admin/permissions remains present", permissions.includes("/admin/permissions"));
  assert("never-block route /api/admin/permissions remains present", permissions.includes("/api/admin/permissions"));
  assert("never-block route /api/admin/permissions/check remains present", permissions.includes("/api/admin/permissions/check"));
  assert("DATABASE_URL is configured", typeof process.env.DATABASE_URL === "string" && process.env.DATABASE_URL.length > 0);
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_URL.includes("sslmode=require") ? undefined : { rejectUnauthorized: false } });
  const client = await pool.connect();
  try {
    const ownerResult = await client.query(`SELECT * FROM "AdminUser" WHERE email = $1 LIMIT 1`, ["dbarshay15@gmail.com"]);
    const owner = ownerResult.rows[0];
    assert("DB owner exists", Boolean(owner));
    assert("DB owner username is dbarshay", owner.username === "dbarshay");
    assert("DB owner normalizedUsername is dbarshay", owner.normalizedUsername === "dbarshay");
    assert("DB owner passwordHash exists", typeof owner.passwordHash === "string" && owner.passwordHash.startsWith("$2"));
    assert("DB owner passwordSetAt exists", Boolean(owner.passwordSetAt));
    assert("DB owner passwordChangeRequired true", owner.passwordChangeRequired === true);
    assert("DB owner status active", owner.status === "active");
    assert("DB owner bootstrapSafe true", owner.bootstrapSafe === true);
    const ownerRoles = await roleKeys(client, owner.id);
    assert("DB owner owner_admin role retained", ownerRoles.some((role)=>role.key === "owner_admin" && role.status === "active"));
    const janeResult = await client.query(`SELECT * FROM "AdminUser" WHERE email = $1 LIMIT 1`, ["jane.doe.limited@example.com"]);
    const jane = janeResult.rows[0];
    assert("DB Jane Doe exists", Boolean(jane));
    assert("DB Jane Doe remains no-login username null", jane.username === null);
    assert("DB Jane Doe remains no-login passwordHash null", jane.passwordHash === null);
    assert("DB Jane Doe remains not bootstrapSafe", jane.bootstrapSafe === false);
    const janeRoles = await roleKeys(client, jane.id);
    assert("DB Jane Doe remains not owner_admin", janeRoles.some((role)=>role.key === "owner_admin") === false);
  } finally {
    client.release();
    await pool.end();
  }
  console.log("CONTRACT: Phase 12F bootstraps owner credentials only.");
  console.log("CONTRACT: Phase 12F does not enable username login, session-bound AdminUser identity, Jane Doe login, or permission enforcement.");
  console.log("PASS: Phase 12F owner credential bootstrap is locked as no-enforcement.");
}
main().catch((error)=>{ console.error("FAIL:", error.message || error); process.exit(1); });
