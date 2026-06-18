#!/usr/bin/env node
const fs = require("fs");
const bcrypt = require("bcryptjs");
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
const OWNER_EMAIL = "dbarshay15@gmail.com";
const OWNER_USERNAME = "dbarshay";
const OWNER_NORMALIZED_USERNAME = "dbarshay";
function assert(label, ok){ if(ok === false){ throw new Error(label); } console.log("PASS: "+label); }
function validatePassword(password){
  assert("owner bootstrap password provided through local environment only", typeof password === "string" && password.length > 0);
  assert("password is at least 10 characters", password.length >= 10);
  assert("password has uppercase letter", /[A-Z]/.test(password));
  assert("password has lowercase letter", /[a-z]/.test(password));
  assert("password has number", /[0-9]/.test(password));
  assert("password has symbol", /[^A-Za-z0-9]/.test(password));
}
async function ownerRoleKeys(client, userId){ const result = await client.query(`SELECT r.key, r.status FROM "AdminUserRole" ur JOIN "AdminRole" r ON r.id = ur."roleId" WHERE ur."userId" = $1`, [userId]); return result.rows; }
async function main(){
  const apply = process.argv.includes("--apply");
  const password = process.env.BARSH_OWNER_BOOTSTRAP_PASSWORD || "";
  if(apply){ validatePassword(password); }
  assert("DATABASE_URL is configured", typeof process.env.DATABASE_URL === "string" && process.env.DATABASE_URL.length > 0);
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_URL.includes("sslmode=require") ? undefined : { rejectUnauthorized: false } });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const ownerResult = await client.query(`SELECT * FROM "AdminUser" WHERE email = $1 LIMIT 1`, [OWNER_EMAIL]);
    const owner = ownerResult.rows[0];
    assert("owner AdminUser exists", Boolean(owner));
    assert("owner email matches", owner.email === OWNER_EMAIL);
    assert("owner status is active", owner.status === "active");
    assert("owner bootstrapSafe remains true", owner.bootstrapSafe === true);
    const ownerRoles = await ownerRoleKeys(client, owner.id);
    assert("owner has owner_admin role", ownerRoles.some((role)=>role.key === "owner_admin" && role.status === "active"));
    const conflict = await client.query(`SELECT id,email FROM "AdminUser" WHERE "normalizedUsername" = $1 AND id <> $2 LIMIT 1`, [OWNER_NORMALIZED_USERNAME, owner.id]);
    assert("owner normalized username has no conflicting AdminUser", conflict.rows.length === 0);
    if(apply){
      const hash = await bcrypt.hash(password, 12);
      const updatedResult = await client.query(`UPDATE "AdminUser" SET username = $1, "normalizedUsername" = $2, "passwordHash" = $3, "passwordSetAt" = CURRENT_TIMESTAMP, "passwordChangeRequired" = true, "failedLoginCount" = 0, "lastFailedLoginAt" = NULL, "twoFactorRequired" = false, "twoFactorMethod" = NULL, "twoFactorConfiguredAt" = NULL, "updatedAt" = CURRENT_TIMESTAMP WHERE id = $4 RETURNING *`, [OWNER_USERNAME, OWNER_NORMALIZED_USERNAME, hash, owner.id]);
      const updated = updatedResult.rows[0];
      assert("owner username set", updated.username === OWNER_USERNAME);
      assert("owner normalized username set", updated.normalizedUsername === OWNER_NORMALIZED_USERNAME);
      assert("owner passwordHash stored as bcrypt hash", typeof updated.passwordHash === "string" && updated.passwordHash.startsWith("$2"));
      assert("owner raw password is not stored", updated.passwordHash !== password);
      assert("owner passwordSetAt set", Boolean(updated.passwordSetAt));
      assert("owner passwordChangeRequired true", updated.passwordChangeRequired === true);
      assert("owner failedLoginCount reset", updated.failedLoginCount === 0);
      assert("owner remains active", updated.status === "active");
      assert("owner remains bootstrapSafe", updated.bootstrapSafe === true);
      const updatedRoles = await ownerRoleKeys(client, updated.id);
      assert("owner remains owner_admin", updatedRoles.some((role)=>role.key === "owner_admin" && role.status === "active"));
    }
    const janeResult = await client.query(`SELECT * FROM "AdminUser" WHERE email = $1 LIMIT 1`, ["jane.doe.limited@example.com"]);
    const jane = janeResult.rows[0];
    assert("Jane Doe AdminUser exists for later deliberate test", Boolean(jane));
    assert("Jane Doe remains not bootstrapSafe", jane.bootstrapSafe === false);
    const janeRoles = await ownerRoleKeys(client, jane.id);
    assert("Jane Doe remains not owner_admin", janeRoles.some((role)=>role.key === "owner_admin") === false);
    assert("Jane Doe has no passwordHash in Phase 12F", jane.passwordHash === null);
    assert("Jane Doe has no username in Phase 12F", jane.username === null);
    await client.query("COMMIT");
    console.log(apply ? "PASS: owner credential bootstrap applied safely without enabling login/enforcement." : "PASS: owner credential bootstrap precheck passed.");
  } catch(error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}
main().catch((error)=>{ console.error("FAIL:", error.message || error); process.exit(1); });
