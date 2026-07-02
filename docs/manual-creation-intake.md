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
  case type.** (Patient = a lookup/registry so the same injured person can be reused across matters —
  confirm.)
- **Dedup:** use the **same fingerprint keys as Dow** (claim # + patient + DOS + gross charges) —
  flag a likely-duplicate match for operator review; never auto-skip/auto-merge.
- **Numbering:** manual matters mint the next `BRL_{YYYY}{seq}` number, same as imports (confirm).
- **Documents = a NEW scanning/categorization module:**
  - **Workflow:** operator uploads the scanned files, then **drags each document into a category
    folder in BM** (BM-side categorization UI).
  - **Category = BM metadata**, not a Clio folder. In the **Clio repository, documents are stored
    FLAT under the matter's folder** (`…/BRL_YYYYNNNNN/` for individual, or the lawsuit-number folder)
    — **NO category subfolders** beneath the matter-number folder.
  - **PINNED — folder structure to be redesigned.** The 17 folders below are a provisional FLAT
    list; user wants a **more complex (nested) folder structure**. Revisit before building the
    categorization module. (Clio stays flat under the matter folder regardless; the complexity is the
    BM-side organization.)
  - **Document-folder taxonomy (17, provisional) — BM-wide, category = metadata (flat in Clio):**
    - _Intake-scan targets_ (scanning step drops here): 1) Bill (CMS-1500) · 2) Medical Records ·
      3) Denial / EOB / EOR · 4) Assignment of Benefits · 5) Verification Requests ·
      6) Verification Responses
    - _General matter folders_: 7) Proofs of Mailing · 8) Stipulations · 9) Payments ·
      10) Affidavits of Service · 11) Our Pleadings · 12) Our Motions · 13) Their Motions ·
      14) Their Pleadings · 15) Discovery · 16) Liens · 17) Misc.
    - Applies to ALL matters (any intake path), not just manual. Confirm ordering/naming.

## Open questions
- Exact **field subset** for the manual form, and which fields are **required** to create a matter.
- **Document categories** (the taxonomy for the scanning module) and the scan/upload workflow.
- Whether "patient" is a true master registry (reused across matters) or just per-matter with autocomplete.
