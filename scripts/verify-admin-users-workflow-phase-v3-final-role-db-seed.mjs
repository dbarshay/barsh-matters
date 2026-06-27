import fs from "node:fs";

const failures = [];
const read = (path) => fs.readFileSync(path, "utf8");
const has = (text, token) => text.includes(token);
const must = (ok, message) => { if (ok) console.log("PASS:", message); else { console.error("FAIL:", message); failures.push(message); } };

const script = read("scripts/apply-admin-users-phase-v3-final-role-db-seed.mjs");
const doc = read("docs/admin-users/admin-users-phase-v3-final-role-db-seed.md");
const proof = JSON.parse(read("docs/admin-users/admin-users-phase-v3-final-role-db-seed.json"));
const session = read("app/api/auth/session/route.ts");
const pkg = JSON.parse(read("package.json"));

console.log("RUN: Admin Users Phase V3 final role DB seed verifier");

must(has(script, 'import fs from "node:fs"'), "seed script imports fs for local env loading");
must(has(script, "loadPhaseV3EnvFiles"), "seed script loads local env files");
must(has(script, "PHASE_V3_ENV_FILES_LOADED"), "seed script reports env file loading without printing secrets");
must(has(script, 'import { PrismaClient } from "@prisma/client"'), "seed script imports Prisma client");
must(has(script, 'import { PrismaNeon } from "@prisma/adapter-neon"'), "seed script imports Neon adapter");
must(has(script, 'import { Pool } from "@neondatabase/serverless"'), "seed script imports Neon pool");
must(!has(script, "../lib/prisma.ts"), "seed script avoids app prisma helper server-only import");
must(has(script, "new PrismaClient({ adapter })"), "seed script constructs Prisma with adapter");
must(has(script, "APPLY_FLAG"), "seed script has explicit apply flag");
must(has(script, "--apply-admin-users-phase-v3-final-role-db-seed"), "seed script apply flag is correct");
must(has(script, "PREVIEW_ONLY=true"), "seed script supports preview mode");
must(has(script, "adminRole.upsert"), "seed script uses upsert for role rows");
must(has(script, "OWNER_EMAIL"), "seed script checks owner email");
must(has(script, "ownerHasOwnerRoleBefore"), "seed script checks owner role before apply");
must(has(script, "ownerHasOwnerRoleAfter"), "seed script records owner role after apply");
must(has(script, "LEGACY_ROLES_TO_PRESERVE"), "seed script preserves legacy roles");
must(has(script, "deactivatesLegacyRoles: false"), "seed script declares legacy roles are not deactivated");
must(has(script, "changesPermissionEnforcement: false"), "seed script declares enforcement unchanged");
must(has(script, "changesTwoFactor: false"), "seed script declares 2FA unchanged");
must(has(script, "changesPasswords: false"), "seed script declares passwords unchanged");
must(has(script, "changesSessions: false"), "seed script declares sessions unchanged");

for (const roleKey of ["owner_admin", "administrator", "full_user", "basic_user", "view_only"]) {
  must(has(script, `key: "${roleKey}"`), `seed script contains role ${roleKey}`);
  must(proof.finalRoleKeys.includes(roleKey), `proof JSON contains role ${roleKey}`);
}

must(!has(script, "adminUser.create"), "seed script does not create users");
must(!has(script, "adminUser.delete"), "seed script does not delete users");
must(!has(script, "adminRole.delete"), "seed script does not delete roles");
must(!has(script, "adminUserRole.delete"), "seed script does not delete user-role assignments");
must(!has(script, "adminUserRole.create"), "seed script does not assign user roles");
must(!has(script, "adminUser.update"), "seed script does not update users");

must(has(doc, "guarded DB seed update phase"), "doc marks guarded seed update phase");
must(has(doc, "Runtime permission enforcement is not enabled"), "doc preserves enforcement non-activation");
must(proof.runtimeEnforcementChanged === false, "proof says runtime enforcement unchanged");
must(proof.sessionBehaviorChanged === false, "proof says session unchanged");
must(proof.deletesLegacyRoles === false, "proof says legacy roles not deleted");
must(proof.deactivatesLegacyRoles === false, "proof says legacy roles not deactivated");
must(has(session, 'permissionsMode: "default-admin-allow-all"'), "session remains default-admin-allow-all");
must(pkg.scripts?.["apply:admin-users-phase-v3-final-role-db-seed"] === "node scripts/apply-admin-users-phase-v3-final-role-db-seed.mjs", "package seed script registered");
must(pkg.scripts?.["verify:admin-users-workflow-phase-v3-final-role-db-seed"] === "node scripts/verify-admin-users-workflow-phase-v3-final-role-db-seed.mjs", "package verifier script registered");

if (failures.length) { console.error(""); console.error("FAILURES=" + failures.length); process.exit(1); }
console.log("FAILURES=0");
console.log("PASS: Admin Users Phase V3 final-role DB seed path is verifier-locked without runtime enforcement changes.");
