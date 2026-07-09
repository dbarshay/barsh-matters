// Delete leftover test/junk rows from the "Settlement Contacts" (individual) reference list —
// the import-smoke test entities, NOT real contacts. Dry-run by default; pass --apply to delete.
//
// Usage:
//   npx tsx scripts/cleanup-test-individuals.ts            # dry-run (lists candidates)
//   npx tsx scripts/cleanup-test-individuals.ts --apply    # actually delete (aliases first, then entity)
//
// Safety: only matches INACTIVE rows whose displayName looks like a test fixture AND whose details
// carry no settledWith flag, so real settled-with contacts can never be caught.
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

function loadLocalEnvFiles() {
  for (const filename of [".env.development.local", ".env.local", ".env"]) {
    const fp = resolve(process.cwd(), filename);
    if (!existsSync(fp)) continue;
    for (const line of readFileSync(fp, "utf8").split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const m = t.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!m) continue;
      let v = m[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (!process.env[m[1]]) process.env[m[1]] = v;
    }
  }
}
loadLocalEnvFiles();

const APPLY = process.argv.includes("--apply");
const TEST_NAME = /^Import (Commit Smoke|Confirm Test) \d+$/i;
const EXACT_TEST = new Set(["test individual"]);

const databaseUrl =
  process.env.DATABASE_URL || process.env.POSTGRES_DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING;
if (!databaseUrl) throw new Error("No Postgres database URL found.");
const pool = new Pool({ connectionString: databaseUrl });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool), log: ["error"] });

function isSettledWith(details: unknown): boolean {
  return !!(details && typeof details === "object" && (details as any).settledWith === true);
}

async function main() {
  const rows = await prisma.referenceEntity.findMany({
    where: { type: "individual", active: false },
    include: { aliases: true },
  });
  const targets = rows.filter(
    (e) => !isSettledWith(e.details) && (TEST_NAME.test(e.displayName) || EXACT_TEST.has(e.displayName.toLowerCase()))
  );

  if (targets.length === 0) {
    console.log("No test/junk individual rows found. Nothing to do.");
    return;
  }

  console.log(`${APPLY ? "DELETING" : "DRY-RUN — would delete"} ${targets.length} test individual row(s):`);
  for (const t of targets) console.log(`  - ${t.displayName}  (${t.aliases.length} aliases, id ${t.id})`);

  if (!APPLY) {
    console.log("\nRe-run with --apply to delete.");
    return;
  }

  for (const t of targets) {
    await prisma.referenceAlias.deleteMany({ where: { entityId: t.id } });
    await prisma.referenceEntity.delete({ where: { id: t.id } });
  }
  console.log(`\nDeleted ${targets.length} row(s) and their aliases.`);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); await pool.end(); });
