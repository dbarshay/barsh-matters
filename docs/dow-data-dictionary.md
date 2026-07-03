# Dow (Provider-Sheet) Import — Data Dictionary (authoritative, in progress)

Purpose: define, column by column, what each field in a **Dow-type provider sheet** actually is and
how Barsh Matters should handle it. Dow is intake path #2 (a provider bills the clearinghouse itself
and sends us a report). Built interactively with the user; **his definitions are authoritative.**

Ground rules (same as Carisk)
- Source column labels are **opaque** — even if identical to a Carisk column or one of our canonical
  fields, they are NOT assumed to mean the same thing until confirmed. (Do not carry Carisk
  decisions over automatically.)
- Observed stats are structure only (fill rate, distinct count, examples) — no meaning inferred.
- Sample file: `May 2026.xlsx`, sheet `Page1`, 1,840 data rows, 8 columns.
- Baseline: full row archived in `ClaimIndex.raw_json`. Case normalization case-by-case (store raw,
  normalize display). Any dedicated field is reportable regardless of UI/token.

Three-part system: **F (Field?)** = dedicated ClaimIndex column · **UI?** = shown on matter screen ·
**T (Token?)** = document token.

### Known differences from Carisk (to keep in mind, not to assume answers)
- **No unique bill key** — Dow has no `CIC #` equivalent. Matter identity / dedup for Dow is an OPEN
  question (a fuzzy composite falsely merges legitimately-distinct bills — see user's caution).
- **No Status column** — no accept/reject lifecycle; no Carisk-style routing or management report.
- **No documents** on this path (we request from the provider if/when needed).
- **Provider identity** isn't a column — the whole sheet is one provider (Dow). How the provider is
  supplied at import is an open question (filename vs. picker).

| # | Source column | Observed (filled / distinct; examples) | Meaning (authoritative) | F | UI | T | UI label | ClaimIndex field (x-ref) | Token | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `insuredsID` | 1838/1840, 496 distinct; `3271X209B`, `0484678660101054` | **Our claim number** — stored/displayed as written (same as Carisk) | ✅Y | ✅Y | ✅Y | Claim Number | `claim_number_raw` | `claim_number` (proposed) | No transformation. |
| 2 | `CarrierName` | 1838/1840, 18 distinct; `State Farm Auto [Electronic]` | **Insurer / carrier** (also adversary in litigation) | ✅Y | ✅Y | ✅Y | Insurer/Carrier | link to carrier registry (`ReferenceEntity`) + canonical name into `insurer_name` | `insurer` (proposed) | **RESOLVE to carrier registry.** Strip `[Electronic]`; exact match auto-links; unmatched is flagged for the **Owner to add** (operators/imports never create registry entities). Raw in raw_json. |
| 3 | `DOI` | 1838/1840, 359 distinct; `2024-07-24` | **Date of Injury / Incident** (date of loss) | ✅Y | ✅Y | ✅Y | Date of Injury | `date_of_loss` (existing) | `date_of_loss` (proposed) | Arrives as datetime `…00:00:00` → store/display as date only. |
| 4 | `PatientsName` | 1838/1840, 537 distinct; `Aarons, Malachi` | **Patient** (injured party) | ✅Y | ✅Y | ✅Y | Patient Name | `patient_name` (one field) | `patient_name` (proposed) | Incoming `LAST, FIRST` → reorder + proper-case → STORE & DISPLAY as `First Last`. Original in raw_json. |
| 5 | `DateOfService` | 1838/1840, 1342 distinct; multi-date lists `05/05/2026; 05/05/2026; …` | **Date(s) of service** (same model as Carisk) | ✅Y | ✅Y | ✅Y | Date(s) of Service | `dos_start` (earliest) + `dos_end` (latest) | `dos_start`, `dos_end` (proposed) | Parse semicolon list; collapse repeats; single day → dos_start=dos_end; span → display `start – end`. |
| 6 | `PhysicianName` | 1838/1840, 15 distinct; `Douglas Van Eck` | **Treating / rendering physician** (provider/client "Dow" supplied separately at import) | ✅Y | ✅Y | ✅Y | Treating Physician | `treating_provider` (existing) | `treating_physician` (proposed) | Display proper-case; store as written. |
| 7 | `totalCharges` | 1838/1840, 767 distinct; `302.42`, `151.21` | **Gross claim amount** | ✅Y | ✅Y | ✅Y | Gross Claim Amount | `claim_amount` (existing) | `claim_amount` (proposed) | Parse as money. **At import, `balance_presuit` (opening balance) = this gross claim amount; payments reduce it** (same as Carisk). |
| 8 | `BillType` | 1838/1840, 3 distinct; `Chiro`, `PT`, `EMG` | **Service / treatment type** (chiropractic, physical therapy, EMG) | ✅Y | ✅Y | ✅Y | Service Type | `service_type` (existing) | `service_type` (proposed) | Keep values as-is. Surfacing all-three assumed pending confirm. |
| — | _(derived, no source column)_ | — | **Case Type = No-Fault** for ALL Dow matters | ✅Y | ✅Y | ✅Y | Case Type | `case_type` | `case_type` | Dow is No-Fault only; set as a constant on every Dow-imported matter (no source column). |

---

## Summary — what an imported Dow row (one matter) produces

**Mapped fields:** Claim Number ← `insuredsID` (as written, all three) · Insurer/Carrier ←
`CarrierName` (resolve to registry, all three) · Date of Injury ← `DOI` (`date_of_loss`, all three) ·
Patient Name ← `PatientsName` (`First Last`, all three) · Date(s) of Service ← `DateOfService`
(`dos_start`/`dos_end` span, all three) · Treating Physician ← `PhysicianName` (all three) · Gross
Claim Amount ← `totalCharges` (`claim_amount`, all three) · Service Type ← `BillType`
(`service_type`, all three).

**Derived/constant:** Case Type = **No-Fault** on every Dow matter · Provider/Client = the canonical
provider the operator **selects once at import** (applies to all rows). For this sheet that is
**"Suffolk Physical Therapy & Chiropractic, PLLC"** — "Dow" is internal shorthand, NOT a canonical name.

**No Carisk-style machinery here:** no unique bill key, no Status routing, no management report, no
documents.

---

## Dow identity / dedup — RESOLVED

- **Sheets are disjoint** — each Dow sheet contains only that period's new bills (prior bills are not
  re-listed). A duplicate therefore only arises if the **same file is imported twice**.
- **No natural unique key** (unlike Carisk's `CIC #`). Identity = a derived **bill fingerprint** =
  normalized( claim number `insuredsID` + patient name + DOS span + gross charges ). Proven **100%
  unique across the 1,838-row sample** — co-claimants on one policy (same claim #, DOI, doctor,
  charges) are correctly separated by patient name.
- **Store the fingerprint** on each Dow matter (indexed) for fast cross-import matching. It is a
  **soft key — NO hard DB uniqueness constraint** (two legitimately distinct bills could share it;
  never block them). Contrast Carisk `CIC #`, which IS hard-unique.
- On import, a row whose fingerprint **matches an existing matter is flagged as a likely duplicate in
  the preview for operator review** (skip or import-anyway). **Never auto-skip, never auto-merge.**
- Fingerprint normalization (define precisely at build): claim # trimmed as written; patient name
  normalized (case/whitespace); DOS reduced to the start–end span; charges to cents.

## Open (Dow-specific)
1. _(identity/dedup — resolved above)_
2. ~~Provider identity at import~~ **RESOLVED: operator selects the canonical provider once at import; it applies to every row. "Dow" = "Suffolk Physical Therapy & Chiropractic, PLLC" (canonical). Provider must exist in / be added to the registry.**
3. **Per-provider layout variance** — do other providers' sheets use Dow's exact 8-column layout, or different columns/order? (Design so a per-provider column mapping can be added; default to Dow's layout.) — still open.
