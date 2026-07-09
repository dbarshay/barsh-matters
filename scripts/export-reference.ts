// Generalized canonical reference export. Dumps a ReferenceEntity type (+ aliases + details) to
// docs/<type>-canonical-export.csv and prints the full list, flagging any hidden _hiddenImportFields.
//
// Usage: npx tsx scripts/export-reference.ts <type>
//   e.g. npx tsx scripts/export-reference.ts closed_reason
//        npx tsx scripts/export-reference.ts adversary_attorney
//        npx tsx scripts/export-reference.ts transaction_status
//
// Read-only. Mirrors the pg-adapter setup used by other one-off scripts (avoids the server-only
// guard in lib/prisma.ts). Env precedence: .env.local overrides .env (matches Next.js).
import { existsSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

function loadLocalEnvFiles() {
  for (const filename of [".env.development.local", ".env.local", ".env"]) {
    const filePath = resolve(process.cwd(), filename);
    if (!existsSync(filePath)) continue;
    for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!match) continue;
      let value = match[2].trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!process.env[match[1]]) process.env[match[1]] = value;
    }
  }
}

loadLocalEnvFiles();

const type = process.argv[2];
if (!type) {
  console.error("Usage: npx tsx scripts/export-reference.ts <type>  (e.g. closed_reason)");
  process.exit(1);
}

const databaseUrl =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_DATABASE_URL_UNPOOLED ||
  process.env.POSTGRES_URL_NON_POOLING;
if (!databaseUrl) throw new Error("No Postgres database URL found.");

const pool = new Pool({ connectionString: databaseUrl });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool), log: ["error"] });

function csvCell(value: unknown): string {
  const s = String(value ?? "");
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function main() {
  const entities = await prisma.referenceEntity.findMany({
    where: { type },
    include: { aliases: true },
    orderBy: { displayName: "asc" },
  });

  const rows = [["displayName", "active", "aliases", "notes", "details"]];
  for (const e of entities) {
    const aliases = e.aliases.map((a) => a.alias).sort().join(";");
    const details = e.details == null ? "" : JSON.stringify(e.details);
    rows.push([e.displayName, String(e.active), aliases, e.notes ?? "", details]);
  }

  const outPath = resolve(process.cwd(), `docs/${type}-canonical-export.csv`);
  writeFileSync(outPath, rows.map((r) => r.map(csvCell).join(",")).join("\n") + "\n", "utf8");

  console.log(`Type "${type}": ${entities.length} canonical entities → ${outPath}\n`);
  for (const e of entities) console.log(`  - ${e.displayName}${e.active ? "" : " (inactive)"}  [${e.aliases.length} aliases]`);

  const withDetails = entities.filter((e) => e.details != null);
  console.log(`\nEntities carrying a details JSON: ${withDetails.length}/${entities.length}`);
  for (const e of withDetails) console.log(`  • ${e.displayName}: ${JSON.stringify(e.details)}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
