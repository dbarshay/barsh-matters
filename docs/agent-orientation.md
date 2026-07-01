# Agent Orientation — clio-lawsuit-aggregator

Read this first. It captures the architecture, the non-obvious conventions, and the
gotchas so you don't have to rediscover them every session. Keep it updated when these
facts change.

## What this app is

Next.js (App Router) + TypeScript + Prisma (SQLite locally, Postgres/Neon in prod),
deployed on Vercel. It is **Barsh Matters**, a legal practice tool for a no-fault
firm: it aggregates lawsuits/matters from Clio, manages claims, generates documents
from Word/Excel templates, and tracks admin users/permissions.

Dev server: `npm run dev` (runs with `NEXT_DISABLE_TURBOPACK=1`). App runs at
`http://localhost:3000`. The non-standard Next build is intentional — see `AGENTS.md`.

## Target platform: Windows-first (built on Mac)

Development happens on macOS, but the app is **used primarily on Windows** machines.
It's a Vercel-hosted web app, so end users just open it in a browser. Key facts:

- **Browser: Google Chrome is required for all users, including on Windows.** Chrome-only
  browser behavior is acceptable; no need to support Edge/Safari/Firefox for end users.
- **Native integrations are Microsoft-first (good on Windows):** "Edit Document" opens via
  the `ms-word:` protocol (opens Word desktop), "Email Finalized Document" creates an
  Outlook draft via Microsoft Graph and opens it via an Outlook web/desktop link, and
  printing uses the browser print dialog. Prefer these over Mac-only or shell-based
  approaches, and avoid hardcoding POSIX-only paths/commands in anything that runs on a
  user's Windows machine.
- **Backups run on the dedicated Mac** (removable disk + cloud), NOT on Windows clients, so
  the Mac LaunchAgent backup path remains correct (`scripts/backup-local-indexes*.mjs`).

## Clio is storage-only (critical architecture rule)

- **Clio is used ONLY as a finalized-document repository.** Barsh Matters owns the
  file numbers and lawsuit numbers, not Clio.
- All finalized documents live in **one** Clio matter, "Barsh Matters Master
  Repository" (matterId `1885821245`), inside a folder tree we created.
- Folder taxonomy for a direct matter:
  `Individual Matters / BRL-{rangeStart}-BRL-{rangeEnd} / BRL_YYYYNNNNN`
  (buckets of 1000, e.g. `BRL-202600001-BRL-202600999 / BRL_202600001`).
- Direct matter display-number format is locked to `BRL_YYYYNNNNN`. Inputs like
  `BRL202600001` or `202600001` are normalized to `BRL_YYYYNNNNN`.
- Documents must be openable from the Barsh Matters UI via
  `/api/documents/clio-document-open?documentId=<id>&mode=inline`.
- Env: `CLIO_SINGLE_MASTER_ROOT_FOLDER_ID` (primary). Upload writes are gated behind
  `CLIO_SINGLE_MASTER_UPLOAD_REWIRE_ENABLED`, `CLIO_SINGLE_MASTER_CREATE_FOLDERS_ENABLED`,
  `CLIO_SINGLE_MASTER_LIVE_WRITE_ENABLED`.

### Clio boundary — source of truth (ADR 0001)

Per `docs/adr/0001-clio-single-master-storage.md` (ADR = Architecture Decision Record),
the Clio-centric model was **reversed**:

- **Barsh Matters local DB is the operational source of truth** (matter/claim/lawsuit
  identity, grouping, workflow, permissions, document visibility). Clio is NOT.
- **Barsh Matters generates the file numbers** — both individual `BRL_YYYYNNNNN` numbers
  and lawsuit `YYYY.MM.NNNNNN` numbers (e.g. lawsuit numbers via `buildMasterId()` in
  `app/api/lawsuits/local-generation-create/route.ts`). Clio does NOT create matters or
  mint numbers anymore.
- Legacy Clio-operational routes are **disabled**: `lib/legacyClioOperationalRouteBlocked.ts`
  returns HTTP 410 with "Barsh Matters local schema is now the operational source of
  truth." Guarded by `verify-clio-rule1-boundary-safety` and
  `verify-legacy-clio-settlement-routes-disabled-safety`.

**Clio's remaining (allowed) role is the document vault — and this MUST be preserved:**
uploading finalized docs, **listing** them, and **opening/calling** stored docs from the
BM UI (`/api/documents/clio-document-open`, `clio-matter-documents`, the document vault
APIs). Do not let "Clio is not source of truth" work break BM's ability to call/open
stored documents. Also note: the repo is still *named* `clio-lawsuit-aggregator` — that's
legacy naming, not current architecture.

### View Documents vs finalize (read-only vs get-or-create)

- **View Documents** (listing) must be **read-only**: resolve the existing folder by
  name with `findExactClioChildFolderByNameWithGuard` + `buildClioStorageTargetPlan`,
  then `listClioFolderDocuments`. It must never create folders and must fail closed.
  Route: `app/api/documents/clio-matter-documents/route.ts`. The direct path sends
  `uploadTargetMode=direct-matter&singleMasterDirectStorage=1&useSingleMasterClioStorage=1&directMatterDisplayNumber=BRL_...`
  and NOT `matterId`/`clioMatterId`.
- **Finalize/upload** is the only place that may get-or-create folders
  (`resolveClioMatterFolderWithGuard`). Route: `app/api/documents/finalize/route.ts`.
  The finalize response returns `uploaded[].clioDocumentId` (and a duplicate-skip path
  with `skipped[].existingClioDocuments[].id`) — it does NOT return an http URL.

## Document generation + delivery flow

UI lives in `app/matter/[id]/page.tsx` (very large file). Wizard stages:
`select → signer → generate → delivery` (`matterDocumentWorkflowStage`).

Delivery actions (all derive the finalized doc via `firstFinalizedClioDocument`, which
reads `uploaded[].clioDocumentId` / duplicate `existingClioDocuments[].id`):

- **Send to Print Queue** → `POST /api/documents/print-queue` with
  `{ masterLawsuitId, confirmAdd: true, directMatterCandidates: [{ clioDocumentId,
  masterMatterId, masterDisplayNumber, filename, label, key }] }`. The route verifies
  the doc in Clio (falls back to `verifyClioDocumentById`) then creates a
  `documentPrintQueueItem`.
- **Print Finalized Document** → loads the PDF in a hidden same-origin iframe and calls
  `contentWindow.print()` to raise the system print dialog (fallback: open in a tab).
- **Save Locally** → `<a download>` of the clio-document-open URL.
- **Email Finalized Document** → opens a recipient popup (`renderMatterEmailDeliveryPopup`):
  To field, prefilled only if a settled-with contact is saved; live-as-you-type search
  (debounced) across settled-with contacts + adversary attorneys; then
  `POST /api/graph/create-draft?confirm=create-graph-draft` with the PDF attached and
  subject `"{Provider} a/a/o {Patient} v. {Insurer}-- {DocLabel}-- {FileNumber}"`.
  Opens the returned `draft.webLink` (Outlook).

## Microsoft Graph email drafts

- `lib/graph/*` (client, token, draft, emailPersistence). `app/api/graph/create-draft/route.ts`
  creates an Outlook draft and attaches the finalized PDF (downloaded from Clio by
  `clioDocumentId`).
- Requires Graph env (`assertGraphDraftEnvironmentReady`).
- `buildGraphDraftPayloadPreview().validation.readyForGraphDraftCreate` requires a To
  recipient, EXCEPT for finalized-PDF-delivery sources, which bypass it. Sources:
  `settlement_finalized_pdf_delivery` and `direct_matter_finalized_pdf_delivery`
  (combined flag `finalizedPdfDelivery`).

## Reference data (multiple tables)

- `SettlementContact` table → `/api/settlements/contacts?q=` (name/email/company/role).
- Reference entity contacts → `/api/reference-data/contact-search?q=&type=` where type
  normalizes to `individual`, `insurer_company`, `adversary_attorney`
  (see `/api/reference-data/options/route.ts` for the alias map).
- Seed scripts: `seed-settled-with-reference-contacts`, `seed-adversary-attorneys-reference`,
  `seed-transaction-reference-options`.

## Provider/client name case

- Stored names are often ALL CAPS. Normalize for display with
  `lib/providerNameCase.ts` → `normalizeProviderName` (handles P.C., PLLC, M.D., MRI,
  d/b/a, small words, initials). Applied to the matter provider card and the email
  subject. Do NOT normalize the value used in `/matters?provider=` href filters.
- Stored-data normalization: `npm run normalize:provider-client-display-names`
  (writes the reference DB, preserves originals as aliases). Keep its rules in sync
  with `lib/providerNameCase.ts`.

## UI conventions

- Standard Barsh Matters button = blue `#1e3a8a` background, white text, weight 950.
  Close/Cancel/Back are neutral (gray/white) or red (destructive). Fix off-spec buttons
  (green/outlined) to the blue standard.
- The app opts out of browser translation in `app/layout.tsx`
  (`translate="no"` + `notranslate` + `<meta name="google" content="notranslate">`).
  Reason: Google Translate wraps text nodes in `<font>` and breaks React text updates
  (symptom: frozen/stale UI values like a "Documents: 0" counter). Do not remove.

## Permissions / RBAC (built, enforcement OFF by default)

Authoritative spec: `docs/permission-model.md`. Activation plan + decisions:
`docs/permission-enforcement-plan.md`. This subsystem is fully built and committed but
**not activated** — it changes no behavior until the env flag is flipped.

- **Model — 5 tiers, 5 roles (cumulative ladder).** Tiers: `view < edit < process <
  admin < security`. Roles → allowed tiers: `owner` = all; `administrator` =
  view/edit/process/admin (NOT security); `full_user` = view/edit/process; `partial_user`
  = view/edit; `view_only` = view. `security` (manage users/roles/permissions) is
  **Owner-only, never grantable**. `admin` functions are grantable to an Administrator
  **per-card** (per screen). Source of truth: `lib/admin-permissions/catalog.ts` (base
  perms + 10 `admin.card.*`) and `lib/admin-permissions/roleMatrix.ts`. The old
  `lib/adminPermissions.ts` env-override model is superseded but still present.
- **Enforcement = one pure resolver + one central chokepoint.**
  `lib/admin-permissions/resolveAccess.ts` decides: owner-bypass → never-block
  (`/admin/permissions`) → default-allow-unmapped → most-restrictive-tier → security
  owner-only / admin per-grant / view-edit-process role check. It is edge-safe (NOT
  `server-only`) so the Next middleware `proxy.ts` can import it. `proxy.ts` is the single
  enforcement point for BOTH admin and operational surfaces.
- **Kill-switch:** `BARSH_ROLE_ENFORCEMENT_ENABLED` (`1`/`true` = on; default **OFF**).
  Flag OFF → operational surfaces are pure pass-through and admin surfaces keep the prior
  owner-only behavior (zero behavior change). Flag ON → resolver gates by tier. Owner
  always bypasses; `/admin/permissions` is never blocked (lockout safety).
- **Per-card admin grants.** UI + storage already existed: `app/admin/users` checkboxes →
  `/api/admin/users/card-grants` → `AdminUserPermissionOverride` (action `grant`). Login
  reads the granted keys into the signed identity cookie (`lib/adminAuth.ts`); `proxy`
  consumes them (fallback for a pre-deploy cookie: all-admin-if-administrator). Card→route
  map: `src/lib/admin-users/admin-users-final-role-model-phase-v1.ts`. Each catalog
  `admin.card.*` perm scopes a card to its screen + that card's own `/api/admin/*`
  endpoints; shared operational endpoints a screen also calls are intentionally NOT scoped
  to the card (the Administrator already reaches them via operational tiers).
- **Guards:** `verify-permission-model-rework`, `verify-resolve-access-safety`,
  `verify-admin-per-card-grants-enforcement`, plus reconciled
  `verify-admin-users-phase14a-admin-function-block-safety` and
  `verify-admin-users-workflow-phase-r-owner-role-proxy-allow`.
- **To resume / ACTIVATE:** (1) set `BARSH_ROLE_ENFORCEMENT_ENABLED=1` in a **preview** env
  only; (2) log in as each role and confirm the decision table (view_only read-only;
  partial edits; full processes; administrator admin only where granted; security
  owner-only; `/admin/permissions` never locks out); (3) enable in prod with one-line
  rollback (unset the flag).
- **Remaining (not started):** Client Access (off-ladder, per-provider read-only
  reporting) is a separate later phase. Deferred copy trims on `admin/users` +
  `admin/permissions` (task #37) come AFTER activation. Optional: finer-than-per-card API
  action granularity, only if needed.

## SMS Two-Factor Auth (Twilio Verify) (built, flag OFF)

Admin login can require an SMS one-time code. Built and guarded but **not activated** until the
env flag is set. Superseded the earlier "Phase 21" hash-based OTP for the login path.

- **Provider = Twilio Verify** (not raw Programmable Messaging). Verify owns code
  generation/delivery/expiry and is exempt from A2P 10DLC registration for OTP use. Core client:
  `src/lib/auth/twilio-verify-2fa.ts` (fetch + Basic auth, no SDK). The old
  `admin-user-two-factor-runtime-phase21.ts` hash logic is retained ONLY for the admin/users phone
  setup-verification panel; the login path no longer uses it.
- **Login is two-step.** `/api/auth/login` validates username+password; if 2FA is enabled AND
  required for the user it does NOT create a session — it calls `startVerification` (sends the SMS)
  and sets a short-lived HMAC-signed `barsh_2fa_pending` cookie (10 min; proves the password step
  passed). `/api/auth/2fa/verify` reads that cookie, checks the code via Twilio `VerificationCheck`
  (or the Owner break-glass code), then sets the real gate + identity cookies (roleKeys + grants).
  Module: `src/lib/auth/two-factor-pending.ts`.
- **Who:** every active admin user; Owner can exempt a specific user via `twoFactorDisabled`. A cell
  phone is **mandatory at user creation** — `/api/admin/users/create` validates + stores E.164.
- **Recovery:** (1) Owner env break-glass `BARSH_2FA_OWNER_BREAKGLASS_CODE` — env-only, owner-only,
  constant-time compare, only reachable after password success, audited as
  `auth-2fa-owner-break-glass-used`; (2) Owner/Admin can re-point a user's phone / toggle
  `twoFactorDisabled` on `admin/users`. The legacy blank-username admin-password path is unchanged.
- **Kill-switch:** `BARSH_2FA_ENABLED` (default OFF → login behaves exactly as before).
- **Env vars:** `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID` (`VA…`),
  `BARSH_2FA_ENABLED`, `BARSH_2FA_OWNER_BREAKGLASS_CODE`.
- **Guard:** `verify-sms-2fa-twilio-verify-safety`. Pure helpers (E.164, break-glass, pending token)
  are unit-tested.
- **To activate:** create a Twilio Verify Service (Verify → Services → Create → `VA…` SID), set the
  five env vars in a preview env, log in as a user with a phone → confirm the SMS step, test Owner
  break-glass, then enable in prod (unset the flag = rollback).

## Brand color — one system navy

The Barsh Matters "system blue" is a single navy: `#00346e` (= `BRAND_NAVY` in
`lib/brand.ts`), matching the BRL + BM logos. It is the ONLY primary blue — buttons,
banners, headers, `colors.blue`, headings, AND all black/near-black body text all resolve
to it. Secondary / muted text is a single **muted** system blue `#385a83`
(= `BRAND_NAVY_MUTED`, a softened `BRAND_NAVY`). Mid grays used for borders/lines
(`#cbd5e1` etc.) are NOT text and stay as-is.

To change it everywhere in ONE command — code AND the raster logo PNGs — run:

    python3 scripts/set-system-blue.py "#RRGGBB"

It reads the current `BRAND_NAVY`, replaces that hex + its `rgb()` form across
app/lib/src/scripts, updates `BRAND_NAVY`, recomputes + replaces `BRAND_NAVY_MUTED`
(so muted text moves with the navy), and re-tints the `public/` logo PNGs (navy → new,
keeping the gold accents, white lettering, and transparency). Do NOT hand-edit navy hexes
piecemeal — that's how it drifted before (a named `colors.blue` and `rgb()` shadow forms
slipped past a hex-only find/replace). Exception: the
`admin/permissions` tier-badge legend (view=blue, edit=green, process=amber,
admin=purple, security=red) is a deliberate color code, not the system blue, and is
intentionally excluded.

## Gotchas / workflow

- **Do not run `npm run build`** unless necessary. Use `npx tsc --noEmit` for type
  checks and the targeted `scripts/verify-*.mjs/.cjs` verifiers.
- **Do not `node --check` a `.ts` file** (Node errors on the extension). Use tsc / tsx.
- Commits and DB-writing scripts must be run from the user's machine (the sandbox can't
  write to `.git` — a stale `.git/index.lock` recurs — and can't reach Neon). Hand the
  user a copy/paste block: `cd ~/clio-lawsuit-aggregator`, remove the lock, add, commit.
  Quote `'app/matter/[id]/page.tsx'` (zsh globs the `[id]`).
- Work historically proceeded in tightly-scoped numbered "phases" with docs in `docs/`.
- Locked: document header/letterhead formatting. Don't reintroduce legacy per-direct-matter
  Clio matter lookups into the read-only View Documents path.

## Working across two machines — never lose uncommitted work on pull

This repo is developed on more than one machine (e.g. a home Mac-mini and a work machine),
so the *other* machine frequently has local uncommitted work. Commits made on one machine
get pulled forward on the other. Before pulling on ANY machine:

1. `git status` FIRST. If the tree is clean, `git pull --ff-only origin main`.
2. If the tree is dirty, do NOT pull over it. Preserve the local work first:
   `git stash push -u -m wip` (the `-u` also stashes new/untracked files), then
   `git pull --ff-only origin main`, then `git stash pop` and resolve any conflicts.
   Alternatively commit the WIP to a branch (`git switch -c wip-YYYYMMDD && git add -A &&
   git commit -m wip`) before pulling main.
3. NEVER run `git reset --hard`, `git checkout -- .`, `git clean`, or a force-pull against
   uncommitted work — that silently destroys local changes. When in doubt, stash and stop.
4. If `git pull` reports divergence (can't fast-forward), surface it to the user and ask
   before rebasing/merging; don't auto-resolve.

## Template token data model (domain)

There are two matter levels:

- **Individual claim/matter** — BM-generated file number `BRL_YYYYNNNNN`. Holds the claim
  data (provider, patient, insurer, claim number, dates, amounts).
- **Lawsuit matter** — created by **aggregating one or more individual claims**; on
  aggregation it gets a file number `YYYY.MM.NNNNNN` (the master lawsuit id). Holds the
  litigation data the user enters during lawsuit generation (index number, court,
  adversary, lawsuit amount, costs, balance, date filed).

Generation tokens resolve from whichever level holds the data, plus reference tables,
the signer profile, and (future) the settlement dialog. Token → source mapping:

**Signer** (from the selected `AdminUser` signer profile; firm option = Barsh Rizzo & Lopez):
`signer.email/fax/extension/displayName/signatureName/title`.

**Letter date** (generation-stamped, matter-independent): `letter.date` resolves in the
resolver to the current date in **US Eastern** (`America/New_York`), rendered as
`Month D, YYYY` (e.g. June 29, 2026). Use this token instead of a Word `DATE` field: a
live Word `DATE` field reads the OS clock of whoever opens the doc and drifts to UTC
(showing tomorrow's date late at night ET), whereas `letter.date` is fixed as plain text
when the letter is generated. Catalogued under the General category.

**Matter + Claim** (from the **individual** BRL_ matter — claims index, with UI-edited
fields as fallback):
- `matter.fileNumber` = the BRL_ display number
- `matter.providerName` (case-normalized), `matter.patientName`
- `matter.billedAmount` = the individual matter's **Claim Amount** (`claimAmount`)
- `claim.number`, `claim.dateOfLoss`, `claim.denialReason`
- `claim.dateOfService` = a single date OR a `dosStart – dosEnd` range when both exist
- `claim.payments` = total **voluntary payments** for the individual claim (UI "Payments")
- `claim.balance` = Claim Amount − payments (UI "Balance")

**Provider**: `provider.taxId` from the **provider reference table** (`ReferenceEntity`
type provider, `details.taxId`) — **not yet populated** in data, so expect blank.

**Insurer**: `insurer.name` from the individual matter; `insurer.street/city/state/zipcode/
fullAddressBlock` from the **insurer reference table** (`ReferenceEntity` type insurer,
`details.addressLine1/city/state/zip`), matched by insurer name. Address is per-insurer
(some insurers may share an address).

**Lawsuit / Court / Adversary / Costs** (from the **lawsuit** `YYYY.MM.NNNNNN` record,
user-entered during lawsuit generation; addresses from reference tables by name):
- `lawsuit.amount` = UI "Lawsuit Amount"
- `cost.indexFee`, `cost.serviceFee`, `cost.otherCourtCosts`; `cost.total` / `lawsuit.costs`
  = sum of those three (UI "Costs")
- `lawsuit.balance` = Lawsuit Amount + Costs − payments posted on the lawsuit file (post-filing)
- `lawsuit.indexNumber`, `lawsuit.dateFiled`, `lawsuit.adversaryAttorney`
- `adversaryAttorney.street/city/state/zipcode`, `adversary.fullAddressBlock` (adversary
  reference table by name)
- `court.name/longName1/longName2/street/city/state/zipcode` (court reference table)

**Settlement** (principal, interest, costs, attorney fees) come from the **settlement
dialog** the user enters. No canonical `settlement.*` tokens exist yet — future category.

Reference entity addresses live in `ReferenceEntity.details` JSON (structured keys:
`addressLine1/addressLine2/city/state/zip/phone/fax/email/taxId/...`). The
`/api/reference-data/contact-search` API only surfaces a single `address` string; the
token resolver should read `details` directly for structured components.

### Fill engine (generate-preview)

`app/api/documents/templates/generate-preview/route.ts` (GET) is the docx token-fill
engine (JSZip, replaces tokens across Word `<w:t>` run boundaries, per-paragraph). Token
syntax `{{namespace.field|modifier|...}}`; modifiers: `upper/lower/title`,
`date:MM/DD/YYYY`, `date:Month D, YYYY`, `currency` (text-formatting modifiers
bold/italic/underline are catalogued but require run-property edits — not yet applied).
Generation must NOT silently blank unresolved tokens — report them.

Run-boundary rule (fixed): when a token begins exactly at a run boundary, the engine binds
the token start to the run that holds its first character (exclusive upper bound, skipping
zero-length runs such as a run carrying only a `<w:tab/>`). An earlier inclusive bound
absorbed the value into the *preceding* run — so a value after a bold label + tab inherited
the label's bold and landed *before* the tab, collapsing tabbed label/value alignment. Note
that clean column alignment still needs real tab stops or a borderless table in the
template; a bare tab with no defined tab stops only jumps to Word's default half-inch grid.
