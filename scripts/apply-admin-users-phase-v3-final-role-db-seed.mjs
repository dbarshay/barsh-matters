import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { Pool } from "@neondatabase/serverless";

function loadPhaseV3EnvFiles() {
  const envFiles = [".env", ".env.local", ".env.development.local", ".env.production.local"];
  const loaded = [];
  for (const file of envFiles) {
    const fullPath = path.resolve(process.cwd(), file);
    if (!fs.existsSync(fullPath)) continue;
    const text = fs.readFileSync(fullPath, "utf8");
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!match) continue;
      const key = match[1];
      let value = match[2].trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
    loaded.push(file);
  }
  console.log("PHASE_V3_ENV_FILES_LOADED=" + (loaded.length ? loaded.join(",") : "none"));
}

loadPhaseV3EnvFiles();

const APPLY_FLAG = "--apply-admin-users-phase-v3-final-role-db-seed";
const OWNER_EMAIL = "dbarshay15@gmail.com";

const FINAL_ROLES = [
  { key: "owner_admin", label: "Owner", description: "Everything. Full application access, all Admin cards, user role password security controls, and owner no-lockout protection.", status: "active", systemRole: true },
  { key: "administrator", label: "Administrator", description: "Full non-admin app access. Admin access is selected card by card.", status: "active", systemRole: true },
  { key: "full_user", label: "Full User", description: "Full non-admin app access, including payment functions. No Admin screen.", status: "active", systemRole: true },
  { key: "basic_user", label: "Basic User", description: "Full non-admin app access except payment billing payment-status functions. No Admin screen.", status: "active", systemRole: true },
  { key: "view_only", label: "View Only", description: "Can view all non-admin screens, but cannot mutate anything. No Admin screen.", status: "active", systemRole: true }
];

const LEGACY_ROLES_TO_PRESERVE = ["operations_admin", "billing_admin", "read_only_admin"];

function createPrismaForPhaseV3() {
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL, POSTGRES_PRISMA_URL, or POSTGRES_URL is required for Phase V3.");
  }
  const pool = new Pool({ connectionString });
  const adapter = new PrismaNeon(pool);
  const prisma = new PrismaClient({ adapter });
  return { prisma, pool };
}

async function main() {
  const apply = process.argv.includes(APPLY_FLAG);
  const { prisma, pool } = createPrismaForPhaseV3();

  try {
    console.log("RUN: Admin Users Phase V3 final role DB seed");
    console.log("MODE=" + (apply ? "apply" : "preview"));

    const owner = await prisma.adminUser.findUnique({
      where: { email: OWNER_EMAIL },
      include: { roles: { include: { role: true } } },
    });

    const ownerHasOwnerRoleBefore = Boolean(
      owner && owner.roles && owner.roles.some((entry) => entry.role && entry.role.key === "owner_admin" && entry.role.status === "active")
    );

    if (!ownerHasOwnerRoleBefore) {
      throw new Error("Owner must have active owner_admin role before Phase V3.");
    }

    const existingRoles = await prisma.adminRole.findMany({
      where: { key: { in: FINAL_ROLES.map((role) => role.key).concat(LEGACY_ROLES_TO_PRESERVE) } },
      orderBy: { key: "asc" },
      include: { permissions: true },
    });

    const existingByKey = new Map(existingRoles.map((role) => [role.key, role]));
    const plan = FINAL_ROLES.map((role) => ({
      key: role.key,
      label: role.label,
      exists: existingByKey.has(role.key),
      action: existingByKey.has(role.key) ? "upsert-update" : "upsert-create",
    }));

    const preview = {
      ok: true,
      phase: "admin-users-phase-v3-final-role-db-seed",
      mode: apply ? "apply" : "preview",
      runtimeEnforcementChanged: false,
      sessionBehaviorChanged: false,
      finalRoleCount: FINAL_ROLES.length,
      ownerEmail: OWNER_EMAIL,
      ownerHasOwnerRoleBefore,
      plan,
      legacyRolesPreserved: LEGACY_ROLES_TO_PRESERVE,
      safety: {
        createsUsers: false,
        deletesUsers: false,
        deletesRoles: false,
        deactivatesLegacyRoles: false,
        changesPermissionEnforcement: false,
        changesTwoFactor: false,
        changesPasswords: false,
        changesSessions: false,
        changesClio: false,
        changesDocuments: false,
        changesPrintQueue: false,
      },
    };

    console.log("PHASE_V3_PREVIEW=" + JSON.stringify(preview, null, 2));

    if (!apply) {
      console.log("PREVIEW_ONLY=true");
      return;
    }

    const savedRoles = await prisma.$transaction(async (tx) => {
      const saved = [];

      for (const role of FINAL_ROLES) {
        const row = await tx.adminRole.upsert({
          where: { key: role.key },
          update: {
            label: role.label,
            description: role.description,
            status: role.status,
            systemRole: role.systemRole,
            updatedAt: new Date(),
          },
          create: {
            key: role.key,
            label: role.label,
            description: role.description,
            status: role.status,
            systemRole: role.systemRole,
          },
        });

        saved.push({
          key: row.key,
          label: row.label,
          status: row.status,
          systemRole: row.systemRole,
        });
      }

      const refreshedOwner = await tx.adminUser.findUnique({
        where: { email: OWNER_EMAIL },
        include: { roles: { include: { role: true } } },
      });

      const ownerStillSafe = Boolean(
        refreshedOwner && refreshedOwner.roles && refreshedOwner.roles.some((entry) => entry.role && entry.role.key === "owner_admin" && entry.role.status === "active")
      );

      if (!ownerStillSafe) {
        throw new Error("Owner lost active owner_admin role during Phase V3.");
      }

      return saved;
    });

    console.log("PHASE_V3_APPLY_RESULT=" + JSON.stringify({
      ok: true,
      phase: "admin-users-phase-v3-final-role-db-seed",
      mode: "apply",
      runtimeEnforcementChanged: false,
      sessionBehaviorChanged: false,
      databaseMutated: true,
      finalRolesSeeded: savedRoles,
      ownerHasOwnerRoleAfter: true,
    }, null, 2));

    console.log("PASS: Phase V3 final roles are seeded or updated.");
  } finally {
    await prisma.$disconnect();
    if (pool && typeof pool.end === "function") {
      await pool.end();
    }
  }
}

main().catch((error) => {
  console.error("FAIL: Admin Users Phase V3 final role DB seed failed.");
  console.error(error && (error.stack || error.message) || String(error));
  process.exit(1);
});
