# RESUME HERE — Barsh Matters (build handoff)

> ## ⚠️ BEFORE GO-LIVE — HIPAA + security (do not skip)
> The app will hold **PHI** (right now only fictitious test data). Before real patient data lands:
> - **Signed BAAs across the stack:** Neon (DB — enable HIPAA org-level, Scale plan), Vercel (hosting),
>   Microsoft 365 (native email), Clio (documents), and OCR = **Azure AI Document Intelligence**
>   (auto-covered under the Microsoft HIPAA BAA via Product Terms — confirm scope, no separate contract).
> - **Access controls:** turn on RBAC (currently designed, not enforced), audit logging, encryption at
>   rest/in transit, breach plan, enforce 2FA.
> - **Rotate ALL credentials** before go-live — Neon password, `SHADOW_DATABASE_URL`, Vercel env,
>   Microsoft Graph client secret, **Azure Document Intelligence key**, Clio tokens/secret/webhook,
>   Twilio auth token, 2FA break-glass, admin password/session token, any dev API keys. Remove
>   test/break-glass creds.
> - **⚠️ One-time cleanup:** a full `.env.local` was pasted into a chat during development, so those
>   specific secrets must be treated as compromised and **rotated now**, not just at go-live.

---

## Session log (most recent first — **append a dated entry at the end of each working day**)

### 2026-07-08 — reference seeding, DB/Vercel outage fix, matter/lawsuit UI

**DB/Vercel `password authentication failed for user 'neondb_owner'` — recurring, now solved.** This bit twice. Root cause: the Neon–Vercel integration performs **system-initiated secret rotations** (seen in Vercel → Storage → brl-clio-db → "A secret rotation was requested … with reason: `system`"), and it does **NOT reliably propagate the new password to Vercel's managed `POSTGRES_*` env vars** — so after a rotation the live app authenticates with a stale password. `.env.local` is static and Vercel env is build-time, so a rotation breaks both until manually refreshed + redeployed.
- **Final fix (deployed, `ddda953`):** `lib/databaseUrl.ts` `resolveDatabaseUrl()` now reads **`process.env.DATABASE_URL` FIRST, everywhere** (`DATABASE_URL || integrationBuiltUrl() || explicitUrl()`). We **no longer depend on the integration-managed `POSTGRES_*` vars** — an earlier version that built the URL from `POSTGRES_PG*` components failed because those vars are the ones that don't update. `DATABASE_URL` is maintained by hand. Wired into `lib/prisma.ts` and `app/api/auth/login/route.ts`.
- **When login fails again (the recovery runbook):** 1) Neon → project `brl-clio-db` → **Connect → `.env` tab → "Show password"** to get the current password. 2) Update **`DATABASE_URL`** in *both* Vercel env vars **and** local `.env.local` (find-and-replace the old password → new, or paste the whole `DATABASE_URL` line). 3) **Redeploy** on Vercel (env is build-time; a running deploy won't pick up an env change). 4) Restart `npm run dev` locally. Verify: the Node snippet `new Client({connectionString:…}).connect()` against both the `-pooler` and non-pooler hosts should return OK.
- Don't bother with "Rotate Integration Secrets" — it triggered one of these rotations and didn't sync Vercel. Treat the Neon password as a manually-managed secret in `DATABASE_URL`.

**Reference seeding (task #178, Approach A — match-or-create via the reference-data CSV import: `displayName` matches existing → update+attach `aliases`; no match → create; providers `active=false`; dry-run then confirm).**
- **Provider → `provider_client`** ✓ seeded — `docs/nf-provider-seed.csv` (22 alias-maps onto existing providers + 35 new inactive, title-cased). `Nitin Mariwalla` misspelled source left to manual.
- **Court → `court_venue`** ✓ seeded — `docs/nf-court-seed.csv` (10 alias-maps of legacy NF court names onto existing venues + 1 create `AAA Arbitration`; Supreme Court/Westchester/Onondaga/Lien/test dropped).
- **ServiceType → `service_type`** ✓ seeded — `docs/nf-service-type-seed.csv` (29 update: Title-cased the ALL-CAPS displays + 406 source aliases, compounds → primary service; 3 create: Orthopedic, Pain Management, Acupuncture). `UNKNOWN` renamed to **`Unknown/Other`** (kept `UNKNOWN` as an alias so it still resolves). ~97% of rows resolve.
- **Insurer → `insurer_company`** — **DEFERRED.** 1,060 canonical values not merged; ~777 are variants of existing insurers (GEICO/State Farm/Progressive families). Needs brand-level grouping before a clean seed (string fuzzy is unreliable here).
- **ProviderGroup** — no reference table; it's a **hidden, provider-derived field.** 39/44 NF codes exactly match `provider_client` records' `details._hiddenImportFields.hidden_provider_group_name`. Importer rule (#178): derive `ClaimIndex.providerGroup` from the resolved provider's hidden group (NF column as fallback); **exclude** `KOFFLER-MUA`, `SVETLANA`, `CELLA-SENI`, `LEVI-TRISH-SENI`, `TEST-GROUP`.
- **Still to seed:** DenialReason (947), Defendant (353), SettledWith (2,767), Status (134), VerificationStatus (2), PlaintiffAttorney (1).
  - **DenialReason — analysis started, resume here:** ~97% of rows keyword-map onto the 16 canonical reasons (Fee Schedule, IME/Peer/Causality Medical Necessity, No-Show EUO/IME, 30/45/120-Day rules, No Coverage subtypes, Alleged Fraud). Open decisions before building the seed CSV: (1) generic `MEDICAL NECESSITY` (~11k rows, no subtype) → which subtype or a new generic; (2) generic `No Coverage` (~1k) → subtype or generic; (3) new categories — `Duplicate` (~1.4k), `Workers Compensation` (~576), `PPO Contract` (~278), maybe a `Verification/Investigation Pending` bucket (~700); (4) residual ~3% (compounds → map to their primary/first reason; junk like blank/placeholder dropped). Same seed pattern as ServiceType (title-case display, aliases for variants).
- **Process note:** always check reference tables' hidden `details` fields (e.g. `_hiddenImportFields`), not just `displayName`.
- Reference-data admin browse list cap raised 100 → 10,000 (`app/api/reference-data/entities/route.ts`, `app/admin/reference-data/page.tsx`).

**Matter / Lawsuit UI (deployed, working).**
- Matter page (`app/matter/[id]/page.tsx`): "Old Matter Number" moved inline with the "Claim Information" title; new **Service Type** picklist card between Date of Service and Denial Reason (`components/ServiceTypePicklist.tsx`), backed by the `identity-field` API which now supports `service_type` (`app/api/matters/identity-field/route.ts`).
- Lawsuit page (`app/lawsuits/page.tsx`): **Old Lawsuit Number** field added to each lawsuit group header (for PKT/packet files).

---

## Native email — PER-USER, real-time (built)

Email is **user-specific**: every user works their **own** BRL Outlook mailbox (their account email).
**There is no shared firm mailbox.** The old Clio MailDrop matching is retired.

- **Mailbox identity:** `lib/graph/userMailbox.ts` — interactive routes derive the mailbox from the
  signed session (`getRequestUserMailbox`); sync/webhooks enumerate `AdminUser` (`listActiveUserMailboxes`).
- **Outlook-style inbox:** `components/email/MatterEmailInbox.tsx` — folder rail (Inbox/Sent/Drafts/
  Deleted Items), reading pane, Reply/Reply All, Save Draft, inline inbound-attachment OCR review.
  Keyboard **Delete/Backspace** moves a highlighted message to Deleted Items (reversible, no confirm).
  Hosted in `components/ui/DraggableResizableModal.tsx`. Mounted on the **matter page**, the **lawsuit
  page**, and firm-wide in the header (`app/components/GlobalEmailInboxButton.tsx`, `?scope=all`).
- **Real-time:** Microsoft Graph change-notification **webhooks**, one subscription **per active user
  mailbox** (`lib/graph/emailSubscription.ts`, model `GraphSubscription`). Receiver:
  `app/api/graph/webhook/route.ts` (validation handshake + `clientState` secret; resolves the mailbox
  by `subscriptionId`). Auto-provisions on user-create; renews via the every-6h `/api/graph/webhook/
  subscribe` cron (self-heals if a subscription lapses). Backstop crons (`background-thread-sync`,
  `maildrop-discovery`) relaxed to every 5 min.
- **Matching (only matter-related mail is stored):** a reply into a known thread, OR a matter number —
  `BRL_YYYYNNNNN` or `YYYY.MM.NNNNN` — found **anywhere in subject or body**
  (`extractMatterNumbers` / `resolveMatterContext` in `lib/graph/webhookMessageSync.ts`, resolved to
  `ClaimIndex.display_number`). No match → skipped, left untouched in Outlook.
- **Actions are real in Outlook:** send/reply from the user's mailbox; Delete → Deleted Items; Save
  Draft → real Outlook draft. Never hard-deletes.
- **Flags/env:** `BARSH_MATTER_EMAIL_ENABLED=1`, `BARSH_INBOUND_ATTACHMENT_OCR_ENABLED=1`,
  `BARSH_EMAIL_WEBHOOK_ENABLED=1`, `BARSH_EMAIL_WEBHOOK_CLIENT_STATE=<secret>`,
  `BARSH_EMAIL_WEBHOOK_URL=https://<prod>/api/graph/webhook`, plus `CRON_SECRET` and the
  `MICROSOFT_GRAPH_TENANT_ID/CLIENT_ID/CLIENT_SECRET`. `MICROSOFT_GRAPH_MAILBOX_USER_ID` is no longer
  used by these routes.
- **Azure (done):** app "Barsh Matters Graph Email" has **Application** permissions `Mail.Read`,
  `Mail.ReadWrite`, `Mail.Send` with admin consent. Optional hardening: an Application Access Policy to
  scope the app to only BRL users' mailboxes; rotate the (exposed) client secret before go-live.
- **Routing taxonomy (done):** `BRL_2026NNNNN` = **Individual Matter** (`ClaimIndex.display_number`);
  `YYYY.MM.NNNNN` = **Lawsuit Matter** (`Lawsuit.masterLawsuitId`). Matched anywhere in subject/body; if
  BOTH appear, routes to the **Lawsuit Matter** (precedence). Shared resolver `resolveMatterContext`
  drives the webhook, the backstop cron, and the Unmatched "Assign".
- **Unmatched triage (done):** firm-wide header inbox has an **Unmatched** folder — live-scans the user's
  recent inbound mail BM couldn't tie to a file (read-only, never auto-stored); **Assign** files it to a
  typed matter/lawsuit number. Routes: `/api/graph/matter-email/unmatched`, `/api/graph/matter-email/assign`.
- **TODO — Unmatched follow-ons (later):**
  - Scan window is only the ~40 most recent messages and matches on **subject + preview** — consider
    paginating / a "load more", a date range, and matching the **full body**.
  - Surface unmatched mail **with attachments** more prominently (badge/sort).
  - One-click **"Assign to the matter/lawsuit I'm currently viewing"** (prefill the file number from the
    open matter/lawsuit context) in addition to typing it.

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
   - **Document OCR** — shared extraction **engine is BUILT** (see "OCR engine" section below);
     the import-intake *consumer* (field-mapping profile + verify UI that creates a matter from a
     scanned bill/claim form) is NOT wired yet.

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

## Setting up on a DIFFERENT / new machine (read this first when picking up elsewhere)
The **GitHub remote was renamed to `barsh-matters`** (2026-07-04). The local folder + npm package are
still named `clio-lawsuit-aggregator` (legacy, cosmetic). Node **v24**, `tsx` is a dev dep.

1. **Repo** — clone `git@github.com:dbarshay/barsh-matters.git` (or if the folder already exists,
   `git remote set-url origin git@github.com:dbarshay/barsh-matters.git` then `git pull origin main`).
   In Cowork, connect the project folder.
2. `npm install`
3. `npx prisma generate` — schema is baselined; **no `db push` / no migrate needed** (Neon is shared and
   already matches). Verify no drift: `npx prisma migrate diff --from-config-datasource --to-schema
   prisma/schema.prisma --exit-code` (0 = clean).
4. **Recreate `.env.local` — it is git-ignored, so a new machine has NONE of these.** Transfer the
   values securely (password manager / secure copy from another machine); **never paste `.env*` into a
   chat**. Required keys:
   - **Database (Neon):** `DATABASE_URL` and/or `POSTGRES_DATABASE_URL_UNPOOLED` / `POSTGRES_URL_NON_POOLING`
   - **Shadow DB (only if you want `migrate dev` on this machine):** `SHADOW_DATABASE_URL` = the `shadow`
     Neon branch's DIRECT/unpooled connection string. Optional; without it, use `db push` for schema work.
   - **OCR (Azure):** `AZURE_DOCINTEL_ENDPOINT`, `AZURE_DOCINTEL_KEY` (resource `barsh-matters-docintel`,
     East US, Standard S0). Optional: `AZURE_DOCINTEL_API_VERSION`, `OCR_PROVIDER=stub` to force offline stub.
   - **Imports:** `BARSH_IMPORT_ENABLED=1`
   - **Microsoft Graph** (email), **Clio** (tokens/secret/webhook), **Twilio**, **admin** secrets — same
     as the other machine. `grep -o '^[A-Z_]*=' .env.local` on the source machine lists the key names.
5. `npm run dev` → hard-refresh.
6. Sanity-check OCR wiring: `npx tsx scripts/ocr-smoke-test.ts <some.pdf> layout` (add `--save` to also
   write an `OcrExtraction` row). Readiness should print `"ready":true,"provider":"azure"`.

## Sandbox / workflow notes (for the agent)
- The agent's Linux sandbox **cannot run git or reach Neon**, and `npx prisma generate` fails there
  (engine download blocked). **You (the user) run all git + prisma commands** on your Mac; the results
  propagate to the shared `node_modules` mount the sandbox sees.
- Migration history is now clean (single `0_init` baseline, 2026-07-04) and `migrate dev` works on
  Neon. `prisma.config.ts` reads an optional `SHADOW_DATABASE_URL` (env, in `.env.local`, git-ignored)
  pointing at a dedicated throwaway Neon branch named `shadow` — needed because **Neon won't
  auto-create a shadow DB**. Each machine that wants `migrate dev` must set its own `SHADOW_DATABASE_URL`
  (use the branch's DIRECT/unpooled connection string). Without it, schema work falls back to `db push`.
  To validate no drift anytime: `prisma migrate diff --from-config-datasource --to-schema
  prisma/schema.prisma --exit-code` (0 = clean).
- Verifiers are **source-grep `.mjs` proofs** registered in `package.json` (no runtime TS test runner).
  Run e.g. `npm run verify:other-import-safety`. Import proofs: `dow-import-*`, `carisk-import-safety`,
  `manual-create-safety`, `other-import-safety`, `import-reconcile-safety`.

## OCR engine — foundation BUILT (2026-07-04)
The shared, provider-agnostic OCR engine is built and proven against live Azure. It is the single
extraction layer BOTH consumers use (import-intake matter creation AND matter-document filing).
- Code: `lib/ocr/` — `extractDocument(input, mode)` returns `{ text, keyValues, tables, meanConfidence }`.
  Provider interface + **Azure Document Intelligence** adapter (REST, no SDK; `prebuilt-read` for cheap
  bulk text, `prebuilt-layout` + `features=keyValuePairs` for structured pre-fill) + offline `stub`.
  Format-AGNOSTIC on purpose (bills are HCFA-1500 / UB-04 / letterhead / itemized — no fixed template).
- Provider = Azure (Microsoft BAA auto-covers it). Env in `.env.local`: `AZURE_DOCINTEL_ENDPOINT`,
  `AZURE_DOCINTEL_KEY` (resource `barsh-matters-docintel`, East US, Standard S0). Optional `OCR_PROVIDER=stub`.
- Persistence: `OcrExtraction` table (migration `20260704193929_add_ocr_extraction`). Server-only writer
  `persistExtraction` in `lib/ocr/persist.ts`; DB-free row builder in `lib/ocr/persistData.ts`.
- Smoke test: `npx tsx scripts/ocr-smoke-test.ts <file> [read|layout] [--map] [--save]`.
- Cost model at scale: run cheap `read` on everything (full-text search); run `layout` only on doc
  types needing structured pre-fill. Azure Layout ($10/1k) is ~3-5x cheaper than Google/AWS for forms.
- **Intake field-mapping profile BUILT** (`lib/ocr/mapping/`): `mapBillToIntakeFields(result)` →
  patientName, providerName, insurerName, claimNumber, policyNumber, dateOfLoss, dosStart, dosEnd,
  claimAmount — each with value+confidence+source. Semantic (synonym labels in `synonyms.ts` +
  date/amount normalize + table/regex fallbacks), format-agnostic. `caseType` is NOT mapped (operator
  picks). Verified on a real HCFA: patient / DOS from-to / total charge all correct.
- **Seeding + review harness (for tuning across bill formats):**
  - Stage 1 (office, has forms + Azure): drop bills in `ocr-samples/inbox/`, run
    `npx tsx scripts/ocr-seed.ts` → OCRs once, caches raw extractions to `ocr-samples/cache/<hash>.json`
    (idempotent by file bytes; `--force` to redo).
  - Stage 2 (anywhere, no Azure): `npx tsx scripts/ocr-review.ts` → maps the cache, writes
    `ocr-samples/review.md` (per-file fields+confidence+captured labels, hit-rate summary). Iterate
    `synonyms.ts` and re-review offline — no re-OCR needed.
  - `ocr-samples/` is git-ignored (PHI). The cache lets mapping be tuned without the original forms.
- STILL TO BUILD: the **VERIFY UI** (upload → OCR → prefilled form with confidence highlighting
  yellow<0.5/green≥0.5/red=missing → operator corrects, picks case type, resolves provider/insurer →
  create matter); wiring into the import-intake path; the folder-drop consumer (Phase 4 below); later,
  per-format prebuilt/custom models + full-text content search over `OcrExtraction.text`.
  OPEN DECISION: verify-UI submit path = direct `createMatters` vs route through the import
  preview/reconcile pipeline (reuse carrier/patient resolution + dedupe). Not yet decided.

## Document Folder Structure feature — Phases 1–2 BUILT (2026-07-05)
Big workstream from `docs/document-folder-structure.md`. Clio stays the FLAT file vault; BM owns the
nested tree as metadata (invariant — never create Clio subfolders). Phased build:
- **Phase 1 DONE — foundation.** `lib/documents/folderTaxonomy.ts`: the fixed tree in code (4 branches,
  17 terminal folders, 47 controlled titles) with per-title prompt fields + label templates, freehand
  flags, deadline-prompt flags, matter-vs-lawsuit level, case-type relevance, and helpers
  (`getFolder`, `isTitleAllowed`, `composeTitleLabel`, `folderAppliesToCaseType`). `FiledDocument`
  model (migration `20260705174345_add_filed_document`) = BM metadata pointing at a `clioDocumentId`
  (folderKey/titleKey/titleLabel/fields/level/fileHash/sourceType/status). Verifier:
  `npx tsx scripts/verify-folder-taxonomy.ts`.
- **Phase 2 DONE — read-only tree.** `GET /api/documents/filed?matterId=&level=` +
  `components/documents/FolderTree.tsx` (rolled-up count badges, case-type greying of empty+irrelevant
  folders, expand/collapse, flat searchable list, decoupled title labels). Viewer:
  `/admin/documents/tree?matterId=999&level=matter&caseType=no_fault`. Seed test rows:
  `npx tsx scripts/seed-test-filed-document.ts <matterId> [folderKey] [titleKey]`.
- **Phase 3 DONE — filing action (write).** `POST /api/documents/filed` → thin handler over
  `lib/documents/fileDocument.ts` (testable core): server-side title enforcement (`isTitleAllowed`),
  required-prompt + freehand validation, `(2)/(3)` label dedup, exact-duplicate (fileHash) warning
  (409 unless `confirmDuplicate`), AuditLog `document.filed` entry. UI: `FileDocumentForm` (folder →
  title picklist → dynamic prompts → freehand) + **drag-and-drop** (drop a file onto a terminal folder
  → form pre-set to that folder, captures filename). Headless test: `npx tsx scripts/test-file-document.ts`
  (16 checks, all pass, self-cleaning). NOTE: real Clio upload isn't wired yet, so `clioDocumentId` is a
  placeholder from the form/drop — Phase 4 (or the upload integration) supplies the real id.
- **Phase 4 DONE — OCR prefill on filing** (the 2nd OCR consumer). Pure logic (tested,
  `npx tsx scripts/test-ocr-prefill.ts`, 11 checks): `lib/ocr/mapping/classify.ts` `suggestFolderTitle`
  (keyword → folder/title) + `lib/ocr/mapping/titleFields.ts` `mapOcrToTitleFields` (per-title prompt
  prefill w/ confidence). Wiring: `POST /api/documents/ocr-prefill` (OCR bytes → persist OcrExtraction
  → classify → prefill) + drag-drop on a folder runs it and pre-fills `FileDocumentForm` with
  confidence highlighting (green≥50%/amber<50%). `FiledDocument.ocrExtractionId`+`fileHash` link the OCR
  row. Then Phase 5+ = deadlines, move/refile, tiered delete, exhibit combine, content search.
- **Upload Docs module — NEXT (task).** Global header button in `BarshHeader` (near Create Lawsuits /
  Print Queue): upload file → OCR → pick/confirm the matter (reuse `claim-index/search`; OCR suggests
  by patient/claim#) → folder/title (OCR-prefilled) → **real Clio upload** via
  `uploadBufferToClioMatterDocuments` (single-master storage path — guarded; reuse finalize folder
  resolution) → write `FiledDocument` + backfill `OcrExtraction.clioDocumentId` by fileHash. NOTE: this
  is where the placeholder `clioDocumentId` becomes a real Clio id.
- NOTE: Phase 2/3 UI lives on the standalone viewer `/admin/documents/tree`; wiring the tree + filing
  into the matter page's View Documents popup (`app/matter/[id]/page.tsx`) is a follow-up. Also still
  pending: real file upload → Clio → set `clioDocumentId` + backfill onto the OCR row by fileHash.

## Carisk Management Report — BUILT (2026-07-06)
Persistent tracker for Carisk **"Saved Incomplete"** bills (insurer rejected as incomplete → never became
a matter), keyed by **CIC#**, plus a **weekly email** every Friday.
- **Model** `CariskManagementReportItem` (`cicNumber @unique`; patient/provider/carrier/DOS/charges/
  status date/rejection detail; `status` open|removed; first/last seen). Needs `db push` + `generate`
  (already applied to shared Neon).
- **Persist lib** `lib/import/cariskManagementReport.ts`: `upsertSavedIncomplete()` parks rows,
  `removeCicsFromReport()` graduates a CIC# off when it later becomes a matter, `listOpenReport()`.
- **Wiring:** Carisk **confirm** parks every `to_report` row and graduates any CIC# it just created;
  reconcile **commit** also graduates committed Carisk CIC#s. So a bill auto-drops off once the same
  CIC# arrives as a Carrier Submission.
- **View:** `/admin/import/carisk/report` (purple **Management Report** button in the Carisk import
  "Existing imports" header). API `GET /api/import/carisk/report` (flag-gated).
- **Email:** `lib/import/cariskReportEmail.ts` builds an HTML table + sends via Graph
  (`POST /users/{mailbox}/sendMail`). Recipient(s) = `CARISK_REPORT_RECIPIENT` (comma-sep).
  Send route `/api/import/carisk/report/send`: **GET** = cron (Bearer `CRON_SECRET` or
  `CARISK_REPORT_CRON_SECRET`, fail-closed); **POST** = admin "Send report email now" button.
- **Schedule:** `vercel.json` cron `0 12 * * 5` = **Fridays 8:00am EDT** (12:00 UTC; note no DST — fires
  7:00am in winter EST). Fires only on Vercel.
- **Env needed in Vercel (Production):** `CARISK_REPORT_RECIPIENT`, `MICROSOFT_GRAPH_*` (send needs them
  in prod too), `CRON_SECRET` (shared with other crons). `BARSH_IMPORT_ENABLED=1` gates the whole thing.
- **Test:** open the report page → **Send report email now** (POST, admin cookie, no cron secret needed);
  sends even with 0 items ("No open items"). Verifier: `npm run verify:carisk-report-safety`.
- To see real rows: run a Carisk import containing "Saved Incomplete" status rows and confirm it on a
  deployment that has this feature (imports confirmed on older builds never parked anything).

## Document intake + tree + auto-file — BUILT (2026-07-06)
Live document filing into the BM folder tree, from three sources, all reusing the shared
`lib/documents/fileDocument.ts` core + guarded Clio upload (Clio = flat storage; BM owns the tree).
- **Upload Docs** (`/admin/documents/upload`, header 📤 button, flag `BARSH_UPLOAD_DOCS_ENABLED=1`):
  file → OCR prefill (Azure) → **matter auto-suggest** from patient/claim OCR + manual search
  (`/api/documents/upload/matter-search`) → folder/title → guarded live Clio upload → `FiledDocument`.
  API `POST /api/documents/upload` (dup pre-check before upload; backfills `OcrExtraction.clioDocumentId`).
  Diagnostics: `/api/documents/upload/clio-check` (anchors), `/api/documents/ocr-check` (azure vs stub).
- **Matter View Documents popup** now renders the **FolderTree** (open a filed doc → Clio opener;
  **Delete** = archive the BM filing, BM-styled confirm). Filed API matches by matterId OR
  `matterDisplayNumber`. **Drag-drop** a file onto a terminal folder → `DropFileFilingForm` (OCR + title
  pick → upload). `components/documents/DropFileFilingForm.tsx`.
- **Finalize auto-file** (`verify:finalize-autofile-safety`): each DocumentTemplate carries an
  admin-set **Auto-file target** (folderKey/titleKey in metadata; `lib/documents/templateFiling.ts` +
  Document Templates admin). Direct-matter finalize is **blocked (422) until mapped**, then the finalized
  PDF auto-files into the mapped folder/title after upload. finalize-preview passes `templateKey`.
- **BM-styled dialogs everywhere**: `app/components/BmDialogHost.tsx` (`bmConfirm/bmAlert/bmPrompt`),
  mounted in root layout. Every native confirm/alert/prompt app-wide is converted (no "localhost says").
- **Removed**: the dormant matter-page settlement section (~2,200-line gated JSX block;
  `DIRECT_MATTER_SETTLEMENTS_ENABLED=false`). Settlement is lawsuit-screen-only (local-* routes on
  `app/matters/page.tsx`); the legacy `/api/settlements/writeback*|provider-fee-defaults|current-values`
  routes are disabled 410 stubs. NOTE: residual settlement *functions/state* on the matter page are now
  unreachable dead code — small follow-up sweep, no impact.

## Lawsuit-level document tree — BUILT (2026-07-06); needs `db push` + `generate`
- **Schema**: `FiledDocument.matterId` is now `Int?`, added `masterLawsuitId String?` + index. Exactly one
  of matterId / masterLawsuitId is set per row. **Run `npx prisma db push && npx prisma generate`** —
  until then tsc shows one stale-client error (`masterLawsuitId does not exist in FiledDocumentSelect`).
- **Core**: `lib/documents/fileDocument.ts` accepts `masterLawsuitId` (matter OR lawsuit); dedup +
  label-collision scoped to the target; audit `matterId` only when present.
- **Filed API**: `GET /api/documents/filed` also accepts `masterLawsuitId`; returns matterId /
  matterDisplayNumber / masterLawsuitId on each row.
- **UI**: `FolderTree` gained a `masterLawsuitId` prop. New `components/documents/LawsuitDocuments.tsx`
  = the lawsuit's own tree (level "lawsuit") PLUS a folder per **child matter** (from
  `/api/claim-index/by-master`) that expands to that matter's tree — reachable without leaving the
  lawsuit. Wired into the matters page master **View Lawsuit Documents** popup (open + Delete filed rows).

## STILL TODO (task 118): finalize/upload lawsuit-mode auto-file + placeholders
- **finalize lawsuit mode**: the auto-file block in `app/api/documents/finalize/route.ts` currently runs
  only for `uploadTargetMode === "direct-matter"` (files by matterId). Generalize it so lawsuit finalize
  files by `masterLawsuitId` (level "lawsuit"), with the same "block until template mapped" rule.
- **placeholder docs** (bill-schedule, packet-summary, summons-complaint): not DocumentTemplate rows, so
  add a small code map (placeholderKey → folderKey/titleKey), and auto-file them in finalize (always
  "mapped" via the code default).
- **Upload Docs / drag-drop for lawsuits**: optional — let the operator upload/drop directly onto the
  lawsuit tree (`/api/documents/upload` accepts masterLawsuitId).

## Superseded design note (2026-07-06)
A lawsuit gets its own BM number and its own Clio folder (single-master storage already creates folders
for both `individual_matter` and `lawsuit` target kinds). Finalized docs should auto-file to whatever
entity they were generated from (matter OR lawsuit). To do:
- **Schema**: `FiledDocument` — add `masterLawsuitId String?`, make `matterId` optional (or a level flag)
  so a filing can be lawsuit-level. (User runs `db push` + `generate`.)
- **Filed API**: query by `masterLawsuitId` (like the matterDisplayNumber match added for matters).
- **Lawsuit doc tree**: add `FolderTree` to the **matters/lawsuit page** master View Documents popup,
  keyed by the lawsuit. In the lawsuit tree, **each child matter appears as a folder** the user can open
  without navigating into the individual matter (aggregate child `FiledDocument`s under a child-matter
  node).
- **finalize (lawsuit mode)** + Upload Docs/drag-drop: call `fileDocument` with `masterLawsuitId`.
- **Placeholder docs** (bill-schedule, packet-summary, summons-complaint): code-level default folder/title
  mapping (they aren't DocumentTemplate records).

## OCR classification, extraction tuning, learning + matter predictor — BUILT (2026-07-07)
Tuned the OCR mapping/classifier against the ~90-doc `ocr-samples/inbox/` set and built the intelligence
layer on the Upload Docs filing flow. All read-safe; the one matter write is operator-confirmed.
- **Field extraction hardened** (`lib/ocr/mapping/intakeProfile.ts` + `normalize.ts` + `synonyms.ts`):
  fixed pure-digit claim/policy rejected as money; PO-box / label-continuation insurers; individual-vs-
  practice provider (practice-only; prefers a practice across ALL provider labels, then caption /
  letterhead / head-text fallbacks); patient from **Claimant / Injured Person**; sibling-label guards
  (patient≠insured, billing≠referring provider, claim≠our-file/index/policy/TIN); month-name dates;
  DOB / NYSCEF / future-date exclusion; DOS single-date; amount = total charge; carrier-suffix scan.
  **Recognition is fully case-insensitive.** New fields: `indexNumber` (court index, incl. CV-#/YY/CC),
  `dateFiled` (NYSCEF stamp), `bmFileNumber` (BRL_ / dotted). Hit rates on the 89-doc set: patient 75,
  provider 78, insurer 68, DOS 69, amount 51, claim 33, DOL 37.
- **Classifier** (`lib/ocr/mapping/classify.ts`): auto-files **87/89** (no-suggestion 2). Covers WC forms,
  litigation, arbitration, denials, POM (incl. EDI proof-of-submission), bills/superbills, billing letters
  (KR + QR letterhead templates), Rx (written-order/orthosis), radiology reports (impression/technique/
  3T MRI), verification req/resp, declaration/ID pages, and superbill coversheets → Misc.
- **Human-in-the-loop learning** (`lib/ocr/learning.ts`; models `OcrFilingFeedback`, `OcrEntityDefault`):
  logs suggestion-vs-choice + per-provider/carrier memory that biases future suggestions. Deterministic.
- **Case-type-aware routing** (`lib/documents/caseTypeRouting.ts` + Upload Docs case-type picker): WC
  matters route bills/letters/reports to the flat Workers' Comp folder (which gained the doc-type titles).
- **Reference cross-reference + matter predictor** (`lib/ocr/crossReference.ts`): resolves provider /
  carrier / patient to the registry (canonical + TIN) and predicts the matter from file# / claim# /
  index# / policy# / (patient+provider) against `ClaimIndex`; Upload Docs auto-selects a strong-key
  match. Read-only.
- **Populate empty Date Filed / Index Number** (`lib/documents/populateLitigationFields.ts`): filing a
  scan to a matter in a lawsuit can fill the lawsuit's blank Index Number / Date Filed — **operator-
  confirmed checkbox**, blank-only (never overrides), audited.
- **New Prisma models this session** (need `npx prisma db push && npx prisma generate`): `OcrFilingFeedback`,
  `OcrEntityDefault`. Tuning harness: `scripts/ocr-review-report.ts` (PHI-safe aggregate),
  `scripts/ocr-values-dump.ts` (full CSV). `ocr-samples/` is git-ignored (PHI). Verifiers:
  `verify-ocr-filing-learning-safety`, `verify-ocr-cross-reference-safety`,
  `verify-populate-litigation-fields-safety`.

### OCR — still to do (saved for a future session)
1. **Continue training on the inbox docs** — remaining field misses + any new document formats.
2. **Old-paper migration**: add an **"old file number"** field on the matter; when creating a new BRL_
   file, reference the old number; teach OCR the OLD numbering convention; cross-reference old → new BRL_
   so a scan carrying an old file number resolves to (and auto-associates with) the new BRL_ matter
   (extends `crossReference.ts` with old-file-number as a match key).
3. **Split large scans into multiple doc types** — page-level segmentation + per-segment classification
   so an 11-page mixed bundle (bill + report + POM) files as separate documents, not one blob.

## What's left (not built)
- **Document OCR consumers/UI** — the engine exists (above); the intake verify UI is still open (Upload
  Docs covers the operator-driven path). See `docs/document-folder-structure.md` for the folder taxonomy.
- **Native matter email (Outlook / Microsoft Graph)** — doc-folder spec #6. Send/receive email from
  the matter UI via Graph (Outlook stays the mail server), threaded to the matter (Message-ID/In-Reply-To
  + `[BRL_…]` subject tag), attach filed docs, replace the maildrop. Builds on existing `lib/graph/*`
  (`create-draft`, thread-sync). Inbound attachments feed the same folder-filing + OCR pipeline
  (`OcrExtraction.sourceType = email_attachment`). Large; its own workstream.
- **RBAC activation** — the Owner/operator gating is designed; import writes are gated by the flag +
  (for registry writes) the admin cookie. Wire real roles in.

## Authoritative design docs
- `docs/dow-data-dictionary.md` · `docs/carisk-data-dictionary.md` · `docs/manual-creation-intake.md`
  · `docs/document-folder-structure.md` · `docs/agent-orientation.md`

## Sample data (kept out of the repo on purpose — PHI)
`searchResults (3).xlsx` (Carisk) and `May 2026.xlsx` (Dow). Drag into chat only when raw-data
inspection is needed. Keep your own copies.

## To resume, tell Claude:
> "Read `docs/RESUME-HERE.md`, then continue. The import module (Dow, Carisk, Manual, Other
> Spreadsheet) is built and flag-gated, and the shared **OCR extraction engine** (`lib/ocr/`, Azure
> Document Intelligence) is built and proven. Pick up [OCR field-mapping profile + verify UI |
> Carisk Management Report | RBAC | your next item]."

_Last updated 2026-07-07: OCR classification/extraction tuning + human-in-the-loop learning + case-type
routing + reference cross-reference & matter predictor + operator-confirmed Date Filed/Index populate
(all on the Upload Docs flow); classifier auto-files 87/89. Three OCR follow-ups saved (continue
training, old-paper→BRL migration, split large scans). New models OcrFilingFeedback/OcrEntityDefault._
_Last updated 2026-07-06: Carisk Management Report built (Saved-Incomplete tracker keyed by CIC# +
admin view + Friday 8am ET Graph email via Vercel Cron); email send verified end-to-end from local._
_Last updated 2026-07-04: added the OCR engine foundation; baselined migrations + wired shadow DB for
`migrate dev`; remote renamed to `barsh-matters`._
