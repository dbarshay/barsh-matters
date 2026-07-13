// BACKFILL claim_number_normalized on existing matters.
//
// Why: the shared matter creator (lib/import/createMatters.ts) historically wrote only
// `claim_number_raw`, but the UI and search read `claim_number_normalized`. So every matter created by
// an import (Dow / Carisk / Other / bulk) has its claim number stored yet rendered blank ("—") on the
// matter screen and search results. createMatters.ts now writes both; this script repairs the rows that
// were created BEFORE that fix.
//
// Scope: only touches rows that have a claim_number_raw but a missing/empty claim_number_normalized.
// It never overwrites an existing normalized value. Dry-run by default; pass --yes to apply.
//
// Usage:
//   npx tsx scripts/backfill-claim-number-normalized.ts          # report only
//   npx tsx scripts/backfill-claim-number-normalized.ts --yes    # apply
//
// Mirrors the pg-adapter setup used by the other one-off scripts (avoids the server-only guard in
// lib/prisma.ts). Env precedence: .env.local overrides .env (matches Next.js).
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

// Kept in sync with normalizeClaimNumber() in lib/claimIndex.ts (copied rather than imported so this
// script doesn't pull in lib/prisma.ts and its server-only guard).
function normalizeClaimNumber(value: any) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, "")
    .toUpperCase();
}

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

const CHUNK = 500;

async function main() {
  const candidates = await prisma.claimIndex.findMany({
    where: {
      claim_number_raw: { not: null },
      OR: [{ claim_number_normalized: null }, { claim_number_normalized: "" }],
    },
    select: { matter_id: true, display_number: true, claim_number_raw: true, import_batch: true },
  });

  const fixable = candidates.filter((r) => normalizeClaimNumber(r.claim_number_raw).length > 0);

  console.log(`Matters with a claim number but no normalized value: ${candidates.length}`);
  console.log(`  repairable (raw normalizes to a non-empty value): ${fixable.length}`);
  for (const r of fixable.slice(0, 10)) {
    console.log(`    ${r.display_number}  ${r.claim_number_raw} -> ${normalizeClaimNumber(r.claim_number_raw)}${r.import_batch ? `  [${r.import_batch}]` : ""}`);
  }
  if (fixable.length > 10) console.log(`    … and ${fixable.length - 10} more`);

  if (!apply) {
    console.log("\nDRY RUN — nothing written. Re-run with --yes to apply.");
    return;
  }

  let updated = 0;
  for (let i = 0; i < fixable.length; i += CHUNK) {
    for (const r of fixable.slice(i, i + CHUNK)) {
      await prisma.claimIndex.update({
        where: { matter_id: r.matter_id },
        data: { claim_number_normalized: normalizeClaimNumber(r.claim_number_raw) },
      });
      updated += 1;
    }
    console.log(`  updated ${Math.min(i + CHUNK, fixable.length)} / ${fixable.length}…`);
  }

  console.log(`\nDone. Backfilled ${updated} matters — their claim numbers will now show in the UI and search.`);
}

main()
  .catch((err) => {
    console.error("backfill failed:", err?.message || err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
