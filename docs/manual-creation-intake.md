# Manual Creation — Intake Path #3 (spec, in progress)

Purpose: define how the BPO team manually creates a matter and associates/categorizes its documents,
for the lower-volume intake where providers send physical files or upload to ShareFile. Built
interactively with the user; **his definitions are authoritative.** No spreadsheet parsing here.

Context: paths #1 (Carisk) and #2 (provider sheets, e.g. Dow) are bulk imports. Path #3 is a
hand-keyed single-matter creation + manual document handling.

## Decisions

- **Manual form fields (12), ALL required** except the claim-identifier alternation below:
  Claim Number · Policy Number · Patient · Provider/Client · Insurer/Carrier · Case Type ·
  Service Type · Denial Reason · Date of Injury · Date(s) of Service · Gross Claim Amount ·
  Treating Physician.
  - **Claim Number OR Policy Number** — at least one of the two is required (both allowed). All other
    fields are required.
- **Dedup fingerprint (manual):** (claim number **or** policy number) + patient + DOS + gross charges —
  same flag-for-review behavior as Dow.
- **Controlled input (registries + picklists):** use the registry tables we set up plus predictable
  picklists (some already exist) for: **patient, denial reason, provider, insurer, service type,
  case type.**
- **Registry/vocabulary governance — UNIVERSAL RULE for ALL table-driven data** (provider, insurer,
  denial reason, service type, case type, and any other reference/lookup table):
  - Operators **and imports** may only **select existing** values.
  - An **unmatched value is flagged for the Owner to add** (or held) — **never auto-created** by an
    operator or an import.
  - **Only the Owner can add / edit / delete** registry entries (audited).
  - Applies everywhere: manual intake AND Carisk/Dow imports. (Case Type stays No-Fault / WC.)
  - **Patient is the ONE exception** — new patients auto-create (see below).
- **Reference-entity matching (carriers, providers, etc.) uses ALIASES, not fuzzy matching.** BM
  already has `ReferenceEntity` + **`ReferenceAlias`** (alias + `normalizedAlias`, unique per entity;
  `/api/reference-data/aliases`). Carrier strings on imports are often non-exact, carry noise, or are
  client **nicknames**, and **canonical carrier names are dangerously similar** to each other.
  - **Matching:** **normalize** the incoming string (strip `[Electronic]`, `c/o <clearinghouse>`
    routing, `Single Payer ID`, punctuation/case) → **exact match on `normalizedAlias` (or canonical
    name)** → link to the canonical entity.
  - **NO fuzzy auto-match** — near-identical canonical names make fuzzy matching unsafe. An unmatched
    string is **flagged for the Owner** to either **map it to an existing entity (which adds a new
    alias)** or **add a new entity**. Each mapping **grows the alias table**, so future imports of that
    variant/nickname auto-resolve.
  - _(Live carrier table not readable from here — Neon. Confirm noise-stripping rules against real
    data when we build.)_
- **Patient = reusable MASTER record** (one per injured person, linked across all their matters).
  - **Identity resolution / fuzzy matching:** incoming names vary (typos, transpositions, middle
    initials, LAST/FIRST order). Fuzzy-match to existing patients so a variant does NOT create a
    duplicate person.
  - **Hard constraint:** similar names can be **different people** (co-claimants on one policy share a
    last name — e.g. `Aragon, Meyling` vs `Aragon, Paula`). **Never auto-merge on name alone.** Use a
    corroborating identifier (TBD) to distinguish "same person, typo" from "two similar-named people."
  - **Behavior (match spectrum):**
    - **No match → create a new patient master record** (normal — first time we import for that
      patient; no prompt, no friction). New patients are expected.
    - **Close / ambiguous match → SUGGEST the likely patient(s); operator links or creates new.
      Never auto-link on a fuzzy name.**
    - **Exact match → link** to that patient.
    - At bulk-import scale, brand-new patients auto-create; only close-match cases are flagged for
      operator review in the preview.
  - **Corroborating identifiers** used to rank/raise confidence in the suggestions: **policy/claim #**
    and **DOI** (a patient may have several across matters). DOB/address not used.
  - Merge/un-merge tool (admin/owner) to fix any duplicate discovered later, audited.
- **Dedup:** use the **same fingerprint keys as Dow** (claim # + patient + DOS + gross charges) —
  flag a likely-duplicate match for operator review; never auto-skip/auto-merge.
- **Numbering:** manual matters mint the next `BRL_{YYYY}{seq}` number, same as imports (confirm).
- **Documents = a NEW scanning/categorization module:**
  - **Workflow:** operator uploads the scanned files, then **drags each document into a category
    folder in BM** (BM-side categorization UI).
  - **Category = BM metadata**, not a Clio folder. In the **Clio repository, documents are stored
    FLAT under the matter's folder** (`…/BRL_YYYYNNNNN/` for individual, or the lawsuit-number folder)
    — **NO category subfolders** beneath the matter-number folder.
  - **SUPERSEDED → see `docs/document-folder-structure.md`** for the authoritative nested folder tree
    (4 masters, subfolders, all 17 terminal folders with title picklists, prompts, freehand flags).
    The flat list below is historical. (Clio stays flat under the matter folder; the tree is BM-side.)
  - **Document-folder taxonomy (17, provisional) — BM-wide, category = metadata (flat in Clio):**
    - _Intake-scan targets_ (scanning step drops here): 1) Bill (CMS-1500) · 2) Medical Records ·
      3) Denial / EOB / EOR · 4) Assignment of Benefits · 5) Verification Requests ·
      6) Verification Responses
    - _General matter folders_: 7) Proofs of Mailing · 8) Stipulations · 9) Payments ·
      10) Affidavits of Service · 11) Our Pleadings · 12) Our Motions · 13) Their Motions ·
      14) Their Pleadings · 15) Discovery · 16) Liens · 17) Misc.
    - Applies to ALL matters (any intake path), not just manual. Confirm ordering/naming.

## Status — Manual creation (#3)

**Resolved:**
- **Folder structure** → `docs/document-folder-structure.md` (authoritative; nested tree + title picklists).
- **Registries/picklists** → universal Owner-managed rule (above); alias-based reference-entity
  matching; **patient master** with fuzzy suggest-and-confirm (patient the sole auto-create exception).
- **Scan/upload module** → ingest both (separate files + split combined scan); accepts PDF / images
  (JPG/PNG/TIFF) / Office / .msg/.eml; drag-into-category; flat to Clio; **OCR pre-fills the
  matter-creation form** with the unified confidence UI (yellow/green + message, confirm required).
- **Field formats/validation** → same normalization rules as imports (dates→date-only, money→cents,
  patient `First Last` proper case, carrier→registry).
- **Case Type** → operator selects No-Fault / WC (editable toggle).
- **Numbering** → manual matters mint the next `BRL_{YYYY}{seq}`, same as imports.

**Remaining / deferred:**
- **Governance** — who may manually create matters → **deferred to the RBAC rollout** (for now any
  authenticated user).
- Merge/un-merge tool for patients/entities (admin/owner) — build detail.
