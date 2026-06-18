#!/usr/bin/env node
const fs = require("fs");
function read(path){ if(fs.existsSync(path) === false){ console.error("FAIL missing "+path); process.exit(1); } return fs.readFileSync(path,"utf8"); }
function assert(label, ok){ if(ok === false){ console.error("FAIL: "+label); process.exit(1); } console.log("PASS: "+label); }
console.log("RUN: Phase 12E AdminUser credential schema fields safety verifier");
console.log("Schema/migration only: validates credential storage fields exist while login, session binding, and permission enforcement remain unchanged. Dependency checks are delegated to later phase verifiers once later phases begin.");
const pkg = JSON.parse(read("package.json"));
const schema = read("prisma/schema.prisma");
const migration = read("prisma/migrations/20260618095000_add_admin_user_credential_fields/migration.sql");
const login = read("app/api/auth/login/route.ts");
const session = read("app/api/auth/session/route.ts");
const adminAuth = read("lib/adminAuth.ts");
const permissions = read("lib/adminPermissions.ts");
const adminUser = (schema.match(/model AdminUser \{[\s\S]*?\n\}/)||[""])[0];
assert("package script registered for Phase 12E", pkg.scripts && pkg.scripts["verify:admin-users-phase12e-credential-schema-fields-safety"] === "node scripts/verify-admin-users-phase12e-credential-schema-fields-safety.cjs");
assert("AdminUser model exists", adminUser.length > 0);
["email                  String    @unique","username               String?","normalizedUsername     String?   @unique","passwordHash           String?","passwordSetAt          DateTime?","passwordChangeRequired Boolean   @default(false)","lastLoginAt            DateTime?","lastFailedLoginAt      DateTime?","failedLoginCount       Int       @default(0)","twoFactorRequired      Boolean   @default(false)","twoFactorMethod        String?","twoFactorConfiguredAt  DateTime?","bootstrapSafe          Boolean   @default(false)","roles               AdminUserRole[]","permissionOverrides AdminUserPermissionOverride[]","@@index([status])","@@index([username])","@@index([passwordChangeRequired])","@@index([lastLoginAt])"].forEach((text)=>assert("AdminUser schema contains "+text, adminUser.includes(text)));
["ALTER TABLE \"AdminUser\" ADD COLUMN \"username\" TEXT;","ALTER TABLE \"AdminUser\" ADD COLUMN \"normalizedUsername\" TEXT;","ALTER TABLE \"AdminUser\" ADD COLUMN \"passwordHash\" TEXT;","ALTER TABLE \"AdminUser\" ADD COLUMN \"passwordSetAt\" TIMESTAMP(3);","ALTER TABLE \"AdminUser\" ADD COLUMN \"passwordChangeRequired\" BOOLEAN NOT NULL DEFAULT false;","ALTER TABLE \"AdminUser\" ADD COLUMN \"lastLoginAt\" TIMESTAMP(3);","ALTER TABLE \"AdminUser\" ADD COLUMN \"lastFailedLoginAt\" TIMESTAMP(3);","ALTER TABLE \"AdminUser\" ADD COLUMN \"failedLoginCount\" INTEGER NOT NULL DEFAULT 0;","ALTER TABLE \"AdminUser\" ADD COLUMN \"twoFactorRequired\" BOOLEAN NOT NULL DEFAULT false;","ALTER TABLE \"AdminUser\" ADD COLUMN \"twoFactorMethod\" TEXT;","ALTER TABLE \"AdminUser\" ADD COLUMN \"twoFactorConfiguredAt\" TIMESTAMP(3);","CREATE UNIQUE INDEX \"AdminUser_normalizedUsername_key\" ON \"AdminUser\"(\"normalizedUsername\");","CREATE INDEX \"AdminUser_username_idx\" ON \"AdminUser\"(\"username\");","CREATE INDEX \"AdminUser_passwordChangeRequired_idx\" ON \"AdminUser\"(\"passwordChangeRequired\");","CREATE INDEX \"AdminUser_lastLoginAt_idx\" ON \"AdminUser\"(\"lastLoginAt\");"].forEach((text)=>assert("migration contains "+text, migration.includes(text)));
assert("legacy gate cookie remains", adminAuth.includes("barsh_admin_gate"));
assert("identity cookie remains separate", adminAuth.includes("barsh_admin_identity"));
assert("BARSH_ADMIN_PASSWORD support remains", adminAuth.includes("BARSH_ADMIN_PASSWORD"));
assert("login route remains password-only and does not accept username yet", login.includes("body?.password") && /body\?\.(username|email|adminEmail|userEmail)/.test(login) === false);
assert("login route does not use passwordHash yet", /passwordHash|bcrypt|bcryptjs|argon2/i.test(login) === false);
assert("session route remains passive diagnostics", session.includes("identityDiagnostics"));
assert("session route does not bind AdminUser.id yet", /prisma\.adminUser|adminUser\.find|adminUserId|userId.*identity|identity.*userId/i.test(session) === false);
assert("permission never-block route /admin remains present", permissions.includes("/admin"));
assert("permission never-block route /admin/permissions remains present", permissions.includes("/admin/permissions"));
assert("permission never-block route /api/admin/permissions remains present", permissions.includes("/api/admin/permissions"));
assert("permission never-block route /api/admin/permissions/check remains present", permissions.includes("/api/admin/permissions/check"));
console.log("CONTRACT: Phase 12E adds nullable/safe AdminUser credential fields and migration only.");
console.log("CONTRACT: Phase 12E still does not enable username login, owner bootstrap behavior, session-bound user identity, or permission enforcement.");
console.log("PASS: Phase 12E credential schema fields remain locked as schema/migration only.");
