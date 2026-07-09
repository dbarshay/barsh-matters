// Export the current canonical DenialReason reference set (ReferenceEntity type="denial_reason")
// plus their aliases, to docs/denial-reason-canonical-export.csv.
//
// Usage: npx tsx scripts/export-denial-reason-reference.ts
//
// Read-only. Writes one CSV. Mirrors the pg-adapter setup used by other one-off scripts so it
// works from a plain `tsx` invocation (avoids the server-only guard in lib/prisma.ts).
import { existsSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

function loadLocalEnvFiles() {
  // Next.js precedence: .env.local (and *.development.local) override .env. First-writer-wins below,
  // so list the higher-precedence files FIRST — otherwise a stale DATABASE_URL in .env would win.
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
    where: { type: "denial_reason" },
    include: { aliases: true },
    orderBy: { displayName: "asc" },
  });

  const rows = [["displayName", "active", "aliases", "notes", "details"]];
  for (const e of entities) {
    const aliases = e.aliases.map((a) => a.alias).sort().join(";");
    const details = e.details == null ? "" : JSON.stringify(e.details);
    rows.push([e.displayName, String(e.active), aliases, e.notes ?? "", details]);
  }

  const outPath = resolve(process.cwd(), "docs/denial-reason-canonical-export.csv");
  writeFileSync(outPath, rows.map((r) => r.map(csvCell).join(",")).join("\n") + "\n", "utf8");

  console.log(`Wrote ${entities.length} canonical denial_reason entities → ${outPath}`);
  const hasLack = entities.some((e) => /lack of medical necessity/i.test(e.displayName));
  console.log(`"Lack of Medical Necessity" present as a displayName: ${hasLack ? "YES" : "NO"}`);

  console.log("\nAll canonical displayNames (with alias count + details):");
  for (const e of entities) {
    console.log(`  - ${e.displayName}${e.active ? "" : " (inactive)"}  [${e.aliases.length} aliases]`);
  }

  // Surface hidden/details values — the seed must not clobber these and they may carry legacy mapping.
  const withDetails = entities.filter((e) => e.details != null);
  console.log(`\nEntities carrying a details JSON: ${withDetails.length}/${entities.length}`);
  for (const e of withDetails) {
    console.log(`  • ${e.displayName}: ${JSON.stringify(e.details)}`);
  }
  if (withDetails.length === 0) {
    console.log("  (none — no hidden _hiddenImportFields on any denial_reason entity)");
  }
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
