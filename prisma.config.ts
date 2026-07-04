import fs from "fs";
import path from "path";
import { defineConfig } from "prisma/config";

function loadLocalEnvFile(fileName: string) {
  const filePath = path.join(process.cwd(), fileName);
  if (!fs.existsSync(filePath)) return;

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex === -1) continue;

    const key = trimmed.slice(0, equalsIndex).trim();
    let value = trimmed.slice(equalsIndex + 1).trim();

    value = value.replace(/^['"]|['"]$/g, "");

    if (key && process.env[key] == null) {
      process.env[key] = value;
    }
  }
}

loadLocalEnvFile(".env.local");
loadLocalEnvFile(".env");

const databaseUrl =
  process.env.POSTGRES_DATABASE_URL_UNPOOLED ||
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("No database URL found for Prisma.");
}

// Optional shadow database used by `prisma migrate dev` / `migrate diff --from-migrations`.
// Neon cannot auto-create a shadow DB, so point this at a dedicated empty Neon branch/database
// (use its DIRECT / unpooled connection string). Prisma fully resets the shadow DB on every run,
// so it must be a throwaway — never your real data. Left unset, schema work uses `db push` instead.
const shadowDatabaseUrl =
  process.env.SHADOW_DATABASE_URL_UNPOOLED ||
  process.env.SHADOW_DATABASE_URL;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: databaseUrl,
    ...(shadowDatabaseUrl ? { shadowDatabaseUrl } : {}),
  },
});
