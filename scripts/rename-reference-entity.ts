// Rename a ReferenceEntity's display name (and its normalizedName) in place — for cases the CSV
// importer can't handle (a rename whose normalized form differs from the original, which the importer
// would treat as a new create). Aliases and details are preserved.
//
// Usage: npx tsx scripts/rename-reference-entity.ts <type> "<current display>" "<new display>"
//   e.g. npx tsx scripts/rename-reference-entity.ts closed_reason "POLICY EXHAUSTED/NO COVERAGE" "POLICY EXHAUSTED/NO COVERAGE/MVAIC"
//
// Run AFTER importing the seed (so aliases attach to the entity under its current name first).
import { existsSync, readFileSync } from "fs";
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
      const m = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!m) continue;
      let v = m[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (!process.env[m[1]]) process.env[m[1]] = v;
    }
  }
}
loadLocalEnvFiles();

const [type, oldName, newName] = process.argv.slice(2);
if (!type || !oldName || !newName) {
  console.error('Usage: npx tsx scripts/rename-reference-entity.ts <type> "<current>" "<new>"');
  process.exit(1);
}

const norm = (s: string) =>
  s.toLowerCase().replace(/[’']/g, "").replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();

const databaseUrl =
  process.env.DATABASE_URL || process.env.POSTGRES_DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING;
if (!databaseUrl) throw new Error("No Postgres database URL found.");
const pool = new Pool({ connectionString: databaseUrl });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool), log: ["error"] });

async function main() {
  const entity = await prisma.referenceEntity.findFirst({ where: { type, normalizedName: norm(oldName) } });
  if (!entity) {
    console.error(`No ${type} entity found matching "${oldName}" (normalized: "${norm(oldName)}")`);
    process.exitCode = 1;
    return;
  }
  const clash = await prisma.referenceEntity.findFirst({
    where: { type, normalizedName: norm(newName), id: { not: entity.id } },
  });
  if (clash) {
    console.error(`Another ${type} entity already normalizes to "${norm(newName)}" (id ${clash.id}) — aborting to avoid a merge.`);
    process.exitCode = 1;
    return;
  }
  const updated = await prisma.referenceEntity.update({
    where: { id: entity.id },
    data: { displayName: newName, normalizedName: norm(newName) },
  });
  console.log(`Renamed ${type} entity ${entity.id}:\n  "${entity.displayName}" → "${updated.displayName}"`);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); await pool.end(); });
