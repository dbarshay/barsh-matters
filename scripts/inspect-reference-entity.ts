// Dump the raw ReferenceEntity.details for a name match, so we can see exactly which keys hold the
// address / phone / email (and whether they're populated at all).
//
// Run:  npx tsx scripts/inspect-reference-entity.ts "Atlantic Medical"

import { readFileSync } from "node:fs";
import { Pool } from "pg";

function dbUrl(): string {
  for (const f of [".env.local", ".env"]) {
    try {
      const m = readFileSync(f, "utf8").match(/^DATABASE_URL=(.*)$/m);
      if (m) return m[1].trim().replace(/^["']|["']$/g, "");
    } catch {
      /* try next */
    }
  }
  return process.env.DATABASE_URL || "";
}

async function main() {
  const q = process.argv[2] || "Atlantic Medical";
  const pool = new Pool({ connectionString: dbUrl() });
  const r = await pool.query(
    `SELECT type, "displayName", active, details FROM "ReferenceEntity" WHERE "displayName" ILIKE $1 ORDER BY active DESC LIMIT 10`,
    [`%${q}%`],
  );
  if (!r.rows.length) console.log(`No ReferenceEntity matching %${q}%`);
  for (const row of r.rows) {
    console.log(`\ntype: ${row.type}  |  name: ${row.displayName}  |  active: ${row.active}`);
    console.log(`details keys: ${row.details ? Object.keys(row.details).join(", ") : "(null)"}`);
    console.log(JSON.stringify(row.details, null, 2));
  }
  await pool.end();
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
