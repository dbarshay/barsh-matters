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

### 2026-07-16 — Migration RESUMED and running (root cause: open-case logjam, not Atlas degradation)

**The migration is running again and storing docs.** The 2026-07-15 "Atlas is degraded" conclusion was
**wrong** — corrected here:

- **Root cause of the morning's "keeps stopping at the same spot":** only **43 open (priority 10) cases were
  still pending**, and `nextCases` orders `priority DESC` — so those 43 stragglers led **every** run, hung on
  their trees, and we Ctrl+C'd before they errored, so they stayed pending and led the next run too. The 325,475
  pending **closed (priority 0)** cases were stuck behind them and never got reached.
- **Fix:** parked the 43 stragglers (`UPDATE legacy_case SET status='error', attempts=999, error='manually
  skipped: stuck open straggler' WHERE priority=10 AND status='pending'`), then ran **newest-first** → dropped
  straight into the closed cases, which are healthy and servable — immediately storing `15/15`, `30/30`, even a
  `1786-file` case, mostly `0 failed`. (Recover the 43 later: `UPDATE legacy_case SET status='pending',
  attempts=0 WHERE error LIKE 'manually skipped%'`.)
- **The HTTP 500s are permanent unservable files, NOT an outage.** Staff confirmed old cases show docs as links
  that were never viewable/downloadable — Atlas's own UI 500s on them too (e.g. `44521-100045`). Servable cases
  (e.g. `44525-725361`) download fine. So the 2.6M "5xx" doc backlog is largely permanent loss (a LawSpades
  data-integrity issue worth raising with them — you may have a contractual right to the complete file).
- **Current run config (in tmux `migrate` on the VM):**
  `STALL_HALT_BATCHES=0 MAX_CASE_ATTEMPTS=1 CASE_CONCURRENCY=1 FILE_CONCURRENCY=8 FETCH_TIMEOUT_MS=8000 HTTP_RETRIES=0 npx tsx extract.ts --run`
  (newest-first = newest closed first; 8s + no-retry skips slow/broken cases fast). Keep concurrency at 1 —
  concurrency ≥3 makes Atlas buckle building trees (all time out). Progress this session: ~360k docs stored,
  pending 325,475 → ~322,773.
- **Repo commits (need `git push`):** `19304cf` fetch timeout + persist mkdir · `d3097ca` `STALL_HALT_BATCHES`
  · `36b614f` `CASE_PRIORITY` filter. VM has the fetch-timeout + stall patches applied via `patch-*.mjs`; VM
  `.env` has `ATLAS_REFRESH_TOKEN_FILE`. VM has no `psql` — run ledger SQL via Node + `pg` (see `*.mjs` helpers).
- **TODO:** let the sweep drain the closed cases; then a follow-up pass for RECOVERABLE errors — the 8s-timeout
  skips are servable-but-slow cases (rerun `CASE_PRIORITY=0`, longer `FETCH_TIMEOUT_MS`, concurrency 1) + deduped
  `--retry-errors` for transient 5xx. Refresh token needs a fresh browser grab ~every 24h.

### 2026-07-15 — Settlement stip template polish + Adversary File No. field; migration resume BLOCKED by Atlas degradation

**Template / builder work (all committed locally on `main`; VERIFY PUSHED — `git log origin/main..HEAD`):**
- `9824f4d` **"Production Ready" now clears the generation gate.** `finalize-preview` + `direct-finalize-preview`
  `buildStoredDbDocxTemplateDocuments`: `wouldGenerate = canGenerate || productionTemplateReady`, so a Production
  Ready stored template generates even when packet/matter validation says `canGenerate=false`. AND — the real gap —
  Production Ready templates now route `sourceEndpoint` through **`generate-preview`** (fills merge fields + the
  `{{#matters}}` loop) instead of the raw `stored-docx` passthrough (which returned the UNFILLED template). The
  production path is `working-docx` → `generateDocumentBuffer` (just fetches `sourceEndpoint`, no fill of its own) →
  so pointing Production Ready templates at `generate-preview` is what makes the delivery flow actually fill.
- `d859ad0` repeating table rows (settlement matters table auto-expands) — the loop engine (`expandLoopRows`) lives
  in `generate-preview/route.ts`; `\n` in a row value renders as a Word `<w:br/>`.
- `4a98e83` **DOS normalized to MM/DD/YYYY** in the matters table — exported `formatDate` from
  `templateTokenFormat.ts`, used in `templateTokenResolver.ts` for `row.dos`.
- Resolver also now **stacks** patient (given / surname) and DOS (start / end) onto 2 lines via `\n`.
- Template docx (`Stipulation-of-Settlement-TEMPLATE.docx`, built by `build_stip.py` — python-docx; npm `docx` is
  403-blocked): 8-col matters table, **explicit `<w:tblGrid>` gridCol widths** (per-cell `tcW` is overridden under
  fixed layout — must set gridCol) + `<w:noWrap/>` on File No / Balance so they don't wrap; File No widened. User has
  the .docx to re-upload. Confirmed end-to-end: production delivery generated a correctly filled + auto-expanded stip.
- `210c668` **NEW "Adversary Attorney File No." field** (lawsuit-level, beside Adversary Attorney). `app/matters/page.tsx`
  (new card on the Lawsuit Information row, tuned 5-col grid `0.8fr 1fr 1.1fr 1.1fr 0.75fr` shrinking Index/AAA + Date
  Filed; Edit button; free-form alphanumeric `text` kind). Persists to `lawsuitOptions.adversaryAttorneyFileNo` via
  `update-metadata` (present-key check preserves on omitting saves, still clearable). Mergeable:
  `{{lawsuit.adversaryAttorneyFileNo}}` (resolver + builder library). Typecheck clean. **It is lawsuit-level, one value
  per lawsuit** (confirmed with user — different file number per matter, entered manually, NOT from the attorney ref).

**Migration resume attempt — STOPPED; Atlas is degraded, do NOT run until it's genuinely fast again:**
- Ledger state (unchanged, resumable): **187,000 cases done / 42,934 error / 325,565 pending**; **54,345,420 docs stored
  (~20.9 TB logical)** / 2,725,151 doc error / 52,470 pending.
- **Two VM fixes made tonight — now ALSO ported to the repo (committed `2026-07-15`), so a re-scp won't regress them:**
  1. **`atlasClient.ts` had NO fetch timeout** → a hung Atlas socket (huge packet-tree generation) blocked `fetch`
     forever; at `CASE_CONCURRENCY=6` all workers parked = silent freeze. Patched on the VM via `patch-timeout.mjs`:
     `signal: AbortSignal.timeout(Number(process.env.FETCH_TIMEOUT_MS || 45000))`. **Now in the repo copy
     (`scripts/atlas-migration/atlasClient.ts`), committed.**
  2. **Refresh-token persistence was broken** → `refreshTokenFile` default `scripts/atlas-migration/.refresh-token`
     doesn't exist on the FLAT VM, so the rotated token was never saved; every `npx tsx` restart replayed the stale
     `.env` refresh token until IdentityServer **revoked the family** (the recurring 401 death, incl. probably the
     overnight one). Fix applied in VM `.env`: **`ATLAS_REFRESH_TOKEN_FILE=/home/azureuser/atlas-migration/.refresh-token`**.
     Repo now ALSO self-heals: `persistRefresh` `mkdirSync`s the token file's parent dir, so persistence works on a
     flat layout even without the env override (committed). `.refresh-token` added to `.gitignore`.
     Lesson: **launch ONCE and leave it running** — restart-thrashing is what burns the token family.
- **Error backlog understood (for a later `--retry-errors` pass, NOT a mass reset):** all 42,934 case errors are
  `"N files failed"` (28k are just 1 file short — downstream of doc failures, parked correctly). Doc errors are
  **95.5% `5xx`** (2.60M — server overload from earlier high-concurrency runs), 70k `403`, 52k `404`. The 5xx are
  recoverable via deduped `--retry-errors` (targets error docs directly, dedupes by file-ID) — must run SEPARATE from
  the main sweep (single-login rule).
- **Why we stopped — Atlas is wounded, not us:** all evening it cycled outage → false "back up" → we resume → UI
  crashes → degraded. **KEY user data point: earlier we pulled 10K+ file trees VERY fast; tonight a 4,275-file tree
  took ~180s and light load crashed their UI** → this is a server-side capacity collapse, NOT tree size and NOT our
  tuning (concurrency/timeout/order are irrelevant if their backend can't serve at speed). Not a targeted block
  (no disabled login, no 403s on our account; a spinning login = their outage). (An in-session note that Atlas had
  dropped the inline "view via icon" to download-only was RETRACTED — user was on the wrong screen; the viewer is
  present and doc-serving is unchanged.)

**TOMORROW — resume checklist (only when Atlas is genuinely FAST again):**
1. Gauge readiness by **speed, not the UI**: `LIMIT_CASES=1 CASE_CONCURRENCY=1 FETCH_TIMEOUT_MS=180000 npx tsx extract.ts --run`
   — a normal case's tree must snap back in seconds like before. Also confirm a single file `/view` download returns bytes.
2. Ensure VM `.env` still has `ATLAS_REFRESH_TOKEN_FILE=...` and the `atlasClient.ts` timeout patch is present
   (`grep AbortSignal.timeout atlasClient.ts`). Grab a **FRESH** token (family was revoked tonight):
   DevTools → `GetAccessToken` → `ATLAS_TOKEN`/`ATLAS_REFRESH_TOKEN` in `.env`, then `rm -f ~/atlas-migration/.refresh-token`.
3. Launch **ONCE**, gentle, in tmux `migrate`, and DON'T restart:
   `MAX_CASE_ATTEMPTS=1 CASE_CONCURRENCY=1 FILE_CONCURRENCY=8 FETCH_TIMEOUT_MS=180000 npx tsx extract.ts --run` → Ctrl+B D.
   Only nudge `CASE_CONCURRENCY` to 2–3 after it's clearly flowing. Monitor `--status` from a 2nd shell.
4. VM has no `psql` — run ledger SQL via Node + `pg` (see tonight's `reset-poisoned.mjs` / `diag-errors.mjs` pattern).
5. If Atlas ever shows **deliberate** restriction (disabled login, 403s on our account, `/view` gated/changed) →
   stop scraping and formally invoke the **contractual right to your own data** with LawSpades.
6. ✅ DONE — the two VM fixes are now in the repo: `atlasClient.ts` fetch timeout (`FETCH_TIMEOUT_MS`, default 45s)
   + `persistRefresh` `mkdirSync` so token persistence works on a flat layout, plus `.gitignore` for `.refresh-token`.
   A future scp of the repo scripts onto the VM is now safe. (The VM `.env` still needs its `ATLAS_REFRESH_TOKEN_FILE`
   + fresh tokens — those are runtime config, not code.)

### 2026-07-14 (evening) — Template builder fixes + new Settlement merge fields

All in `lib/documents/templateTokenResolver.ts` (preview + generation share this resolver) and
`src/lib/templates/template-builder-merge-field-library.ts` (the builder's field catalog). Committed + pushed.

**Bugs fixed (preview diverged from the real packet generator):**
- **Court address blank** — resolver now reads embedded `opts.selectedCourtDetails` first (venue picker), then a
  reference entity of type **`court_venue`** (was searching `["court","venue"]` — never matched). Court address
  keys use a `court`-prefixed convention: `courtAddressLine1/courtCity/courtState/courtZip` (+ generic fallbacks).
  ⚠️ `court.street` key was a best-guess from the phase48f design doc — VERIFY it populates after deploy; if still
  blank, hit `/api/admin/document-templates/example-preview-debug?matter=<id>` and match the real key.
- **Insurer/patient/provider blank at lawsuit level** — a lawsuit sample (YYYY.MM.NNNNNN) passes only
  masterLawsuitId, so no claim loaded. Now loads a **representative member claim** and resolves the SHARED
  identity fields (insurer, patient, provider, claim number, date of loss). Per-claim financials (balance, DOS,
  billed amount, denial reason) stay blank at lawsuit level — no single value.
- **Matter File Number** now resolves per sample: lawsuit number at lawsuit level, BRL number at individual level.
- Broadened street pick keys (address_line_1/streetAddress/street_address) for insurer/adversary too.

**NEW "Settlement" merge-field category:**
- Settled-with contact: `settledWith.name/email/fax/phone/company`. Name comes from the latest non-voided
  `LocalSettlementRecord.settledWith`; contact info from `ReferenceEntity` type **`individual`** (the Settlement
  Contacts list the name picker uses — `/api/reference-data/contact-search?type=individual`), matched BY NAME
  (the name is picked from the list = exact displayName, so reliable). Contact **ID is not persisted** on the
  settlement record, only the name — if duplicate contact names ever exist, switch to persisting
  `settledWithContactId` + ID lookup.
- Settlement record fields: `settlement.date/paymentExpectedDate/grossAmount/interestAmount/allocatedTotal/
  totalFee/providerNet/allocationMode` from `LocalSettlementRecord`.
- ⚠️ **Emails not yet seeded** into `details.email` on the individual reference entities (seed had phone/fax, no
  email). `settledWith.email` reads `details.email` — it will resolve automatically once the user populates emails
  there. OFFERED to write a name→email bulk-update script (a sibling to `scripts/build-settledwith-seed.mjs`);
  user said "do the emails later." Emails are the firm's primary settlement comms channel.
- Settlement fields only show values for a sample that has actually been settled (has a LocalSettlementRecord).


### 2026-07-14 — Within-case dedup skip + BATCHED DB writes (throughput ~2x); ATT_Letter breakage explained

**CURRENT RUN CONFIG (what the sweep should be running):**
```
cd ~/atlas-migration
MAX_CASE_ATTEMPTS=1 CASE_CONCURRENCY=10 FILE_CONCURRENCY=8 npx tsx extract.ts --run
```
tmux session `migrate` on VM `legacy-migrator` (`ssh azureuser@20.83.169.218`). Scripts FLAT in `~/atlas-migration/`.

**Status at end of session:** 68,799 / 555,499 cases done (12.4%); 35.1M docs stored (~14 TB *logical*; real
Azure footprint is far smaller after dedup); doc error rate **2.74%**. **~168 cases/min, ~1,400 docs/sec** —
up ~1.85–2.2x after the batch fix below. ETA ~2–2.4 days.

**Within-case dedup skip (commit 634ed13), ON by default (`WITHIN_CASE_DEDUP=1`).** Groups a case's leaves by
`file_name`; downloads the FIRST of each name, points the rest at its blob WITHOUT downloading, marking them
**`assumed`** (new `legacy_document.assumed` column). Safe: `(case,file_name,size)` = **0** collisions across
21.8M rows; `(case,file_name)` alone = 112/17.7M (0.0006%), all **within-patient** (packets are one patient/one
provider — confirmed), i.e. benign/sister-healed/caught-at-filing. **Live-verified** in LawSpades: a 59-member
packet's same-named copies were byte-identical. Skipping **~80% of downloads** on packet-heavy cases. Deferred
**`--verify-skips`** re-downloads assumed docs to confirm/fix (catches 100% since collisions differ in size) —
run at END only if access survives; realistically **sample-audit**, not full re-download (assumed pile is ~most
of the corpus).

**THROUGHPUT FIX — the ceiling was DB writes, not downloads/concurrency (commit 25f2965).** With ~80% of
downloads skipped the sweep went DB-bound; 6×8→10×8 did nothing (flat ~76 cases/min). Root cause:
`upsertDocuments` did a **per-doc INSERT loop** (3,753-file case = 3,753 sequential INSERTs before downloading).
Fix: **batched multi-row INSERT** (800/chunk) + **pg pool max 10→24** (`PG_POOL_MAX`) ⇒ **~2x** (76→168
cases/min, 756→1,397 docs/sec). Also batched the assumed-write (commit 20014d8, `markDocsAssumedBatch`).
**Lesson: docs/sec is the honest throughput metric; cases/min lies during small-case stretches.**

**Packet structure (confirmed live in LawSpades UI+API):** `/document/node/false` for ANY member returns **all**
members' docs, foldered by member case number. Same doc has the **SAME ImageId** across member views → file-ID
cache already dedups that (no re-download). BUT some packets (e.g. Burgos, 59 members) **physically copy** each
doc into every member folder with a **different** ImageId — that's what the file-ID cache misses and the
within-case skip catches (verified identical). Source of the "~84% avoidable downloads." Atlas exposes **no
HEAD, no content hash, no size** — so `(case,file_name)` is the safe request-free key and it's maxed.

**`_ATT_Letter_` files = the error driver, NOT a real problem.** 92–93% of all errors are ATT letters. ~37% of
all docs (10.7M rows) but ~82k **distinct** stored contents; a subset (~33k–49k distinct, growing) fail with a
**deterministic Atlas HTTP 500 "An error has occurred"** — verified by direct authed fetch: broken **at the
source** (unrenderable in LawSpades itself, all in `UNCATEGORIZED`). ~70% of distinct ATT letters migrated fine,
~30% source-broken/unrecoverable. 785k+ error rows collapse to ~49k distinct → deduped `--retry-errors` hits
each once at the end. Not data loss; nothing to fix.

**⚠️ NEXT:** let the sweep finish (~2 days) → deduped `--retry-errors` (RETRY_CONCURRENCY=2) →
`--report-failures --out atlas-failures.csv` (spot-check ATT letters in LawSpades while access remains) →
`--verify-skips` (likely sample-audit) → then full bulk MATTER import so BM matters exist with
`old_matter_number` and the Legacy Docs panel lights up.


### 2026-07-13 (evening) — Migration hardening: loop fix, auth blowup, file-ID cache, integrity audit

**The full sweep is RUNNING** on the VM (tmux session **`migrate`** — note: NOT `migrated`, that was a decoy
session holding a dead run; killed). Scripts live **FLAT** in `~/atlas-migration/` on the VM (`extract.ts`),
NOT in a `scripts/atlas-migration/` subdir like the repo — scp to `azureuser@20.83.169.218:~/atlas-migration/`.

**Live numbers (end of session):** 9,675 / 555,499 cases done; **1,292,118 docs stored**; doc error rate
**0.71%** (steady); ~57 cases/min, ~209 docs/sec. ETA ~2 days for the open matters, ~4.6 days for the closed
backlog (≈2.3 if concurrency is doubled) ⇒ **~4.5–6.6 days total**.

**Four bugs found and fixed (all committed):**
1. **Infinite re-processing loop** (`da1d793`). `nextCases()` kept `status='error'` cases eligible forever;
   they sort to the top (newest `case_id`), so once ~500 accumulated they filled every batch and the sweep
   stopped reaching NEW cases — spinning at 97% CPU, storing nothing, and pounding Atlas into MORE 500s.
   Fix: `legacy_case.attempts` + `MAX_CASE_ATTEMPTS` (default 3), then error cases step aside (their docs
   stay queued for `--retry-errors`). `run()` now also HALTS if a full batch stores zero documents.
2. **Refresh-token revocation — THE BIG ONE** (`3e11b1d`). The refresh token is **single-use and rotates**.
   At the 4h expiry EVERY worker 401s at once; the old code's 3-second "coalesce" let several fire concurrent
   refreshes, which **replayed a consumed token → IdentityServer revoked the entire token family** and auth
   died mid-run. Fix: true **single-flight refresh** (a `tokenGen` counter + one shared in-flight promise) plus
   backoff on 429/502/503/504. **NEVER run a second Atlas-touching process against the same login** — it
   recreates this exact failure (the in-process mutex can't coordinate across processes).
   *Recovery procedure, if it ever happens again:* log into LawSpades → DevTools → Network → filter `token` →
   the **`GetAccessToken`** XHR → Response has `access_token` + `refresh_token`. Put them in `.env` as
   `ATLAS_TOKEN` / `ATLAS_REFRESH_TOKEN`, **`rm -f .refresh-token`** (it holds the revoked token and takes
   precedence over `.env` — skipping this sends you straight back into the 401 wall), then reset the poisoned
   rows (`update legacy_case set status='pending', attempts=0, error=null where error like '%401%'`, same for
   `legacy_document`) so the outage doesn't permanently skip those cases. Then `--run`.
3. **Per-case `cached` counter** (`d22d8e6`) — a module-level counter was stolen by concurrently-running cases.
4. Stale ledger DB / app-DB fallback guard shipped to the VM (`config.ts`).

**The file-ID cache — the big win** (`de41b77`). Atlas serves the **same physical file under many cases**
(adjacent case numbers are usually the *same patient, different claims*). Before downloading, `storeDoc` now
checks whether that `atlas_file_id` is already stored and, if so, points the new row at the existing blob and
**skips the fetch entirely**. Measured: **46% of all downloads are avoidable** (and climbing as the cache warms).
Whole cases now complete with zero downloads (`236 files, 236 stored, 0 failed (236 cached)`). Doubled
throughput AND cut Atlas request volume ~46% (fewer 500s, quieter footprint).

**SAFETY — why the cache is sound, and how it stays sound** (`8ab993d`). It rests on `atlas_file_id → content`
being 1:1. That was **measured, not assumed**: across 311,813 ID-duplicate downloads (taken before the cache
existed), **zero** file IDs produced a different sha256. But a cache hit is a hash we no longer check, so
`AUDIT_CACHE_RATE` (default **1%**) re-downloads a random sample of cache hits and verifies the content hash
matches the blob being reused. A mismatch would mean documents could be attached to the **wrong matter**, so it
throws `CacheIntegrityError`, which is deliberately **never swallowed** by the per-doc/per-case handlers — it
**HALTS the run**. If you ever see it: do not restart, scope the blast radius first.
*Rejected:* deduping pre-download on filename+size. Atlas's tree exposes **no hash and no size** (fields are
`id, name, parent_id, parent_name, icon, node_level, expanded, friendly_name, ImageId, items, created_*`), and
name+size is a coincidence signal, not identity — two bills for the same patient (same template, same byte
count, different DOS/amount) would silently misfile onto the wrong claim.

**Dedup findings — storage is ~8x smaller than `--status` suggests.** `--status` sums **logical** bytes and
counts deduped files repeatedly. Real figures: **8.66x content dedup**, so 544 GB logical ≈ **63 GB actually in
Azure**. Full-corpus projection: **~3–4 TB, not 24 TB** ⇒ **~$300–400/yr** on Cool tier (earlier ~$2.6k estimate
was wrong — it was based on logical size).

**New pipeline modes** (`5b6deee`): `--retry-errors` (refetch stuck docs at low concurrency to drain the
*transient* Atlas 500s; whatever still fails is genuinely unservable), `--report-failures --out f.csv` (the
permanent-failure list — **spot-check these in LawSpades WHILE ACCESS REMAINS**), `--reconcile`.

**⚠️ NEXT (two reminders are scheduled in the desktop app):**
- **Tue 7/14 9am** — check status; if the open matters (`priority=10`) have drained, restart the closed backlog
  with `CASE_CONCURRENCY=8 FILE_CONCURRENCY=10` (closed docs matter less; a higher error rate is an acceptable
  trade there). If throughput does NOT scale with the dial and errors spike, that's **per-account throttling** —
  and *then* a second worker on one of the other LawSpades logins (plus a priority filter so the two take
  disjoint case sets) becomes the right tool. Not before.
- **Mon 7/20 9am** — once the sweep finishes: `RETRY_CONCURRENCY=2 --retry-errors`, then `--report-failures`.

**Clio→Azure (active docs):** scoped in `docs/clio-to-azure-active-docs.md` — BM is pre-launch, so no dual-write
and no cutover; just build Azure as the backend and delete the Clio wiring. **User has put this ON HOLD.**


### 2026-07-13 — Atlas→Azure legacy-document MIGRATION + BM "Legacy Docs" viewer (in flight)

**Context:** LawSpades / "445 ATLAS" (the old case-management system) is being decommissioned. We're
extracting **every document for every case (open + closed)** out of it and into Azure Blob, then serving
them per-matter inside BM — with Atlas out of the loop afterward. Case_Id == BM `old_matter_number`.

**Extraction pipeline — `scripts/atlas-migration/` (standalone; runs on a VM, NOT part of the Next app):**
- Reverse-engineered the Atlas REST API (`https://api.lawspades.com/AtlasAPI/api`, JWT bearer). Key endpoints:
  document tree `GET /case/{caseId}/document/node/false`; single file `GET /case/{caseId}/document/file/{fileId}/view`
  (raw bytes). Packets (`445-PKT…`) have **no** separate docs — a packet's docs are just its member cases',
  so individual Case_Ids capture 100%.
- **Auth/refresh:** access token lives 4h; refresh is an **OAuth2 refresh_token grant** against IdentityServer
  `https://identity.greenbills.health/core/connect/token` (client_id `ATLAS`, client_secret `secret`, Basic
  auth). `atlasClient.ts` does this automatically on 401 and **persists the rotating refresh token** to
  `.refresh-token` so multi-day runs are hands-off. (The `/refreshtoken` path in old code was wrong — abandoned.)
- **Storage:** Azure Blob **Cool** tier, container `atlas-legacy-docs`, content-addressed `by-hash/<xx>/<sha256>`
  (dedups shared sibling docs). Resumable/idempotent **ledger** (`legacy_case` + `legacy_document`) — ⚠️ this
  entry says "SAME Neon DB the app uses", which was the bug: it now lives in a **SEPARATE dedicated Neon DB**
  (see item 1 under OPEN/NEXT). Newest/open-first via `priority DESC, case_id DESC`.
- **Case lists:** `open-matters.csv` (175,219) + `closed-matters.csv` (380,280) = **555,499 cases** (from the
  LawSpades "Open/Closed file numbers" exports, in the Workspace folder).
- ⚠️ **The ~15 TB / ~2–3.5 day estimates below are SUPERSEDED** — see the 2026-07-13 (evening) entry above.
  Actual: **~3–4 TB** after 8.66x content dedup (logical size is ~8x larger and misleading), and **~4.5–6.6 days**.
- Helper scripts: `scripts/bulk-cleanup.ts`, `scripts/backfill-claim-number-normalized.ts`.

**Infra (Azure, managed by dbarshay):** storage account **brllegacydocs** (East US, LRS) + VM **legacy-migrator**
(D4s_v3, East US, Ubuntu 24.04, IP **20.83.169.218**). SSH from the Mac is now by **key** (`~/.ssh/id_ed25519`,
added to the VM's `authorized_keys`): `ssh azureuser@20.83.169.218`. Pipeline in `~/atlas-migration` on the VM
(scripts are **FLAT** there, not under `scripts/atlas-migration/`), runs in tmux session **`migrate`**
(detach: Ctrl+B then D — never Ctrl+C). `.env` there has ATLAS_TOKEN/REFRESH_TOKEN/CLIENT_SECRET,
AZURE_STORAGE_CONNECTION_STRING, MIGRATION_DATABASE_URL (= the **dedicated** ledger Neon DB), DRY_RUN=0,
LIMIT_CASES=0.
Run order: `--enumerate --from-csv closed-matters.csv` → `--enumerate --from-csv open-matters.csv --priority 10`
→ `--run` (in tmux, detach Ctrl+B D). Monitor: `npx tsx extract.ts --status`.

**BM "Legacy Docs" viewer — SHIPPED (commit d3de7a6, deployed):** additive, self-hides on non-legacy matters.
- `lib/legacyDocs.ts` — reads the manifest via **raw SQL** (no Prisma model, no schema conflict), groups a
  matter's docs by their LawSpades folder, mints ~15-min Azure **SAS** links, logs every open to
  `legacy_doc_access_log` (auto-creates). `GET /api/matters/legacy-docs` (tree) + `POST …/link` (SAS + audit).
- `app/components/LegacyDocsPanel.tsx` on the matter page. Serving model: **SAS links + BM-side access log**
  (fast, no Vercel proxy, private container). **Verified end-to-end** against `44526-832351` (172 files, correct
  folder tree). Deploy needs Vercel env `AZURE_STORAGE_CONNECTION_STRING` + `AZURE_BLOB_CONTAINER=atlas-legacy-docs`
  (set) and `npm i @azure/storage-blob` (done). No Prisma migration.

**⚠️ OPEN / NEXT:**
1. **`legacy_case does not exist` crash — RESOLVED.** Root cause: the ledger lived in the **app's** Neon DB,
   and the local-index **backup/restore** tooling reverts that DB from snapshots, dropping the raw ledger
   tables (Prisma-model registration did NOT help — a snapshot restore drops the data anyway). **Fix: the
   manifest now lives in a SEPARATE dedicated Neon DB** (`barsh-legacy-docs`, Neon `royal-pond-33623728`,
   host `ep-hidden-bird-atp8us2t`) that nothing else touches. `MIGRATION_DATABASE_URL` on the VM + Vercel env
   `LEGACY_DOCS_DATABASE_URL` both point at it; `lib/legacyDocs.ts` reads it via a dedicated pg pool
   (commit b021e4c). Pipeline now GUARDS against using the app DB and halts clearly if tables vanish
   (commit ec012e0). Verified end-to-end (viewer served `44526-832364` from the dedicated DB). ⚠️ scp the
   updated `config.ts`/`extract.ts` guard to the VM when convenient.
2. **Final reconcile pass** for `error`-status cases/docs (transient Atlas 500s) once the run drains.
3. **Run the full bulk MATTER import** (the NF closed importer, now fully built) so BM matters exist with
   `old_matter_number` — only then does the Legacy Docs panel light up on a real matter. Open matters (175k)
   also need importing into BM eventually.
4. **SECURITY:** the Neon `DATABASE_URL` password and the Atlas tokens appeared in chat during setup — rotate
   the Neon password (and treat Atlas creds as burned) before go-live; already on the HIPAA rotate list above.


### 2026-07-13 — NF Bulk 50-row trial VERIFIED CLEAN ✅ (full load paused for document-upload design)

**The 50-row trial passed end-to-end.** 50 rows → 50 created, **0 skipped**, 0 carriers recorded raw,
8 lawsuits / 22 aggregated / 28 standalone, 38 patients (all pre-2025 quarantined). Verified in the UI:

- **Insurers** all resolve to canonical names (Travelers Property Casualty Company of America, Motor Vehicle
  Accident Indemnification Corporation, Metropolitan General, ESIS…) — the legacy-map "number" bug is gone.
- **Claim numbers** now visible (19-2628593, IE17241, 0615323090101035…). Root cause was a bug in the SHARED
  creator: `lib/import/createMatters.ts` wrote only `claim_number_raw`, but the UI/search read
  `claim_number_normalized`. **Fixed for ALL import paths** (Dow/Carisk/Other/bulk). Dow+Carisk data was all
  test data so no backfill was needed, but `scripts/backfill-claim-number-normalized.ts` exists if ever needed.
- **Denial reasons** resolve to the canonical registry — `Medical Necessity (Peer Review)`, `Fee Schedule`,
  `No-Show (IME)`, multi-value handled. No more shout-case `FEE SCHEDULE`.
- **Courts** Title Case; **stage** blank; **Final Status** Closed; **lawsuits** born Closed; **`-legacy`**
  renders on both matter and lawsuit numbers (badges + lists).

**FINANCIAL MODEL — LOCKED (decided from the data, do not re-litigate):**
Source identities (verified over 40k rows): `Total Payment Received = Voluntary + Collection` (100%), and
`Suit Balance = Claim − Voluntary` (99.2%). The old system tracked **only one balance: the PRE-SUIT /
sued-for amount** — collections never reduce it. There is NO "Claim − all payments" column; computing one
would invent a figure and produce **negative balances in ~2.8% of rows** (worst −$14,457) because no-fault
collections include interest + fees and routinely exceed the bill.
→ **DECISION: `balance_presuit` = the sheet's Suit Balance, faithfully (fallback Claim when blank).**
This is what the importer already does. So a matter showing Claim $4,118.16 / Payments $1,146.67 /
Balance $4,118.16 is **CORRECT** — Balance is the sued-for amount; the Collection sits at the lawsuit level.

**THREE populations in the sheet** (from 30k rows) — the "is it a lawsuit" indicator is Court Name /
Index-AAA / Date AAA Arb Filed / Defendant being populated (NOT the Packet ID):
  - PKT + suit fields = 14,061 → aggregated lawsuit members (dotted lawsuit created)
  - **No PKT + suit fields = 6,507 → SINGLE-MATTER LAWSUITS** (sued alone; no PKT, no dotted number)
  - No PKT + no suit fields = 9,419 → never sued (pre-suit)
Already handled correctly by the existing rules: single-matter lawsuits keep Collection on the individual
matter (no dotted file), and their lawsuit-level fields go into the matter's NOTES.

**⏸ PAUSED — the full ~264k load has NOT been run.** Trial batch deleted; DB is clean.
Two things before the full load:
  1. **PERF/RESUMABILITY RISK:** the load is ONE HTTP request. The lawsuit phase creates each packet
     sequentially (sequence-counter upsert + insert + member update ≈ 3 round-trips each) — with tens of
     thousands of packets that's 100k+ sequential Neon round-trips, plausibly hours, and one failure loses
     the run. Options: time a 5,000-row trial to measure the rate, and/or make the job resumable+idempotent
     (dedupe on `old_matter_number`) and batch the lawsuit creation.
  2. **NEXT UP: DOCUMENT UPLOAD design** (user paused the load to discuss this). Recall the bulk import is
     deliberately LAZY-Clio — it creates zero Clio matters/folders. Docs will be added to most of these
     legacy files later, so the doc-upload path is what determines when/how Clio folders get created.

### 2026-07-10 (later 2) — More trial fixes; PAUSED mid-debug of first 50 (resume here)

Continued reviewing the 50-row trial. Fixes (all bulk-only unless noted):

- **Insurer showing NUMBERS — real bug, fixed.** `nf-insurer-legacy-map.csv` has 4 cols
  (`nf_value,count,canonical,kind`) but `bulkCarrierResolution.ts` read col-index-1 (`count`) as the
  canonical, so legacy-map carriers displayed their count (TRAVELERS→1496, GEICO INSURANCE COMPANY→17719,
  MVAIC→…, METROPOLITAN→287). Loader is now header-driven (reads the `canonical` column by name). Verified
  against real data. NOTE: only affects carriers that fall to the legacy map; strict-registry matches were fine.
- **Court capitalization** — new `normalizeTitleCase()` in `bulkAdapter.ts` applied to `court_venue`:
  `SIXTH DISTRICT COURT: PATCHOGUE`→`Sixth District Court: Patchogue` (minor words lowercased, NY/US/LLC etc.
  kept upper).
- **Required fields relaxed for bulk** → now ONLY Patient + Provider + Insurer are required. Claim/Policy/
  Packet, amount, DOS, Date Opened are recorded when present but never skip a row (MVAIC files legitimately
  have no claim/policy). Updated `mapBulkRow` validation + `BULK_FIELDS` required flags (Provider now required;
  Case_Id/DateOpened/DOS/ClaimAmount no longer required).
- **5 skips in the first 50 were:** Michele Thiele (no DOS); Seefat Aman ×2, Guillermo Sterling, Luz Candelario
  (no Claim/Policy/Packet — 3 are MVAIC). With the relaxed rule these now import.
- **`-legacy` on LAWSUIT (dotted) numbers** — was only on individual BM numbers. Added everywhere the master
  lawsuit number renders: matter-header "MASTER LAWSUIT ID" chip (`matter/[id]`), Home results Lawsuit ID
  col (`page.tsx`), Matters list Master Lawsuit col (`matters/page.tsx`), Lawsuits page master links, and the
  **master-workspace header badge** (`matters/page.tsx` ~9442, keyed on `rows.some(isLegacyMatter)`).
- Scoped `tsc` clean (only pre-existing styled-jsx warnings).

**⏸ RESUME HERE (clean slate):** the trial import was UNDONE via `npx tsx scripts/bulk-cleanup.ts --yes`
(removed 45 matters, 8 lawsuits, 33 patients; batch marked undone) — the DB currently has NO bulk data.
Next session: re-run a fresh 50-row trial with ALL the above fixes and re-verify — insurer names correct
(no numbers), courts Title Case, blank stage, lawsuits born Closed, `-legacy` on BOTH matter and lawsuit
badges (smaller/lighter style) + in lists, and the 5 previously-skipped rows now importing. Then build the
rejected-rows CSV export before the full ~264k load. All of today's fixes are committed + pushed.

### 2026-07-10 (later) — NF Bulk trial review: fixes from first 50-row run

Ran a 50-row trial (batch shown in UI). Result was internally consistent (45 created + 5 missing-field
skips; 21 aggregated into 8 lawsuits + 24 standalone; 33 patients, all pre-2025 quarantined). Fixes made
from reviewing the created records — all still bulk-only / additive:

- **Close-reason no longer pollutes `status`.** Confirm route now writes the legacy Status/Close Reason to
  `close_reason` ONLY (with `final_status="Closed"`), not also to `status`. (Was why Home's "Final Status =
  Closed" filter — which searches the `status` column — returned almost nothing.)
- **Bulk lawsuits are born CLOSED.** `lawsuitOptions` now carries `finalStatus`/`final_status`/`closeReason`
  (same fields `/api/lawsuits/close` writes), so aggregated lawsuits match their closed members instead of
  showing Open.
- **`-legacy` tag now renders everywhere the BM number shows** (was defined but never wired). New pure helper
  `lib/legacyDisplay.ts` (`isLegacyMatter`/`legacyTag`, keyed on `import_batch="nf-legacy"`). Wired into:
  matter header badge (`app/matter/[id]/page.tsx`), Home search results (`app/page.tsx`), Matters list rows
  (`app/matters/page.tsx`), and Lawsuit member rows (`app/lawsuits/page.tsx`). Carried through the shared
  `CLAIM_INDEX_SELECT` (`lib/claimIndexQuery.ts`) + `by-matter` route so list/search rows have the flag.
  Display-only — never fed to search/nav/Clio/email (those use the raw `display_number`).
- **Blank workflow stage.** Bulk matters now import with `matter_stage_name = null` (extra overrides the
  shared creator's default "PRE-LIT NEW COLLECTIONS INTAKE" — meaningless for closed historical files).
- **Service-type capitalization normalized** (bulk-only). New `normalizeServiceType()` in `bulkAdapter.ts`:
  Title-Cases words, preserves acronyms (MRI, PT, DME, EMG/NCV, ROM/MMT, 3T, XRAY, …), handles "/"+"-"+comma
  compounds, and drops the junk "--- Select Sevice Types ---" placeholder. e.g. `PHYSICAL THERAPY`→`Physical
  Therapy`, `CT-SCAN`→`CT-Scan`, `--- Select… ---, PT`→`PT`. Live importers still store service_type raw.
- **Cleanup script:** `scripts/bulk-cleanup.ts` — dry-run by default; `--yes` deletes the batch
  (`import_batch="nf-legacy"` matters, `clioMasterMappingSource="none-nf-bulk-import"` lawsuits, orphaned
  `source="nf-legacy"` patients) and marks bulk ImportBatches undone. Lets you re-run the trial clean.
- **How the app finds these:** it's search-driven — `/matters` and `/lawsuits` need a filter. Find bulk
  records via Home → search by Claimant / Claim / Insurance Company, or the header BRL# box.
- Scoped `tsc` on all touched files: clean (only pre-existing `<style jsx global>` warnings, unrelated).
- **Re-run after fixes:** `npx tsx scripts/bulk-cleanup.ts` (review) → `--yes` → redo the 50-row trial →
  verify lawsuits now Closed and `-legacy` shows in lists → then the full load.
- STILL OPEN: rejected-rows export (show which of the 5 skipped rows failed and why) before the full run;
  consider promoting frequent recorded-raw carriers into the legacy map.

### 2026-07-10 — NF Bulk importer FULLY WIRED (per-column mapping finalized)

- **Final column mapping LOCKED** and implemented (all bulk-only — live Dow/Carisk/Other importers and the
  matter/lawsuit code are untouched; only additive schema cols `ClaimIndex.import_batch` + `Patient.matchable`).
  - **Numbers by ORIGINAL year:** matters `BRL_{445YY}` (from Case_Id), lawsuits `{445-PKTYY}.MM.NNNNN`
    (from Packet). Confirm groups rows by matter-year → `createMattersFromStaged(group, undefined, {importBatch, whenYear})`;
    lawsuits use `buildMasterIdAt(lawsuit_year, earliestMemberMonth)`.
  - **Row = matter; PKT with ≥2 members = a Lawsuit (dotted).** Singletons stay standalone under `BRL_` — no
    dotted number (matches old system: PKT only when 2+ aggregated). Guard: `if (matterIds.length < 2) continue`.
  - **Per-row provider** (mapped "Provider" col → `resolveReferenceEntity(...,"provider_client")`, lenient →
    record raw). Operator's fixed provider is now just an **optional fallback** for blank-provider rows.
  - **Carrier + Defendant** resolve leniently too (Defendant → `adversary_attorney`).
  - **Financials seeded directly** (no receipts): `claim_amount`; `balance_presuit`=Suit Balance;
    `payment_voluntary`/`payment_amount` = **Collection when aggregated** (rolls up to the lawsuit's "Payments"),
    else **Voluntary+Collection** on the standalone matter. `final_status="Closed"`, `close_reason`/`status` set.
  - **Lawsuit-level fields** (Defendant→`lawsuitOptions.adversaryAttorney`, Court→`Lawsuit.venue`, Index/AAA→
    `Lawsuit.indexAaaNumber`, Date AAA Arb Filed→`lawsuitOptions.dateFiled`) go on the lawsuit when there's a PKT;
    on a **standalone matter (no PKT) they go into the matter NOTES** (`description`), with Date Bill Sent + Date
    Opened. (Confirmed: individual matters have **no** UI field for Index/AAA — it's sourced from lawsuit metadata.)
  - **Settled With** → `ClaimIndex.settled_with`. **Provider Group** is derived from the provider (col not imported).
  - **Lazy Clio** everywhere (no matter/folder created here; lawsuit `clioMasterMatterId=null`, `clioLazyCreate:true`).
- Files touched: `lib/import/bulkAdapter.ts` (added provider/settled_with/index/court/defendant/date_bill_sent/
  date_aaa_arb_filed/provider_group cols + matter_year/lawsuit_year to staged), `app/api/import/bulk/confirm/route.ts`
  (full rewrite per above), `app/admin/import/other/bulk/page.tsx` (provider now optional fallback).
  Scoped `tsc --noEmit` on all touched files: **clean**.
- **TO RUN:** `npx prisma db push` + `npx prisma generate` (for the two additive cols), set `BARSH_IMPORT_ENABLED=1`,
  then Admin → Import → Other Sources → **Bulk Import**. Do a **trial run (first N rows)** before the full load.

### 2026-07-09 — DenialReason seeding decisions locked; export/tally scripts; sandbox note tightened

- **DenialReason (#178) decisions LOCKED** — full rulings + verified seed mechanics in the reference-seeding
  section below. Canonical set exported: **16 entities, 0 aliases, no hidden `details`** (nothing to preserve).
- **New scripts:**
  - `scripts/export-denial-reason-reference.ts` — dumps canonical `denial_reason` (displayName, active,
    aliases, notes, `details`) → `docs/denial-reason-canonical-export.csv`; flags whether "Lack of Medical
    Necessity" exists (it does not) and lists any hidden `_hiddenImportFields` (none).
  - `scripts/nf-denial-reason-distinct.ts` — tallies distinct `DenialReasons` + row counts from
    `NF All Closed.xlsx` → `docs/nf-denial-reason-distinct.csv`.
- **Env-loader precedence bug fixed** in the export script: it loaded `.env` before `.env.local` with
  first-writer-wins, so a **stale `DATABASE_URL` in `.env` beat the fresh one in `.env.local`** (P1000
  auth-fail on the script even though `npm run dev` worked, since Next prioritizes `.env.local`). Fixed the
  load order to `.env.development.local` > `.env.local` > `.env`. NOTE: **both `.env` and `.env.local` define
  `DATABASE_URL`** — keep them in sync, or prefer `.env.local`.
- **Sandbox/egress reality (tightened the note below):** egress is allowlist-only — the proxy `403`s npm,
  prisma binaries, and Neon alike; the vendored engine is `schema-engine-darwin` on a Linux sandbox. So all
  prisma/DB/tsx-against-DB commands run on the Mac; the agent runs only pure-compute in-sandbox. The 39 MB
  `NF All Closed.xlsx` parse exceeds the 45s shell cap → background it.
- **Source spreadsheets location documented** (Sample data section): `~/Desktop/!!!!!Barsh Matters
  Workspace!!!!!/`.

### 2026-07-08 — reference seeding, DB/Vercel outage fix, matter/lawsuit UI

**DB/Vercel `password authentication failed for user 'neondb_owner'` — recurring, now solved.** This bit twice. Root cause: the Neon–Vercel integration performs **system-initiated secret rotations** (seen in Vercel → Storage → brl-clio-db → "A secret rotation was requested … with reason: `system`"), and it does **NOT reliably propagate the new password to Vercel's managed `POSTGRES_*` env vars** — so after a rotation the live app authenticates with a stale password. `.env.local` is static and Vercel env is build-time, so a rotation breaks both until manually refreshed + redeployed.
- **Final fix (deployed, `ddda953`):** `lib/databaseUrl.ts` `resolveDatabaseUrl()` now reads **`process.env.DATABASE_URL` FIRST, everywhere** (`DATABASE_URL || integrationBuiltUrl() || explicitUrl()`). We **no longer depend on the integration-managed `POSTGRES_*` vars** — an earlier version that built the URL from `POSTGRES_PG*` components failed because those vars are the ones that don't update. `DATABASE_URL` is maintained by hand. Wired into `lib/prisma.ts` and `app/api/auth/login/route.ts`.
- **When login fails again (the recovery runbook):** 1) Neon → project `brl-clio-db` → **Connect → `.env` tab → "Show password"** to get the current password. 2) Update **`DATABASE_URL`** in *both* Vercel env vars **and** local `.env.local` (find-and-replace the old password → new, or paste the whole `DATABASE_URL` line). 3) **Redeploy** on Vercel (env is build-time; a running deploy won't pick up an env change). 4) Restart `npm run dev` locally. Verify: the Node snippet `new Client({connectionString:…}).connect()` against both the `-pooler` and non-pooler hosts should return OK.
- Don't bother with "Rotate Integration Secrets" — it triggered one of these rotations and didn't sync Vercel. Treat the Neon password as a manually-managed secret in `DATABASE_URL`.

**Reference seeding (task #178, Approach A — match-or-create via the reference-data CSV import: `displayName` matches existing → update+attach `aliases`; no match → create; providers `active=false`; dry-run then confirm).**
- **Provider → `provider_client`** ✓ seeded — `docs/nf-provider-seed.csv` (22 alias-maps onto existing providers + 35 new inactive, title-cased). `Nitin Mariwalla` misspelled source left to manual.
- **Court → `court_venue`** ✓ seeded — `docs/nf-court-seed.csv` (10 alias-maps of legacy NF court names onto existing venues + 1 create `AAA Arbitration`; Supreme Court/Westchester/Onondaga/Lien/test dropped).
- **ServiceType → `service_type`** ✓ seeded — `docs/nf-service-type-seed.csv` (29 update: Title-cased the ALL-CAPS displays + 406 source aliases, compounds → primary service; 3 create: Orthopedic, Pain Management, Acupuncture). `UNKNOWN` renamed to **`Unknown/Other`** (kept `UNKNOWN` as an alias so it still resolves). ~97% of rows resolve.
- **Insurer → `insurer_company`** — **IN PROGRESS (2026-07-09), NOT yet imported.** The canonical table is authoritative: **889 legal entities** (NAIC #s, addresses, parent `hidden_group_name`), full legal names — NO brand entries. So this is **match-ONLY, no creates, NO fuzzy** (Levenshtein is dangerous here: GEICO→WESCO, Mercury→Mercer, Encompass→Compass all lev≤2 but WRONG). Matching = **tight exact-equivalence** (compact normalize + abbrev-expand co/ins/corp… + strip d/b/a & ", SI"), never edit-distance. 1,060 NF values → **98.3% resolved**:
  - **Exact** (269 vals): resolve by normalized name, no action.
  - **Clean-equivalent aliases → REGISTRY** (`docs/nf-insurer-aliases.csv`, 90 aliases onto 57 canonicals): true synonyms of existing canonicals only (Countrywide→Country-Wide, All State→Allstate, "…C/O Assigned Risk Solutions"→Integon National, "…D/B/A GMAC"→New South, Church Mutual→"…, SI", NY Central Mutual→"…Fire", Clear Blue→Company). Safe/permanent; help all imports.
  - **Brand-generic + curated + TPAs + self-insureds → BULK-ONLY LEGACY MAP** (`docs/nf-insurer-legacy-map.csv`, 216 vals / ~67.6k rows): consumed ONLY by the future NF bulk importer, **never written to the registry** — so regular imports stay strict.
  - **Unmatched** (`docs/nf-insurer-unmatched.csv`, ~483 vals / 4.5k rows): real carriers not in the table (Adirondack, Global Liberty, Good2Go, Safe Auto, CURE, Auto-Owners, First Acceptance) + pure TPAs (Komodo, Genoteq, Medlogix, Assigned Risk Solutions) → **recorded raw** on the closed matter in the bulk load; not mapped/created.
  - **KEY ARCHITECTURE DECISION (implement in importer):** leniency (brand-generics, legacy map) applies **only to huge dumps**; **regular imports must resolve strictly against the registry** (canonical + clean aliases) and HOLD unmatched (`carrier_unmatched`). The imprecise stuff never becomes a `ReferenceAlias`, so we're never blocked from later promoting a value to a canonical.
  - **Flagship picks (brand-generic → primary entity):** GEICO→Government Employees Insurance Company; State Farm→State Farm Mutual Automobile; Progressive→Progressive Casualty; Allstate→Allstate Insurance Company; Liberty Mutual→Liberty Mutual Insurance Company; USAA→USAA Casualty; Nationwide→Nationwide Property & Casualty; Farmers→Farmers Property & Casualty; Safeco→Safeco National; National General/Integon→National General Insurance Company; Plymouth Rock→…of New York; Mercury→Mercury Casualty; Travelers→Travelers Property Casualty Co of America; **Hartford→Hartford Underwriters (defaulted, "no preference" — revisit)**; Kemper→Kemper Independence; Metropolitan/MetLife→Metropolitan General; Hanover→Hanover Insurance Company; Infinity→Infinity Insurance Company; 21st Century→21st Century Insurance Company; MVAIC→Motor Vehicle Accident Indemnification Corporation; Republic Western→Repwest; **Bristol West→21st Century Casualty Company (REVIEW — normally a Farmers brand)**; MTA/NYCTA→NYC Transit Authority; Avis→Avis Rent a Car; Enterprise/Elrac/Rental Claims→Elrac; Sedgwick→Sedgwick Claims; ESIS→ESIS Insurance Company; Comptroller→City of NY Comptroller; The General→unmatched.
  - Scripts: `scripts/insurer-match-preview.mjs`, `scripts/build-insurer-maps.mjs`, `scripts/export-reference.ts <type>` (generalized canonical export).
  - **▶ START HERE NEXT SESSION — rescue the high-value unmatched (per user: "some should probably be matched").** Work `docs/nf-insurer-unmatched.csv` top-down; decide each: alias onto an existing canonical (may be in the table under a different legal name), brand-generic→flagship, or genuinely add-as-new. Candidates (rows): NATIONAL INSURANCE COMPANY (107, generic/ambiguous); Adirondack Insurance Exchange + "COMAPNY" typo (~138, not in table); First Acceptance (~100, not in table); Good To Go Auto (59); Safe Auto (58); Global Liberty Insurance Company (51, NY carrier); CURE Auto (50); AAA Insurance Company (44); American Country Insurance Company (43); Utica Insurance Co. (42 — likely Utica Mutual or Utica National — CHECK); Peak Property and Casualty (41). Several of these are real carriers **absent from the 889-entity registry** — decide per-carrier whether to alias to a near-entity, add a new canonical (the only creates), or leave bulk-recorded.
  - Then: (a) rebuild maps; (b) import `nf-insurer-aliases.csv` via reference-data admin (type `insurer_company`, all updates, no creates); (c) wire the legacy map + strict-regular-imports into the matter importer (matter-import workstream).
- **ProviderGroup** — no reference table; it's a **hidden, provider-derived field.** 39/44 NF codes exactly match `provider_client` records' `details._hiddenImportFields.hidden_provider_group_name`. Importer rule (#178): derive `ClaimIndex.providerGroup` from the resolved provider's hidden group (NF column as fallback); **exclude** `KOFFLER-MUA`, `SVETLANA`, `CELLA-SENI`, `LEVI-TRISH-SENI`, `TEST-GROUP`.
- **DenialReason → `denial_reason`** ✓ IMPORTED (2026-07-09) — `docs/nf-denial-reason-seed.csv` (22 rows: 16 update incl. Wrong-Carrier hyphen-rename + 6 create: No Coverage (Other), No Coverage (Workers Compensation), Duplicate Billing, PPO/Carrier Contract, Verification/Investigation Pending, Deductible). 99.0% of rows mapped; import confirmed via reference-data admin (6 create / 16 update / 810 aliases).
- **Defendant → `adversary_attorney`** ✓ IMPORTED (2026-07-09; history: 60 rows / 23 created / 37 updated / 39 aliases) — Defendant column holds **defense law firms**, not carriers. `docs/nf-defendant-seed.csv` = **60 firms (37 update + 23 create)** after a ≥30-row cutoff on new firms. Source: 353 distinct firm strings (`docs/nf-defendant-distinct.csv`) clustered by `scripts/build-defendant-seed.mjs` (curated rules for high-volume families + key-based auto-merge; strips Law Office(s) of / suffixes / punctuation / carrier tags like `(ALLSTATE)`/`- PROGRESSIVE`/`(Suffolk)`). Full source→canonical mapping written into the **Defendant tab of `NF-normalization-worksheet.xlsx`** (Desktop workspace folder; `.bak.xlsx` saved) + `docs/nf-defendant-mapping.csv`. Review rulings applied: Goldstein/Flecker/Hopkins family → existing **Law Offices of Eileen Hopkins**; Rubin & Nazarian → existing **Law Offices of Ruth Nazarian**; Buratti Rothenberg & Burns kept distinct from Rothenberg & Romanek. **Cut:** 241 new firms <30 rows dropped (875 rows, ~1%; blanked in worksheet w/ note). Dropped 2 non-firms (a judge, a carrier). NEXT: import via reference-data admin (type `adversary_attorney`) → preview (expect 37 update + 23 create) → confirm. Generic tally helper: `scripts/nf-column-distinct.mjs "<xlsx>" "<header-regex>" "<out.csv>"` (reuse for SettledWith/Status/Insurer).
- **Status → `closed_reason`** ✓ IMPORTED (2026-07-09; history: 21 rows / 4 created / 17 updated / 92 aliases; then renamed POLICY EXHAUSTED/NO COVERAGE → …/MVAIC via `scripts/rename-reference-entity.ts`) — 134 distinct close/status values (`docs/nf-status-distinct.csv`) → `docs/nf-status-seed.csv` = **21 rows (17 update + 4 create)** via `scripts/build-status-seed.mjs`. PAID family (226k rows) folds into the 5 existing PAID(x) buckets; 2,698 rows of workflow stages + bare "CLOSED" dropped. Review rulings: AAA losses (+ "Losing AAA Award") → existing **AAA- DECISION- DISMISSED WITH PREJUDICE**; generic DECISION-LOSS → **MOTION LOSS**; returned-to-client family → **PER CLIENT**; AAA without-prejudice + court dismissals + lien + 30-day/NF2 → new **OTHER**; new canonicals **DUPLICATE / DISCONTINUED WITHOUT PREJUDICE / CARRIER IN LIQUIDATION / OTHER**. MVAIC (`CLOSE FILE - MVIAC NOT QUALIFIED`, 1.85k) attaches to **POLICY EXHAUSTED/NO COVERAGE**, which then must be renamed to `POLICY EXHAUSTED/NO COVERAGE/MVAIC` — the CSV importer can't rename to a differently-normalized display, so use `scripts/rename-reference-entity.ts closed_reason "<old>" "<new>"` AFTER the import. Mapping audit in worksheet Status tab + `docs/nf-status-mapping.csv`. New helper: `scripts/export-reference.ts <type>` (generalized canonical export).
- **VerificationStatus + PlaintiffAttorney → ELIMINATED (2026-07-09, per review — not seeding).** VerificationStatus is only 2 workflow values (`VER ANSWERED`, `VER REQUESTED`) — not a reference taxonomy; PlaintiffAttorney is the `Header not found` junk sentinel (no real data). Neither gets a reference seed.
- **SettledWith → "Settlement Contacts" (`ReferenceEntity` type `individual`)** ✓ IMPORTED (2026-07-09; history: 288 rows / 271 created / 17 updated / 356 aliases). SettledWith values are adjuster **people** in `NAME =>[ADJ.PH#: … /ADJ FAX#: …]` format. Seed `docs/nf-settledwith-seed.csv` built by `scripts/build-settledwith-seed.mjs` (reads the FULL NF xlsx for SettledWith × Date Opened). **Keep rule:** all-time > 25 AND (≥10 matters opened since 2025-01-01 OR ≥1 opened in 2026) → **288 contacts**. Clusters same-name variants, fuzzy-merges spelling dupes (Levenshtein/surname; denylist keeps Kevon≠Kevin Lewis), drops firms/junk/`&`-combos, and **reconciles display names against the live table** (`docs/individual-canonical-export.csv`) so existing contacts UPDATE not duplicate (fixed Fitzsimons→Fitzsimmons, Lynette→Lynnette). Columns `phone`/`fax`/`role`/`settledWith` → `details`. Helpers: `scripts/nf-settledwith-recency.mjs`, `scripts/compare-settledwith-existing.mjs`. **Import gotcha:** load the *seed CSV*, not `NF-normalization-worksheet.xlsx` (its first sheet has no Display Name column → "Exactly one CSV column must be mapped to Display Name").
  - **"Settlement Contacts" reference type (2026-07-09):** the `individual` type was **relabeled** "Individuals" → "Settlement Contacts" (key kept `individual` for back-compat; no migration) in `lib/referenceData.ts` (label + `settled_with`/`adjuster` aliases), `app/admin/reference-data/page.tsx` (DEFAULT_TYPES), `app/api/reference-data/options/route.ts`. The settlement **"Settled With" picker now derives from this reference list** — `app/api/settlements/contacts/route.ts` queries `ReferenceEntity` type `individual` (email/phone/company from `details`) instead of the standalone `SettlementContact` table. **These are code changes — commit + deploy required** (a Vercel "Redeploy" of the old commit won't show the new label). Test junk purged via `scripts/cleanup-test-individuals.ts` (deleted 3 inactive Import-smoke rows). `VerificationStatus` + `PlaintiffAttorney` eliminated (not seeding).
- **Still to seed:** Insurer (in progress — files built, not imported; see above). All other taxonomies done.
- **Patients (Claimant) — NOT a reference seed; handled by the matter import.** ~42k distinct claimants ≈ 1 per matter (high-cardinality per-matter entities, not a controlled vocabulary). Created into the `Patient` master by the importer. **Bulk-load dedup design (task, 2026-07-09):** don't rely on per-row name fuzzy (would flood holds + create misspelling dupes). Pre-cluster with **strong accident/claim key (Packet ID > Claim# > Policy#+DOL > solo) + fuzzy NAME within that group** — folds misspellings ("JON/JOHN SMITH" same packet), keeps families apart by first name, never merges across groups on name alone. Analysis (`scripts/nf-patient-cluster-analysis.mjs`): 264k rows → **43,651 distinct patients** (naive exact-name would both dup misspellings AND wrongly merge namesakes). Decision: **per-accident** (same person, different DOL = separate Patient — benign split beats wrong merge). NEXT: emit per-matter→canonical-patient map at import time; **gated on Insurer** (bulk import can't run until insurer resolves).
  - **PRE-2025 QUARANTINE (decision 2026-07-10):** for the one-time bulk load, patients on matters **opened before 1/1/2025** are recorded **bulk-only** (kept on the historical matter) and are **NOT written to the live patient registry** used for future-import matching; only **2025-and-later** matters seed matchable canonical patients. Rationale: an 18+ month gap makes it very unlikely a future import's patient is legitimately the *same person* as a pre-2025 closed-matter patient, so excluding them removes far more risk (old-misspelling false-merge collisions) than it costs (a rare missed re-link). Within-bulk dedup clustering still runs so the historical records themselves are deduped — those pre-2025 identities just stay quarantined from the live matching namespace. This is the **patient analog of the insurer registry-vs-legacy-map quarantine.**
  - **LEGACY FILE-NUMBER MARKING (decision 2026-07-10):** goal = make bulk-imported (legacy) matters clearly distinguishable. **Do NOT append `-legacy` to `ClaimIndex.display_number`.** That field is parsed by strict regexes — `lib/clioStoragePlan.ts` uses `/^BRL_\d{9}$/` and `/^BRL_(\d{4})(\d{5})$/` to build Clio folder/storage targets, plus finalize-normalization / claim-index prefix / matter-search parsers — so any suffix breaks Clio storage routing. Instead: add a dedicated flag on `ClaimIndex` (e.g. `import_batch = 'nf-legacy'` or a boolean) and render the `-legacy` suffix **only in the display/UI layer** (matter lists, document titles). Keeps the canonical `BRL_YYYYNNNNNN` parseable while making legacy files obvious. If a literal tag in a number-string is truly required, put it on the dotted presentation label, never on the parsed `display_number`.
  - **BULK IMPORTER BUILT (2026-07-10)** — lives under **Import OTHERS → "Bulk Import"** (`app/admin/import/other/page.tsx` card → `app/admin/import/other/bulk/page.tsx`). Flow: upload xlsx → map columns (auto-suggested) + pick fixed provider/case-type → **aggregate** preview → confirm. Files: adapter `lib/import/bulkAdapter.ts` (`BULK_FIELDS`, `mapBulkRows`; adds `opened_date` for the pre-2025 quarantine + an **accident key** Packet ID > Claim# > Policy#+DOL > solo, and a `patient_cluster` = accident_key+nameKey); lenient carrier `lib/import/bulkCarrierResolution.ts` (**strict registry → bulk-only `docs/nf-insurer-legacy-map.csv` (never written to ReferenceAlias) → record RAW**; never held); routes `app/api/import/bulk/{headers,preview,confirm}/route.ts` (all flag-gated by `BARSH_IMPORT_ENABLED`, source `"bulk"`). Confirm clusters patients by accident key, creates **one Patient per cluster** (createMany w/ explicit ids), sets **`matchable=false` for pre-2025** clusters (quarantine) / true for 2025+, pre-assigns `patient_id` so `createMattersFromStaged` makes no extra patients, records the carrier string via `extra.insurer_name`, and stamps **`import_batch="nf-legacy"`** on every matter. **Packet→Lawsuit aggregation (2026-07-10):** after matters are created, rows sharing a **Packet ID** are grouped into a **Lawsuit** (dotted `masterLawsuitId` via `buildMasterId`, `lawsuitMatters` = CSV of matter_ids, `Lawsuit.lawsuitOptions.source="nf-bulk-import"`), and each sibling's `ClaimIndex.master_lawsuit_id` is set; rows with no Packet ID stay standalone matters (currently a lawsuit is created even for a 1-matter packet — trivially switch to ≥2 if singleton lawsuits aren't wanted). **Legacy numbers carried:** **445 → `ClaimIndex.old_matter_number`** (per matter, via `bulkExtraFields`) and **445-PKT → `Lawsuit.oldLawsuitNumber`** (per packet). Mapping adds two columns for these in `BULK_FIELDS`. **Shared-lib changes:** `ClaimIndex.import_batch` + `Patient.matchable` (schema — **run `npx prisma db push` + `npx prisma generate` on the Mac**); `resolvePatient` now filters `matchable:true`; `createPatient(name, source, {matchable})`; `createMattersFromStaged(rows, provider?, {importBatch?})`; `formatMatterDisplayLabel()` in `lib/matterNumbering.ts` (display-only `-legacy`). **v1 caveats / TODO:** (a) does NOT yet link a 2025+ bulk cluster to a pre-existing live patient (creates its own — safe for closed historical matters; add cross-link later, e.g. via `scripts/nf-patient-cluster-analysis.mjs`); (b) processes the whole file in one request (run **locally**, no serverless timeout, or wrap the confirm logic in a CLI) — the `maxRows` box does a small trial run first; (c) no per-row `ImportRow` persisted for a load this size (only an `ImportBatch` summary); (d) `docs/nf-insurer-legacy-map.csv` is optional — with our final design the registry already holds the clean aliases and everything else records raw, so the file can be absent (loader no-ops).
- **VerificationStatus + PlaintiffAttorney — ELIMINATED** (not seeding; VerificationStatus = 2 workflow values, PlaintiffAttorney = `Header not found` junk).
  - **DenialReason — seed CSV BUILT (2026-07-09), pending the admin reference-data import.** Canonical `denial_reason` =
    **16 entities, 0 aliases, and NO hidden `details`** on any of them (checked via the export below —
    nothing to preserve/merge). Full canonical list → `docs/denial-reason-canonical-export.csv`, produced by
    `scripts/export-denial-reason-reference.ts` (also prints whether "Lack of Medical Necessity" exists: it
    does NOT — the only medical-necessity canonicals are IME / Peer Review / Causality; No Coverage has only
    subtypes, no generic). Distinct source values tallied by `scripts/nf-denial-reason-distinct.ts` →
    `docs/nf-denial-reason-distinct.csv`. Rulings:
    - Generic `MEDICAL NECESSITY` (~11k, no subtype) → **alias onto `Medical Necessity (Peer Review)`**.
    - Generic `No Coverage` (~1k, no subtype) → **create `No Coverage (Other)`**.
    - **Create** new categories: `Duplicate Billing` (~1.7k), `No Coverage (Workers Compensation)` (~568 —
      as a No-Coverage subtype, NOT a standalone WC category), `PPO/Carrier Contract` (~387 — PPO networks
      incl. Coventry + carrier agreements: standalone `Agreement with carrier` / `NHQ negotiation Payment` /
      `Services not provided or authorized by network/primary care providers`),
      `Verification/Investigation Pending` (~498), and `Deductible` (~63 — standalone `DEDUCTIBLE` /
      `Deductible Applied` / `policy deductible`).
    - **Rename** existing `No-Coverage (Wrong Carrier)` → `No Coverage (Wrong Carrier)` (drop hyphen). Done as
      a normal seed row: `normalizeReferenceText` collapses all punctuation to spaces, so both normalize to
      `no coverage wrong carrier` → row matches the existing entity → confirm's UPDATE path overwrites
      `displayName`. No separate migration needed.
    - Residual ~3%: compounds → alias onto the primary/first reason; junk (blank/placeholder) dropped.
    - **Seed mechanics (verified in `lib/referenceImport.ts` + `app/api/reference-data/import-confirm/route.ts`):**
      match is by **normalized displayName ONLY** (aliases do NOT match to an existing entity); on UPDATE the
      confirm overwrites `displayName`/`normalizedName`/`notes`/`active` (blank `active`→true, blank `notes`→null),
      so **fill `active` and `notes` on every seed row** to avoid clobbering. Same seed pattern as ServiceType.
    - **Build:** `scripts/build-denial-reason-seed.mjs` (pure compute, ran in-sandbox) → `docs/nf-denial-reason-seed.csv`
      (22 rows: 16 existing incl. Wrong Carrier rename + 6 new) + `docs/nf-denial-reason-seed-report.md`. **Coverage:
      96,463 / 97,486 rows = 99.0% mapped**; 1,023 rows (1.0%, 36 distinct) dropped as non-denial statuses
      (Partially/Fully paid EOB, Pharma Portion, No Denial Issued, Settlement, Improper licensure, data-quality
      strings — deductible + carrier-agreement values are now their own categories). Whole-value OVERRIDE routes only
      the STANDALONE `Agreement with carrier`/`NHQ negotiation Payment`/`Coventry Contract` → PPO/Carrier Contract and
      standalone deductible values → Deductible; compounds still fall through to their primary reason. Seed mirrored to
      the Desktop workspace folder.
    - **NEXT:** import `docs/nf-denial-reason-seed.csv` via the reference-data admin importer (type `denial_reason`):
      upload → **preview** (expect ~16 update + 6 create; the Wrong Carrier row shows as update+rename) → confirm.
      Then Defendant / SettledWith / Status / VerificationStatus / PlaintiffAttorney remain (Insurer still deferred).
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
- The agent's Linux sandbox has **allowlisted egress only** — a proxy `403`s every non-allowlisted host
  (npm, prisma binaries, and Neon alike), so `npx prisma generate`, any Prisma query, and any DB/network
  command fail there. It's not just the engine download: the vendored engine is `schema-engine-darwin`
  (macOS, from your Mac), the sandbox is Linux, and the real wall is that Neon's Postgres host isn't
  reachable. **You (the user) run all git + prisma + tsx-against-DB commands** on your Mac; results
  propagate to the shared `node_modules` mount the sandbox sees. The agent CAN run pure-compute scripts
  in-sandbox (e.g. an xlsx tally via the installed `xlsx` pkg) when given the input file.
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

## Sample data / source spreadsheets (kept out of the repo — PHI)
These live in the Desktop folder **`~/Desktop/!!!!!Barsh Matters Workspace!!!!!/`** (NOT in the repo). In
Cowork, **connect that folder** (the agent can request-access to it by path) when raw-data inspection is
needed — don't copy PHI into the repo. Current contents:
- **`NF All Closed.xlsx`** (~39 MB, 264,179 rows) — the legacy no-fault migration source; column inventory in
  `docs/nf-all-closed-analysis.md`. This is the source for the #178 reference-seed distinct-value tallies.
- **`NF-normalization-worksheet.xlsx`** — working normalization/reconcile scratch for the reference seeds.
- **`Carerisk.xlsx`** (Carisk clearinghouse export) and **`Dow.xlsx`** (Dow provider spreadsheet) — import test data.
- Seed CSVs are mirrored here too (`nf-provider-seed.csv`, `nf-court-seed.csv`, `nf-service-type-seed.csv`),
  plus `Barsh Matters Templates` / `Barsh Matter New Templates` / `brand` asset folders.
- **Sandbox caveat:** parsing `NF All Closed.xlsx` (39 MB) in-sandbox exceeds the 45s shell cap — run such
  tallies **backgrounded** (`nohup node … &`, then poll the log/output), or run the `tsx` script on the Mac.

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
