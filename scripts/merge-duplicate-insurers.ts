// One-time cleanup: two NF add-new insurers were created that turned out to be FORMER NAMES of
// existing canonical entities (same NAIC + same corporate group). This merges each duplicate into
// the correct existing entity — moving the duplicate's display name + aliases onto the target as
// aliases, then deleting the duplicate entity — so the old NF names still resolve but the duplicate
// NAIC is removed.
//
//   American Country Insurance Company      -> Curative Insurance Company of Illinois            (NAIC 38237)
//   American Modern Select Insurance Company -> Trusted Resource Underwriters Exchange of Ohio    (NAIC 38652)
//
// Usage:
//   npx tsx scripts/merge-duplicate-insurers.ts          # DRY RUN (shows the plan)
//   npx tsx scripts/merge-duplicate-insurers.ts --apply  # actually merge + delete
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

const APPLY = process.argv.includes("--apply");
const TYPE = "insurer_company";
const MERGES: Array<{ source: string; target: string }> = [
  { source: "American Country Insurance Company", target: "Curative Insurance Company of Illinois" },
  { source: "American Modern Select Insurance Company", target: "Trusted Resource Underwriters Exchange of Ohio" },
];

const norm = (s: string) =>
  s.toLowerCase().replace(/[’']/g, "").replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();

const databaseUrl =
  process.env.DATABASE_URL || process.env.POSTGRES_DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING;
if (!databaseUrl) throw new Error("No Postgres database URL found.");
const pool = new Pool({ connectionString: databaseUrl });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool), log: ["error"] });

async function mergeOne(sourceName: string, targetName: string) {
  const source = await prisma.referenceEntity.findFirst({
    where: { type: TYPE, normalizedName: norm(sourceName) },
    include: { aliases: true },
  });
  const target = await prisma.referenceEntity.findFirst({
    where: { type: TYPE, normalizedName: norm(targetName) },
    include: { aliases: true },
  });
  if (!source) { console.log(`  SKIP: source "${sourceName}" not found (already merged?)`); return; }
  if (!target) { console.error(`  ABORT: target "${targetName}" not found`); return; }

  // Alias candidates = the source's own display name + all of its existing aliases.
  const candidates = [source.displayName, ...source.aliases.map((a) => a.alias)];
  const existingOnTarget = new Set(target.aliases.map((a) => a.normalizedAlias));
  const toAdd = candidates.filter((c) => {
    const n = norm(c);
    return n && n !== target.normalizedName && !existingOnTarget.has(n);
  });

  console.log(`  "${source.displayName}" (id ${source.id}) -> "${target.displayName}" (id ${target.id})`);
  console.log(`    aliases to add to target: ${toAdd.length ? toAdd.map((a) => JSON.stringify(a)).join(", ") : "(none)"}`);
  console.log(`    will delete source entity + its ${source.aliases.length} alias row(s)`);

  if (!APPLY) return;

  for (const alias of toAdd) {
    const normalizedAlias = norm(alias);
    try {
      await prisma.referenceAlias.create({ data: { entityId: target.id, alias, normalizedAlias } });
      existingOnTarget.add(normalizedAlias);
    } catch (err: any) {
      if (err?.code === "P2002") { console.log(`    (alias "${alias}" already exists — skipped)`); }
      else throw err;
    }
  }
  await prisma.referenceAlias.deleteMany({ where: { entityId: source.id } });
  await prisma.referenceEntity.delete({ where: { id: source.id } });
  console.log(`    merged + deleted.`);
}

async function main() {
  console.log(`${APPLY ? "APPLYING" : "DRY RUN —"} merge of ${MERGES.length} duplicate insurer(s):\n`);
  for (const m of MERGES) await mergeOne(m.source, m.target);
  if (!APPLY) console.log(`\nRe-run with --apply to execute.`);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); await pool.end(); });
