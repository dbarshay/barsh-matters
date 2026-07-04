# RESUME HERE — Matter Import (build handoff)

> ## ⚠️ BEFORE GO-LIVE — HIPAA + security (do not skip)
> The app will hold **PHI** (right now only fictitious test data). Before real patient data lands:
> - **Signed BAAs across the stack:** Neon (DB — enable HIPAA org-level, Scale plan), Vercel (hosting),
>   Microsoft 365 (native email), Clio (documents), and the future OCR provider.
> - **Access controls:** turn on RBAC (currently designed, not enforced), audit logging, encryption at
>   rest/in transit, breach plan, enforce 2FA.
> - **Rotate ALL credentials** before go-live — Neon password, Vercel env, Microsoft Graph client
>   secret, Clio tokens/secret/webhook, Twilio auth token, 2FA break-glass, admin password/session
>   token, any dev API keys. Remove test/break-glass creds.
> - **⚠️ One-time cleanup:** a full `.env.local` was pasted into a chat during development, so those
>   specific secrets must be treated as compromised and **rotated now**, not just at go-live.

---

## Status: the import module is BUILT (behind a flag)

Everything below is implemented, tsc-clean, and covered by source-grep verifiers. It's all gated by
the env flag **`BARSH_IMPORT_ENABLED`** (set to `1`/`true` to turn on; off = every import route 403s and
the UI shows a disabled message). **Clio = document storage only** — imports never write to Clio.

### The three intake paths (Admin Home tiles)
1. **Import DOW Matters** (`/admin/import?source=dow`) — provider spreadsheet, operator picks one
   provider for the whole file. Adapter: `lib/import/dowAdapter.ts`.
2. **Import CARISK Matters** (`/admin/import?source=carisk`) — clearinghouse export (41 cols). CIC#
   hard-unique dedup, Status routing (Carrier Submission→create / Submitted→ignore / Saved
   Incomplete→to-report), per-row provider from `FacilityName`, ClaimType→case-type map, TIN mismatch
   check. Adapter: `lib/import/cariskAdapter.ts`.
3. **Import OTHERS** (`/admin/import/other`) — landing with three sub-cards:
   - **Create Matter Manually** (`/admin/matter/new`) — 12-field hand-keyed form, controlled
     dropdowns, patient typeahead with **date-of-loss disambiguation**, carry-over from the patient's
     last matter (locked identity fields + highlighted editable + "Add another for this patient"),
     dedup warn+override, required-field red outlines. API: `app/api/import/manual/create`.
   - **Other Spreadsheet** (`/admin/import/other/spreadsheet`) — generic parser. Upload → detect
     columns → **column-oriented mapping** (their columns → our fields, auto-suggested, with sample
     values + conflict guard) → save/load **named mapping templates** → preview → confirm. Provider
     is always an operator **pick** (never parsed); case type is pick-one or map-a-column. Adapter:
     `lib/import/otherAdapter.ts`.
   - **Document OCR** — coming soon (scan a bill/claim form). NOT built yet.

### Shared pipeline (all sources)
- **Preview (read-only) → Confirm (write) → guarded Undo.** Each import records a full per-row
  `ImportBatch`/`ImportRow` audit. Undo removes only untouched matters **and now also deletes any
  patients orphaned by the undo**.
- **Sub-reason holds → Reconcile queue** (`/admin/import/reconcile`): a held row carries a reason —
  `missing_field` (fixable, edit the values), `carrier_unmatched` / `provider_unmatched` (Owner-gated
  Assign-Alias / Add-new registry writes), `case_type_unknown` (map the value), `patient_ambiguous`
  (link/new with D/L shown), `tin_mismatch` (accept/dismiss), `data_quality` (accept/dismiss). Holds
  are collapsible, ordered by severity, "Reconcile Held Cases" is a per-row button in Existing imports.
  Fixed rows become **Ready to Commit**; operator commits any number in-place. Commit re-validates and
  re-holds under the next reason if needed (chained safety). `app/api/import/reconcile/*`.
- **Shared creator** `lib/import/createMatters.ts` — every path (and reconcile-commit) creates matters
  here: `final_status = "Open"`, `matter_stage_name = "PRE-LIT- NEW COLLECTIONS INTAKE (NEEDS TO BE
  REVIEWED)"`, mints the next `BRL_{YYYY}{seq}`. final_status only flips to Closed via the UI close dialog.
- **Patient master** (`Patient` table, own table — not registry, not ClaimIndex). Suggest-and-confirm,
  never auto-links on a fuzzy name; new patients auto-create; a patient never persists without a matter
  (undo + `/api/admin/patients/cleanup-orphans` enforce this).

## Migration history was baselined (2026-07-04)
The whole `prisma/migrations` folder was squashed to a single `0_init` baseline that reproduces the
current schema exactly (verified: live Neon DB vs `schema.prisma` = "No difference detected"). This
removed a broken backfill migration and folded in all the old `db push`-only drift (`ImportMapping`,
`MatterLocalField`, `ProviderClientInfo.tin`). `_prisma_migrations` was reset to the single applied
baseline. After a `git pull` on any machine, just:
```
npx prisma generate
```
(Neon is shared, so the DB already matches; every machine only needs to regenerate the client.)

## Home-machine setup (fresh clone or pull)
1. Connect the **`clio-lawsuit-aggregator` folder** in Cowork.
2. `git pull origin main`
3. `npm install` (if needed) → `npx prisma generate` (schema is baselined; no `db push` needed)
4. `.env.local` must have **`BARSH_IMPORT_ENABLED=1`** to use imports, plus the (rotated) DB/Graph/
   Twilio/admin secrets. Never paste `.env*` into a chat — use `grep VAR .env.local`.
5. `npm run dev` → hard-refresh.

## Sandbox / workflow notes (for the agent)
- The agent's Linux sandbox **cannot run git or reach Neon**, and `npx prisma generate` fails there
  (engine download blocked). **You (the user) run all git + prisma commands** on your Mac; the results
  propagate to the shared `node_modules` mount the sandbox sees.
- Migration history is now clean (single `0_init` baseline, 2026-07-04). The old broken migration is
  gone, so shadow replay is no longer poisoned. BUT `migrate dev`/`migrate diff --from-migrations`
  still need a `datasource.shadowDatabaseUrl` in `prisma.config.ts` because **Neon won't auto-create a
  shadow DB**. Until that's wired, change schema with `db push` then, if you want a tracked migration,
  generate one with `prisma migrate diff --from-config-datasource --to-schema` and `migrate resolve
  --applied`. To validate no drift anytime: `prisma migrate diff --from-config-datasource --to-schema
  prisma/schema.prisma --exit-code` (0 = clean).
- Verifiers are **source-grep `.mjs` proofs** registered in `package.json` (no runtime TS test runner).
  Run e.g. `npm run verify:other-import-safety`. Import proofs: `dow-import-*`, `carisk-import-safety`,
  `manual-create-safety`, `other-import-safety`, `import-reconcile-safety`.

## What's left (not built)
- **Document OCR module** — scan a bill/claim form, OCR-extract, drag-into-category, Clio-flat storage.
  Big workstream; see `docs/document-folder-structure.md` for the folder taxonomy.
- **Carisk Management Report** — the persistent "Saved Incomplete" tracker (keyed by CIC#) + weekly
  scheduled email. Currently those rows are just routed to a `to_report` outcome and counted.
- **RBAC activation** — the Owner/operator gating is designed; import writes are gated by the flag +
  (for registry writes) the admin cookie. Wire real roles in.
- **(Optional) shadow DB for `migrate dev`** — add a `shadowDatabaseUrl` (throwaway Neon branch/DB) so
  `migrate dev` runs on Neon. Not required; `db push` + baseline diff already covers schema changes.

## Authoritative design docs
- `docs/dow-data-dictionary.md` · `docs/carisk-data-dictionary.md` · `docs/manual-creation-intake.md`
  · `docs/document-folder-structure.md` · `docs/agent-orientation.md`

## Sample data (kept out of the repo on purpose — PHI)
`searchResults (3).xlsx` (Carisk) and `May 2026.xlsx` (Dow). Drag into chat only when raw-data
inspection is needed. Keep your own copies.

## To resume, tell Claude:
> "Read `docs/RESUME-HERE.md`, then continue. The import module (Dow, Carisk, Manual, Other
> Spreadsheet) is built and flag-gated. Pick up [Document OCR | Carisk Management Report | RBAC | your
> next item]."
