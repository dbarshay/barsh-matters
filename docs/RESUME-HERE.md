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

## NEXT: lawsuit-level document tree + auto-file (design agreed 2026-07-06)
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

_Last updated 2026-07-06: Carisk Management Report built (Saved-Incomplete tracker keyed by CIC# +
admin view + Friday 8am ET Graph email via Vercel Cron); email send verified end-to-end from local._
_Last updated 2026-07-04: added the OCR engine foundation; baselined migrations + wired shadow DB for
`migrate dev`; remote renamed to `barsh-matters`._
