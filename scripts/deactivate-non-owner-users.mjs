// One-time cleanup: deactivate (make inactive) every AdminUser except the owner.
//
// This is REVERSIBLE — it sets status='inactive', locked=true, inactive=true and appends a note.
// It does NOT delete anything. To permanently delete, use the owner-gated Delete button in the
// admin Users page instead.
//
// Usage (from the repo root, on a machine that can reach the Neon DB):
//   node scripts/deactivate-non-owner-users.mjs            # PREVIEW only — lists who would change
//   node scripts/deactivate-non-owner-users.mjs --apply    # actually deactivate the non-owner users
//   KEEP_EMAIL=you@example.com node scripts/deactivate-non-owner-users.mjs --apply
//
// The owner to KEEP defaults to dbarshay15@gmail.com; override with KEEP_EMAIL.

import fs from "node:fs";
import pg from "pg";

function readEnv(file, key) {
  try {
    const text = fs.readFileSync(file, "utf8");
    for (const line of text.split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && m[1] === key) {
        let v = m[2].trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
        return v;
      }
    }
  } catch {}
  return null;
}

const APPLY = process.argv.includes("--apply");
const KEEP = String(process.env.KEEP_EMAIL || "dbarshay15@gmail.com").trim().toLowerCase();
const url =
  process.env.DATABASE_URL ||
  readEnv(".env.local", "DATABASE_URL") ||
  readEnv(".env.local", "POSTGRES_DATABASE_URL_UNPOOLED") ||
  readEnv(".env", "DATABASE_URL");

if (!url) {
  console.error("No DATABASE_URL found (checked env, .env.local, .env).");
  process.exit(1);
}

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();

const { rows } = await client.query(
  `SELECT id, email, "displayName", status, locked, inactive, "bootstrapSafe", "createdAt"
   FROM "AdminUser" ORDER BY "createdAt" ASC`
);

const keepRows = rows.filter((r) => String(r.email || "").trim().toLowerCase() === KEEP);
const targetRows = rows.filter(
  (r) => String(r.email || "").trim().toLowerCase() !== KEEP && r.status !== "inactive"
);

console.log(`Total users: ${rows.length}`);
console.log(`Keeping (owner): ${KEEP}`);
if (keepRows.length === 0) {
  console.error(`\n*** ABORT: the KEEP owner email (${KEEP}) was not found among users. ***`);
  console.error("Refusing to run so you don't accidentally deactivate everyone. Set KEEP_EMAIL correctly.");
  await client.end();
  process.exit(2);
}

console.log(`\nWould deactivate ${targetRows.length} user(s):`);
for (const r of targetRows) {
  console.log(`  - ${r.email} | ${r.displayName || "(no name)"} | status=${r.status} | bootstrapSafe=${r.bootstrapSafe}`);
}
console.log(`\nWould keep ${rows.length - targetRows.length} user(s) untouched (owner + already-inactive).`);

if (!APPLY) {
  console.log("\nPREVIEW ONLY — nothing changed. Re-run with --apply to deactivate the users listed above.");
  await client.end();
  process.exit(0);
}

const note = `[${new Date().toISOString()}] DEACTIVATED (test-user cleanup) — reversible; owner kept: ${KEEP}`;
const result = await client.query(
  `UPDATE "AdminUser"
   SET status = 'inactive', locked = true, inactive = true,
       notes = CASE WHEN notes IS NULL OR notes = '' THEN $2 ELSE notes || E'\\n' || $2 END,
       "updatedAt" = now()
   WHERE lower(trim(email)) <> $1 AND status <> 'inactive'`,
  [KEEP, note]
);

console.log(`\nDeactivated ${result.rowCount} user(s). This is reversible — set status back to 'active' (and locked/inactive false) to restore.`);
await client.end();
