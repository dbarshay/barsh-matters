// BULK-LOAD CLEANUP — removes everything the one-time NF bulk import created, so a trial run can be
// re-run from a clean slate. Scoped STRICTLY to the bulk batch: it only ever touches
//   - ClaimIndex rows tagged import_batch = "nf-legacy"
//   - Lawsuit rows tagged clioMasterMappingSource = "none-nf-bulk-import"
//   - Patient rows with source = "nf-legacy" that are left with zero matters
// It cannot affect live Dow/Carisk/Other data. Dry-run by default; pass --yes to actually delete.
//
// Usage:
//   npx tsx scripts/bulk-cleanup.ts          # dry run — just prints what WOULD be deleted
//   npx tsx scripts/bulk-cleanup.ts --yes     # actually delete
//
// Mirrors the pg-adapter setup used by the other one-off scripts (avoids the server-only guard in
// lib/prisma.ts). Env precedence: .env.local overrides .env (matches Next.js).
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const IMPORT_BATCH_TAG = "nf-legacy";
const LAWSUIT_TAG = "none-nf-bulk-import";

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

const apply = process.argv.includes("--yes");

const databaseUrl =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_DATABASE_URL_UNPOOLED ||
  process.env.POSTGRES_URL_NON_POOLING;
if (!databaseUrl) throw new Error("No Postgres database URL found.");

const pool = new Pool({ connectionString: databaseUrl });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool), log: ["error"] });

async function main() {
  const matters = await prisma.claimIndex.count({ where: { import_batch: IMPORT_BATCH_TAG } });
  const lawsuits = await prisma.lawsuit.count({ where: { clioMasterMappingSource: LAWSUIT_TAG } });
  const orphanPatients = await prisma.patient.count({
    where: { source: IMPORT_BATCH_TAG, matters: { none: {} } },
  });
  // Patients that WOULD be orphaned once the matters are deleted (all nf-legacy patients, since their
  // only matters are in this batch). Reported so the dry run shows the true post-delete number.
  const legacyPatients = await prisma.patient.count({ where: { source: IMPORT_BATCH_TAG } });

  console.log(`Bulk batch "${IMPORT_BATCH_TAG}" currently holds:`);
  console.log(`  ClaimIndex matters : ${matters}`);
  console.log(`  Lawsuits           : ${lawsuits}`);
  console.log(`  nf-legacy patients : ${legacyPatients} (currently orphaned: ${orphanPatients})`);

  if (!apply) {
    console.log("\nDRY RUN — nothing deleted. Re-run with --yes to delete the above.");
    return;
  }

  console.log("\nDeleting…");
  const delMatters = await prisma.claimIndex.deleteMany({ where: { import_batch: IMPORT_BATCH_TAG } });
  const delLawsuits = await prisma.lawsuit.deleteMany({ where: { clioMasterMappingSource: LAWSUIT_TAG } });
  const delPatients = await prisma.patient.deleteMany({
    where: { source: IMPORT_BATCH_TAG, matters: { none: {} } },
  });
  const undone = await prisma.importBatch.updateMany({
    where: { source: "bulk", status: "committed" },
    data: { status: "undone" },
  });

  console.log(`  Removed matters  : ${delMatters.count}`);
  console.log(`  Removed lawsuits : ${delLawsuits.count}`);
  console.log(`  Removed patients : ${delPatients.count}`);
  console.log(`  Batches marked undone: ${undone.count}`);
  console.log("\nDone. You can re-run the bulk trial from a clean slate.");
}

main()
  .catch((err) => {
    console.error("bulk-cleanup failed:", err?.message || err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
