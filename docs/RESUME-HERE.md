# RESUME HERE — Matter Import design (handoff)

_Phone-friendly session handoff. Everything is DESIGN — nothing is built yet._

## What we're doing
Designing the **matter-import module** for Barsh Matters (3 intake paths). Import is high-stakes, so
we're speccing fully before writing any code, in a column-by-column Q&A.

## Read these (authoritative design docs)
- `docs/carisk-data-dictionary.md` — **Carisk** path (clearinghouse export) — ✅ DONE (41 cols)
- `docs/dow-data-dictionary.md` — **Dow / provider sheet** path — ✅ DONE (8 cols)
- `docs/manual-creation-intake.md` — **Manual creation (#3)** — 🚧 IN PROGRESS (paused at folders)
- `docs/agent-orientation.md` — project rules + import summary (section "Matter Import module")

## Where we stopped
Manual path **#3**, at the **document-folder structure**. You said to pin it because you want a
**complex (nested) folder structure** to replace the provisional flat 17-folder list.

## Starting a fresh session (e.g., from your home machine)
1. Open a new Cowork session with the **`clio-lawsuit-aggregator` folder connected**.
2. Say: **"Read `docs/RESUME-HERE.md` and the three import design docs, then continue where we left
   off."** Claude will be fully up to speed from the docs — no re-discussion needed.
3. **Re-attach the two sample spreadsheets ONLY IF we need to inspect raw data** (e.g., more column
   work): `searchResults (3).xlsx` (Carisk) and `May 2026.xlsx` (Dow). These are **not in the repo on
   purpose** — they contain patient PHI. Keep your own copies; drag them into the chat when needed.
   (Not needed for the folder-structure design, which is the immediate next step.)

## To resume the immediate next step, tell Claude:
> "Continue the matter-import design. Resume manual-creation path #3 at the document-folder
> structure — I want to design the complex nested folder structure."

## Next up — manual path #3 remaining (from `manual-creation-intake.md` › Open questions)
1. **Complex document-folder structure** (the pinned item)
2. Registries/picklists mechanics (patient, denial reason, provider, insurer, service type, case type)
3. Patient master question (reusable across matters?)
4. Scan/upload module mechanics (upload → drag into category; Clio flat; category = BM metadata)
5. Field formats/validation on the manual form
6. Case Type selection at manual entry · numbering confirm · governance

## Parked cross-cutting items (all paths)
- Carisk lifecycle: `Carrier Submission` for a CIC # that's **already a matter** — skip vs. update?
- Import batch **reversibility** / audit
- **Governance / roles** — who can import
- `balance_presuit` vs gross claim amount relationship
- **Carisk document integration** (WC-only) — request doc drafted (workspace file
  `Carisk Document Integration Request.docx`) — ready to send to Carisk
- `BRL_` number width: sample `BRL_202600001` (5-digit) likely → 6 digits for >100k/yr — confirm

## Key locked decisions (quick reference)
- **One matter per spreadsheet row**; **preview + confirm** before anything is created.
- **Dedup:** Carisk = `CIC #` (bill-unique, **hard** DB constraint). Dow/manual = derived
  **fingerprint** = (claim# **or** policy#) + patient + DOS + gross charges — **soft** key, matches
  are **flagged for operator review**, never auto-skip/auto-merge. (Dow sheets are disjoint.)
- **Carisk Status routing:** `Carrier Submission` → create matter · `Submitted` → ignore ·
  `Saved Incomplete` → **Carisk Management Report** (running tracker + weekly email; drops off when it
  later arrives as Carrier Submission).
- **Provider & carrier** resolved to registries; operator picks/creates if no exact match. Dow
  provider = operator-selected canonical ("Suffolk Physical Therapy & Chiropractic, PLLC").
- **Case Type:** Carisk `NY WC`→Workers Comp, `Auto`→No-Fault; Dow = No-Fault constant.
- **Numbering:** `BRL_{YYYY}{seq}`, resets yearly, batch-allocated (scales to 100k+/yr).
- **raw_json** stores the full original row; UI shows only the mapped subset.
- **Clio = documents only**, stored FLAT under the matter folder (no category subfolders); document
  category lives as **BM metadata**.

## View from your phone
GitHub → `dbarshay/barsh-matters` → `docs/` → this file and the four above.
