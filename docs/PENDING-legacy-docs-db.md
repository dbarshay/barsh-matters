# PENDING — Legacy migration manifest & Prisma safety (deferred, must do)

Deferred on purpose (2026-07). Do NOT lose this.

## The situation
- `legacy_case` (~555k rows) and `legacy_document` (~250k rows) are the atlas-migration manifest.
- Per the note in `prisma/schema.prisma` and `lib/legacyDocs.ts`, they are INTENTIONALLY not modeled in
  Prisma and are meant to live in a dedicated DB (`LEGACY_DOCS_DATABASE_URL`), because the app DB's
  backup/restore tooling kept wiping tables it doesn't manage.
- BUT `LEGACY_DOCS_DATABASE_URL` is currently UNSET, so those scripts fell back to the main `neondb` —
  the tables are sitting in the app DB, the exact vulnerable spot the note warns about.

## To do (when ready — not blocking Reports)
1. Provision a dedicated Neon database/branch for the legacy manifest.
2. Set `LEGACY_DOCS_DATABASE_URL` (unpooled/direct) locally and on Vercel.
3. Move the `legacy_case` + `legacy_document` data there (they are recreated by
   `scripts/atlas-migration/ledger.ts initSchema()`), then remove them from the app `neondb`.
4. Do NOT add these tables to `prisma/schema.prisma` — that reverses the deliberate design.

## Prisma workflow rule for this repo
- NEVER run `prisma db push` here — it will always try to DROP the unmanaged legacy tables.
- For schema changes use targeted SQL (see `prisma/manual/`) or `prisma migrate` (needs a shadow DB;
  set `SHADOW_DATABASE_URL_UNPOOLED` to an empty throwaway Neon DB to use `migrate dev`).

## Reports feature (also open)
- Optional: strict per-user "Reports card" gating (currently any admin-access holder can reach Reports
  because `/admin/reports` also matches the broad `admin.access` scope). One-line resolver change if wanted.


## PENDING — Rotate ALL credentials before go-live (security)
Before real PHI lands, rotate every secret and remove test/break-glass creds:
- Neon DB password (`neondb_owner`) — a dev password was pasted into a chat and is compromised; reset it in
  Neon Console -> Roles, then update DATABASE_URL / POSTGRES_URL / POSTGRES_DATABASE_URL_UNPOOLED in `.env.local`
  AND Vercel, and redeploy.
- Microsoft Graph client secret, Clio access/refresh tokens + client secret + webhook secret, Azure Document
  Intelligence key, Twilio auth token, admin password + admin session token, 2FA break-glass, and any dev API keys.
- A full `.env.local` was pasted into chat during development -> treat all of those specific secrets as compromised
  and rotate now, not just at go-live.
