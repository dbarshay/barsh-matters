# Document Folder Structure (BM-wide) — spec, in progress

Supersedes the provisional flat 17-folder list in `manual-creation-intake.md`.
Accessed via the existing **Documents** action button → **View Documents** → the master-folder tree.
Applies to every matter (all intake paths), not just manual creation.

Clio note: Clio storage stays **flat** under the matter folder (no subfolders in Clio); this nested
tree is the **BM-side** organization (folder = BM metadata on each document). (Confirm still true.)

## Folder tree (as described — some names/branches TBD)

```
View Documents
├── Arbitration
│   ├── Correspondence / AR1
│   └── Awards
├── Claim Documents
│   ├── Bills
│   ├── Reports
│   ├── Denials
│   ├── Verification
│   │   ├── Requests
│   │   └── Responses
│   ├── Payments
│   └── Miscellaneous
├── Litigation
│   ├── Pleadings / Receipts
│   ├── Discovery
│   ├── Motions
│   ├── Stipulations
│   ├── Judgments
│   ├── Court Correspondence
│   └── Other Filings
└── Workers' Comp                     (documents only — NO subfolders)
```

## Drag-and-drop + controlled-title behavior
- Users drag/drop a document into a **terminal (leaf) folder**.
- On drop, a **picklist appears** asking "which document is this?" — showing **only that folder's
  allowed titles** (a controlled, per-folder list).
- The document then **displays in the UI under the picked title** — the display label is **decoupled
  from the actual saved filename** (BM shows the friendly title regardless of how the file is stored).
- The stored file is a **Clio-supported document type**, so the document stays **callable and savable**
  from Clio (Clio = the file store; BM owns the title/label + folder placement as metadata).
- ⇒ Need, per terminal folder: **the allowed title list**.

### Terminal folders (each needs an allowed-title list) — 17
Arbitration: **Correspondence / AR1**, **Awards** ·
Claim Documents: **Bills**, **Reports**, **Denials**, **Payments**, **Miscellaneous**, and
Verification → **Requests**, **Responses** ·
Litigation: **Pleadings / Receipts**, **Discovery**, **Motions**, **Stipulations**, **Judgments**,
**Court Correspondence**, **Other Filings** ·
**Workers' Comp** (itself terminal — documents only).

## Template-generated (merge/save) documents auto-file to a designated folder
- Documents BM **merges/saves from a template** are **auto-tagged to a designated terminal folder** in
  this tree (they do NOT require a manual drag-drop / title pick).
- The **target folder is designated per-template, at template-creation time** → add a **"target
  folder"** setting to `DocumentTemplate` (and likely the resulting **title** too — either a fixed
  title or one of that folder's allowed titles).
- So every document on a matter — whether **manually uploaded** (drag→title picklist) or
  **template-generated** (auto-filed) — lands in a folder with a controlled title.

## Allowed titles per terminal folder (collected folder-by-folder)
Each folder: its controlled title picklist, and whether it also offers a **freehand "Other"** entry
(user types a custom title). Freehand is **off by default** — only where the user says so.

Title behavior: a title can be **static** (label = the title) or **prompt for structured fields** on
select (e.g. a date + a brief description) that compose the display label. Prompted fields are noted
per title below.

- Arbitration → Correspondence / AR1:
    - `AR1` (static title)
    - `Correspondence` → on select, prompt for **Date of correspondence** + **Brief description**;
      display label composed as e.g. `Correspondence — {date} — {description}` (confirm label format)
    - Freehand "Other": no
- Arbitration → Awards:
    - `Award` → on drop, prompt for **Date of award** (required) + **Outcome** picklist:
      `Win` | `Loss` | `Partial Win`. Label composed e.g. `Award — {outcome} — {date}`.
    - If Outcome = **Win** or **Partial Win** → additionally prompt for amounts awarded:
      **Principal**, **Interest**, **Attorney's Fees**, **Costs** (money). Loss → no amounts.
    - Outcome + amounts are structured data (arbitration win/loss + award-amount reporting).
    - Freehand "Other": no
- Claim Documents → Bills: titles = `Bill`, `AOB`, `Proof of Mailing`, `Liens`. (Freehand "Other":
  no. Per-title prompts, if any, TBD — none specified yet.) _Note: AOB, Proof of Mailing, and Liens
  from the old flat list live here as titles, not separate folders._
- Claim Documents → Reports: titles = `Prescription`, `Report`. (Freehand "Other": no. Prompts: none specified.)
- Claim Documents → Denials: titles = `NF-10`, `EOB/EOR`, `Peer Review/IME`. (Freehand "Other": no. Prompts: none specified.)
- Claim Documents → Verification → Requests: title = `Request Dated` → prompt for a **date**; label =
  `Request Dated {date}`. (Freehand "Other": no.)
- Claim Documents → Verification → Responses: title = `Response Dated` → prompt for a **date**; label =
  `Response Dated {date}`. (Freehand "Other": no.)
- Claim Documents → Payments: title = `Payment` → prompt to pick a category —
  **Principal / Interest** OR **Attorney's Fee / Filing** — and enter **an amount for both**
  components of the chosen category (Principal + Interest, or Attorney's Fee + Filing). Amounts are
  structured money data. (Freehand "Other": no.)
- Claim Documents → Miscellaneous: titles = `Police Report`, `Other` (**freehand** — user types a
  custom title). **Freehand "Other": YES.**
- Litigation → Pleadings / Receipts: titles = `Complaint`, `Answer`, `Affidavit of Service`,
  `DFS Receipts`, `Other Receipts`. (Freehand "Other": no. Prompts: none specified.)
- Litigation → Discovery: titles = `Plaintiff's Demands`, `Defendant's Demands`,
  `Plaintiff's Responses`, `Defendant's Responses`. (Freehand "Other": no. Prompts: none specified.)
- Litigation → Motions: titles = `Plaintiff's Motion`, `Defendant's Motion`,
  `Plaintiff's Opposition / Cross-Motion`, `Defendant's Opposition / Cross-Motion`,
  `Plaintiff's Reply`, `Defendant's Reply`, `Decisions / Orders`. (Freehand "Other": no. Prompts: none specified.)
- Litigation → Stipulations: titles = `Stipulation of Settlement`, `Stipulation of Discontinuance`,
  `Other` (**freehand**). **Freehand "Other": YES.**
- Litigation → Judgments: titles = `Judgment`, `Execution`, `Judgment Entered`,
  `Other Correspondence (Marshal/Sheriff)`. (Freehand "Other": no. Prompts: none specified — flag if
  `Judgment Entered` should capture date/amount later.)
- Litigation → Court Correspondence: on drop, prompt for **Date of correspondence** + **Description**;
  label composed e.g. `Court Correspondence — {date} — {description}`. (Freehand "Other": no.)
- Litigation → Other Filings: titles = `Notice of Entry`, `Notice of Trial`,
  `Demand for Trial de Novo`, `Other` (**freehand**). **Freehand "Other": YES.**
- Workers' Comp: titles = `HP-1`, `HPJ-1`, `C8.1`, `C8.4`, `Rejections`, `Other` (**freehand**
  description). **Freehand "Other": YES.**

## Open / TBD
1. ✅ **Allowed-title list per terminal folder — COMPLETE (all 17).** Freehand "Other" enabled on:
   Claim Documents→Miscellaneous, Litigation→Stipulations, Litigation→Other Filings, Workers' Comp.
   Document *type/format* = whatever Clio supports (not restricted per folder); only the **title** is
   controlled.
2. Confirm **label formats** for the prompt-composed titles (Correspondence, Court Correspondence,
   Awards, Requests/Responses, Payments) — exact display string.
3. Which folders are the **intake-scan targets** (bulk manual scanning) — likely Claim Documents
   subfolders + Workers' Comp; confirm, and whether bulk scan uses the same drop→title-picklist.
4. Behavior if a title is already used on the matter (allow duplicates? one per title?).
5. **Structured data capture** — Awards amounts (principal/interest/fees/costs), Payments
   (P/I or AF/Filing amounts), and outcomes: store as queryable fields (reporting), not just labels.
6. `DocumentTemplate` gets a **target-folder** setting (per template) for auto-filed merged docs.

_Resolved: Stips = Stipulations. Arbitration subfolder = "Correspondence / AR1" (AR1 = A-R-1).
Workers' Comp = documents only, no subfolders. Title is a display label decoupled from the saved
filename; underlying file is a Clio-supported type (callable/savable)._
