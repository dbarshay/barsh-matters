import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { Pool } from "@neondatabase/serverless";

const APPLY_FLAG = "--apply-delete-jane-assign-tara-admin";
const JANE_EMAIL = "jane.doe.limited@example.com";
const OWNER_EMAIL = "dbarshay15@gmail.com";
const TARGET_ROLE_KEY = "administrator";

function loadEnvFiles() {
  const envFiles = [".env", ".env.local", ".env.development.local", ".env.production.local"];
  const loaded = [];
  for (const file of envFiles) {
    const fullPath = path.resolve(process.cwd(), file);
    if (!fs.existsSync(fullPath)) continue;
    const content = fs.readFileSync(fullPath, "utf8");
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!match) continue;
      const key = match[1];
      let value = match[2].trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
      if (process.env[key] === undefined) process.env[key] = value;
    }
    loaded.push(file);
  }
  console.log("ENV_FILES_LOADED=" + (loaded.length ? loaded.join(",") : "none"));
}

function createPrisma() {
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL;
  if (!connectionString) throw new Error("DATABASE_URL, POSTGRES_PRISMA_URL, or POSTGRES_URL is required.");
  const pool = new Pool({ connectionString });
  const adapter = new PrismaNeon(pool);
  const prisma = new PrismaClient({ adapter });
  return { prisma, pool };
}

function roleKeys(user) {
  return (user?.roles || []).map((entry) => entry.role?.key).filter(Boolean).sort();
}

function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    displayName: user.displayName,
    username: user.username,
    status: user.status,
    bootstrapSafe: Boolean(user.bootstrapSafe),
    roleKeys: roleKeys(user),
  };
}

async function main() {
  loadEnvFiles();
  const apply = process.argv.includes(APPLY_FLAG);
  const { prisma, pool } = createPrisma();

  try {
    console.log("RUN: Delete Jane Doe and assign Tara Luisi Administrator");
    console.log("MODE=" + (apply ? "apply" : "preview"));

    const [owner, administratorRole, jane, taraCandidates] = await Promise.all([
      prisma.adminUser.findUnique({
        where: { email: OWNER_EMAIL },
        include: { roles: { include: { role: true } } },
      }),
      prisma.adminRole.findUnique({ where: { key: TARGET_ROLE_KEY } }),
      prisma.adminUser.findUnique({
        where: { email: JANE_EMAIL },
        include: { roles: { include: { role: true } }, permissionOverrides: true },
      }),
      prisma.adminUser.findMany({
        where: {
          OR: [
            { email: { contains: "tara", mode: "insensitive" } },
            { email: { contains: "luisi", mode: "insensitive" } },
            { firstName: { equals: "Tara", mode: "insensitive" } },
            { lastName: { equals: "Luisi", mode: "insensitive" } },
            { displayName: { contains: "Tara Luisi", mode: "insensitive" } },
            { username: { contains: "tluisi", mode: "insensitive" } },
          ],
        },
        include: { roles: { include: { role: true } }, permissionOverrides: true },
        orderBy: [{ email: "asc" }],
      }),
    ]);

    if (!owner || !roleKeys(owner).includes("owner_admin")) {
      throw new Error("Owner must exist and retain owner_admin before this data update.");
    }

    if (!administratorRole || administratorRole.status !== "active") {
      throw new Error("administrator role must exist and be active before assignment.");
    }

    if (!jane) {
      throw new Error(`Jane Doe admin user ${JANE_EMAIL} was not found. Nothing was deleted.`);
    }

    if (jane.bootstrapSafe || roleKeys(jane).includes("owner_admin")) {
      throw new Error("Refusing to delete Jane because she is bootstrapSafe or owner_admin.");
    }

    const exactTaraCandidates = taraCandidates.filter((user) => {
      const first = String(user.firstName || "").toLowerCase();
      const last = String(user.lastName || "").toLowerCase();
      const display = String(user.displayName || "").toLowerCase();
      const email = String(user.email || "").toLowerCase();
      const username = String(user.username || "").toLowerCase();
      return (
        (first === "tara" && last === "luisi") ||
        display === "tara luisi" ||
        email.includes("tara") ||
        email.includes("luisi") ||
        username.includes("tluisi")
      );
    });

    if (exactTaraCandidates.length !== 1) {
      console.log("TARA_CANDIDATES=" + JSON.stringify(taraCandidates.map(publicUser), null, 2));
      throw new Error(`Expected exactly one Tara Luisi AdminUser candidate, found ${exactTaraCandidates.length}.`);
    }

    const tara = exactTaraCandidates[0];

    if (tara.status !== "active") {
      throw new Error(`Tara Luisi must be active before assigning administrator. Current status: ${tara.status}`);
    }

    if (tara.bootstrapSafe || roleKeys(tara).includes("owner_admin")) {
      throw new Error("Refusing to modify Tara because she is bootstrapSafe or owner_admin.");
    }

    const before = {
      jane: publicUser(jane),
      tara: publicUser(tara),
      administratorRole: {
        id: administratorRole.id,
        key: administratorRole.key,
        label: administratorRole.label,
        status: administratorRole.status,
      },
    };

    const preview = {
      ok: true,
      action: "delete-jane-assign-tara-admin",
      mode: apply ? "apply" : "preview",
      runtimeEnforcementChanged: false,
      sessionBehaviorChanged: false,
      before,
      planned: {
        deleteAdminUserEmail: JANE_EMAIL,
        assignRole: {
          email: tara.email,
          roleKey: TARGET_ROLE_KEY,
        },
      },
      safety: {
        ownerPreserved: true,
        refusesOwnerOrBootstrapDeletion: true,
        deletesJaneOnly: true,
        assignsTaraAdministratorOnly: true,
        changesPermissionEnforcement: false,
        changesSessions: false,
        changesPasswords: false,
        changesTwoFactor: false,
        changesClio: false,
        changesDocuments: false,
        changesPrintQueue: false,
      },
    };

    console.log("PREVIEW=" + JSON.stringify(preview, null, 2));

    if (!apply) {
      console.log("PREVIEW_ONLY=true");
      return;
    }

    const result = await prisma.$transaction(async (tx) => {
      await tx.adminUserPermissionOverride.deleteMany({ where: { userId: jane.id } });
      await tx.adminUserRole.deleteMany({ where: { userId: jane.id } });
      await tx.adminUser.delete({ where: { id: jane.id } });

      await tx.adminUserRole.upsert({
        where: {
          userId_roleId: {
            userId: tara.id,
            roleId: administratorRole.id,
          },
        },
        update: {},
        create: {
          userId: tara.id,
          roleId: administratorRole.id,
        },
      });

      const [janeAfter, taraAfter, ownerAfter] = await Promise.all([
        tx.adminUser.findUnique({ where: { email: JANE_EMAIL } }),
        tx.adminUser.findUnique({
          where: { id: tara.id },
          include: { roles: { include: { role: true } }, permissionOverrides: true },
        }),
        tx.adminUser.findUnique({
          where: { email: OWNER_EMAIL },
          include: { roles: { include: { role: true } } },
        }),
      ]);

      if (janeAfter) throw new Error("Jane still exists after delete.");
      if (!taraAfter || !roleKeys(taraAfter).includes("administrator")) throw new Error("Tara does not have administrator after apply.");
      if (!ownerAfter || !roleKeys(ownerAfter).includes("owner_admin")) throw new Error("Owner lost owner_admin after apply.");

      return {
        janeDeleted: true,
        tara: publicUser(taraAfter),
        ownerSafe: true,
      };
    });

    console.log("APPLY_RESULT=" + JSON.stringify({
      ok: true,
      action: "delete-jane-assign-tara-admin",
      mode: "apply",
      runtimeEnforcementChanged: false,
      sessionBehaviorChanged: false,
      databaseMutated: true,
      result,
    }, null, 2));

    console.log("PASS: Jane Doe deleted and Tara Luisi assigned Administrator.");
  } finally {
    await prisma.$disconnect();
    if (pool && typeof pool.end === "function") await pool.end();
  }
}

main().catch((error) => {
  console.error("FAIL: delete Jane / assign Tara admin failed.");
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
