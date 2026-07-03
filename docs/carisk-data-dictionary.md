# Carisk Import — Data Dictionary (authoritative, in progress)

Purpose: define, column by column, what each field in a **Carisk** export actually is and how Barsh
Matters should handle it. This is the foundation for the matter-import module (identity, dedup,
field mapping). Built interactively with the user; **his definitions are authoritative.**

Ground rules
- A source column's label is treated as **opaque** — even if it matches one of our canonical
  UI / ClaimIndex field names, it is NOT assumed to be the same thing until the user confirms.
  (Example already found: our claim number comes from `insuredsID`, NOT from the columns Carisk
  labels `ClaimNumber` or `CIC #`.)
- Observed stats below are structure only (fill rate, distinct count, examples) — **no meaning
  inferred** from them.
- Sample file: `searchResults (3).xlsx`, sheet `Page1`, 890 data rows, 41 columns.

Baseline (to confirm): every imported row is archived losslessly in `ClaimIndex.raw_json`
(a JSON blob on the matter's own ClaimIndex record, never shown in UI, always retrievable).

Case normalization: decided **case-by-case per column** (not global). When we choose to normalize,
we **store the original value as written** and normalize **only for UI display** (raw is never lost).

Reporting: **any dedicated ClaimIndex field is available to reports, exports, and search** — even
if it is not shown in the matter UI and not a document token. "Field only" = stored, queryable,
reportable/mergeable; just not on the matter screen and not a doc-merge token.

Per-column decisions use a **three-part system**:
- **F (Field?)** — store as a dedicated, typed ClaimIndex column (searchable, usable in logic, can power a token).
- **UI?** — display on the matter screen (implies stored).
- **T (Token?)** — expose as a callable document-generation token.

Columns: **Meaning** = the user's authoritative definition. **UI label** = what the screen shows.
**ClaimIndex field (x-ref)** = which ClaimIndex column it maps to. **Token** = document merge token
(names proposed; final token syntax TBD). ✅ = decided, ⬜ = not yet decided.

| # | Source column | Observed (filled / distinct; examples) | Meaning (authoritative) | F | UI | T | UI label | ClaimIndex field (x-ref) | Token | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `insuredsID` | 888/890, 473 distinct; `26000136`, `AU2025CAP1000`, `0619WC190001563` | **Our claim number** — the claim number, saved & displayed exactly as written (no transformation) | ✅Y | ✅Y | ✅Y | Claim Number | `claim_number_raw` | `claim_number` (proposed) | Source is `insuredsID`, NOT the `ClaimNumber`/`CIC #` columns. Normalized form may be derived internally for dedup only (parked). |
| 2 | `ClaimNumber` | 0/890 (empty in sample) | **Ignore** — empty; despite the label it is NOT our claim number (that's `insuredsID`) | ✅N | ✅N | ✅N | — | — | — | Ignored; lives only in raw_json archive |
| 3 | `CIC #` | 889/890, 889 distinct; `60412820`, `60312920` | **Bill-specific unique ID** — every bill/line has its own; must never repeat | ✅Y | ✅N | ✅Y | — (not shown) | `cic_number` (new; **UNIQUE**) | `cic_number` (proposed) | **CARISK IDENTITY / DEDUP KEY.** Enforce DB uniqueness — no two matters may share a CIC #. Import must reject/flag any row whose CIC # already exists (same bill, not new). Field/token name pending final naming. |
| 4 | `PatientsName` | 889/890, 487 distinct; `ABBAS, AMEER` | **Patient** (injured party) | ✅Y | ✅Y | ✅Y | Patient Name | `patient_name` (one field, existing) | `patient_name` (proposed) | ONE field. Incoming `LAST, FIRST` is **reordered + proper-cased → STORED and DISPLAYED as `First Last`** (e.g. `ABBAS, AMEER` → `Ameer Abbas`). Original preserved in `raw_json`. Parse rule: split on first comma; handle trailing spaces / no-comma / suffixes. Surfacing all-three assumed pending confirm. |
| 5 | `AccountNumber` | 887/890, 61 distinct; `0`, `CA-1467` | Provider's internal patient/account # | ✅N | ✅N | ✅N | — | — | — | **Ignore** — mostly `0`; lives only in raw_json archive |
| 6 | `DateOfService` | 889/890, 158 distinct; `06/01/2026`; also multi-date lists | **Date(s) of service.** Single (or repeated-same) = one service date; different dates = a span | ✅Y | ✅Y | ✅Y | Date(s) of Service | `dos_start` (earliest) + `dos_end` (latest) | `dos_start`, `dos_end` (proposed) | Parse semicolon list; **collapse repeats**; single day → dos_start=dos_end (display one date); span → display `start – end`. Each row = one BM matter. Surfacing all-three assumed pending confirm. |
| 7 | `DateCreated` | 889/890, 863 distinct; `2026-06-11 05:58:30` | **Date billing was ENTERED into Carisk** (not the submission date) | ✅N | ✅N | ✅N | — | — | — | **Ignore** — the business date we track is the submission date (`SubmittedDate`, col 38). raw_json only. Confirmed chronology: DateCreated ≤ SubmittedDate ≤ StatusDate. |
| 8 | `Status` | 889/890, 3 distinct; `Carrier Submission`, `Submitted`, `Saved Incomplete` | **Insurer-acceptance stage of the bill** (drives import routing — see below) | ✅Y | ⬜ | ⬜ | Status (TBD) | `status` (existing) | (TBD) | **Control field.** Carrier Submission→create matter; Submitted→ignore; Saved Incomplete→Carisk Management Report. UI/token disposition TBD. See "Status-driven import routing". |
| 9 | `StatusDate` | 889/890, 851 distinct; `2026-06-19 04:35:03` | Timestamp the current `Status` was set (accept/reject) — _provisional, confirm_ | ✅Y | ✅N | ✅Y | — (not shown) | `status_date` (new) | `status_date` (proposed) | Used as the rejection/last-status date on the Carisk Management Report (assumed, confirm). |
| 10 | `DocType` | 889/890, 1 distinct; `CMS1500` | **Ignore completely** | ✅N | ✅N | ✅N | — | — | — | Constant `CMS1500`; raw_json only |
| 11 | `ClaimType` | 889/890, 2 distinct; `NY WC`, `Auto` | **Line of coverage / case category** | ✅Y | ✅Y | ✅Y | Case Type | `case_type` (new; confirm vs existing `service_type`) | `case_type` (proposed) | **Value map (stored):** `NY WC` → `Workers Compensation`; `Auto` → `No-Fault`. Likely drives workflow/venue/forms downstream. New Carisk values must be flagged, not silently dropped. |
| 12 | `DOI` | 889/890, 399 distinct; `2026-01-24` | **Date of Injury / Incident** (date of loss) | ✅Y | ✅Y | ✅Y | Date of Injury | `date_of_loss` (existing) | `date_of_loss` (proposed) | Arrives as datetime `…00:00:00` → store/display as date only. |
| 13 | `FacilityName` | 889/890, 5 distinct; `COR ORTHO SPINE PC` | **Our client/provider** — authoritative provider identity, normalized to BM canonical client registry | ✅Y | ✅Y | ✅Y | Provider/Client | link to `ProviderClientInfo`/`ReferenceEntity` + canonical name into `client_name`/`provider_name` | `provider` (proposed) | **RESOLVE to registry, don't store raw.** Sheet value may be truncated/non-normalized; exact/confident match auto-links; an unmatched value is flagged for the **Owner to add** (operators/imports never create registry entities — universal table-driven-data rule). Raw kept in raw_json. Authoritative over BillingName. Facility ADDRESS (cols 14–18) remains "place of service". |
| 14 | `FacilityAddress` | 889/890, 13 distinct; `2033 DEER PARK AVENUE` | **Place of service** — address line 1 (provider may have several) | ✅Y | ✅N | ✅N | — (reportable) | `place_of_service_address` (new) | — | Field only, reportable. Per-bill place of service, NOT the provider registry address. |
| 15 | `FacilityAddress1` | 382/890, 2 distinct; `BLDG 1, STE 2`, `CL18` | **Place of service** — address line 2 (suite/bldg) | ✅Y | ✅N | ✅N | — (reportable) | `place_of_service_address2` (new) | — | Field only, reportable. ~43% filled. |
| 16 | `FacilityCity` | 889/890, 11 distinct; `DEER PARK` | **Place of service** — city | ✅Y | ✅N | ✅N | — (reportable) | `place_of_service_city` (new) | — | Field only, reportable. |
| 17 | `FacilityState` | 889/890, 2 distinct; `NY`, `NJ` | **Place of service** — state | ✅Y | ✅N | ✅N | — (reportable) | `place_of_service_state` (new) | — | Field only, reportable. |
| 18 | `FacilityZip` | 889/890, 15 distinct; `11729-3705` | **Place of service** — ZIP | ✅Y | ✅N | ✅N | — (reportable) | `place_of_service_zip` (new) | — | Field only, reportable. |
| 19 | `BillingName` | 889/890, 7 distinct; `COR ORTHO SPINE PC`, `ANDREW CORDIALE` | **Ignore** — provider/client comes from `FacilityName` (col 13) | ✅N | ✅N | ✅N | — | — | — | Superseded; raw_json only. |
| 20 | `BillingAddress` | 889/890, 4 distinct; `c/o Barshay, Rizzo & Lopez, PLLC` | **Ignore** — firm's own c/o remit address | ✅N | ✅N | ✅N | — | — | — | raw_json only |
| 21 | `BillingAddress1` | 889/890, 4 distinct; `445 Broadhollow Road, Suite CL18` | **Ignore** — firm's own c/o remit address | ✅N | ✅N | ✅N | — | — | — | raw_json only |
| 22 | `BillingCity` | 889/890, 2 distinct; `Melville` | **Ignore** — firm's own c/o remit address | ✅N | ✅N | ✅N | — | — | — | raw_json only |
| 23 | `BillingState` | 889/890, 1 distinct; `NY` | **Ignore** — firm's own c/o remit address | ✅N | ✅N | ✅N | — | — | — | raw_json only |
| 24 | `BillingZip` | 889/890, 4 distinct; `11747-3645` | **Ignore** — firm's own c/o remit address | ✅N | ✅N | ✅N | — | — | — | raw_json only |
| 25 | `Pay-to Address` | 0/890 (empty) | **Ignore** | ✅N | ✅N | ✅N | — | — | — | Empty; raw_json only |
| 26 | `Pay-to City` | 0/890 (empty) | **Ignore** | ✅N | ✅N | ✅N | — | — | — | Empty; raw_json only |
| 27 | `Pay-to State` | 0/890 (empty) | **Ignore** | ✅N | ✅N | ✅N | — | — | — | Empty; raw_json only |
| 28 | `Pay-to Zip` | 0/890 (empty) | **Ignore** | ✅N | ✅N | ✅N | — | — | — | Empty; raw_json only |
| 29 | `BillingNPI` | 889/890, 4 distinct; `1831834860` | **Ignore** (not used for provider matching) | ✅N | ✅N | ✅N | — | — | — | raw_json only |
| 30 | `PhysicianName` | 889/890, 4 distinct; `Andrew  Cordiale` | **Treating / rendering physician** | ✅Y | ✅Y | ✅Y | Treating Physician | `treating_provider` (existing) | `treating_physician` (proposed) | Already `First Last`; **display proper-case**, collapse double spaces; store as written. |
| 31 | `NPI` | 889/890, 4 distinct; `1851558746` | **Treating physician's NPI** | ✅Y | ✅N | ✅N | — (reportable) | `treating_physician_npi` (new) | — | Field only, reportable. |
| 32 | `PhysicianLicenses` | 889/890, 4 distinct; `NY-261604` | **Treating physician's state license #** | ✅Y | ✅N | ✅N | — (reportable) | `treating_physician_license` (new) | — | Field only, reportable. |
| 33 | `FacilityFedID` | 889/890, 4 distinct; `87-4679929` | **Provider's Tax ID / EIN** | ✅Y | ✅N | ✅N | — (reportable) | `provider_tin` (new; likely also on provider registry) | — | Field only, reportable. **Normalize to `XX-XXXXXXX`.** INTEGRITY RULE: a provider/client has exactly ONE TIN/EIN — a differing TIN for an already-known provider is a flag for review, never silently accepted. |
| 34 | `ServiceLines` | 889/890, 16 distinct; `1`, `2`, `8` | **Ignore** | ✅N | ✅N | ✅N | — | — | — | raw_json only |
| 35 | `CarrierName` | 889/890, 71 distinct; `New York Black Car Fund (NYBCF) [Electronic]` | **Insurer / carrier** (also the adversary in litigation) | ✅Y | ✅Y | ✅Y | Insurer/Carrier | link to carrier registry (`ReferenceEntity`) + canonical name into `insurer_name` | `insurer` (proposed) | **RESOLVE to carrier registry.** Strip `[Electronic]` suffix; exact/confident match auto-links; an unmatched value is flagged for the **Owner to add** (operators/imports never create registry entities — universal table-driven-data rule). Raw kept in raw_json. 71 raw strings → canonical. |
| 36 | `StatusNotes` | 889/890, 771 distinct; payer message + embedded IDs/links | **Payer status message** (acceptance/rejection text; may embed payment info, IDs, and an HTML remittance link) | ✅Y | ⬜ | ⬜ | Status Notes (TBD) | `status_notes` (new) | (TBD) | **Import processing: STRIP HTML — remove anything between `<` and `>` — and store the cleaned text.** Cleaned text is the source for the Saved Incomplete rejection reason on the Carisk Management Report. **DEFERRED (with doc-integration workstream):** parsing payment fields, remittance URL / ClaimGUID / Remit token, and WCB/iHCFA IDs. UI/token disposition TBD. |
| 37 | `totalCharges` | 889/890, 115 distinct; `127.41`, `87.8` | **Gross claim amount** | ✅Y | ✅Y | ✅Y | Gross Claim Amount | `claim_amount` (existing) | `claim_amount` (proposed) | Parse as money (`87.8`→`87.80`). **At import, `balance_presuit` (opening outstanding balance) = this gross claim amount; the existing payment flow reduces it as payments post.** (balance_presuit is the matter "Balance" and the default lawsuit "amount sought".) Surfacing all-three assumed pending confirm. |
| 38 | `SubmittedDate` | 888/890, 684 distinct; `2026-06-11 12:41:00` | **Date Carisk sent the billing to the insurer** = Date Bill Submitted | ✅Y | ✅Y | ✅Y | Date Bill Submitted | `date_bill_submitted` (new) | `date_bill_submitted` (proposed) | Store/display as date. Takes the "Date Bill Submitted" label (was tentatively on DateCreated). Confirmed: DateCreated ≤ SubmittedDate ≤ StatusDate (100%/99%). |
| 39 | `UserName` | 886/890, 3 distinct; `Patel , Kajol` | **Carisk operator who processed the bill** | ✅Y | ✅N | ✅N | — (reportable) | `carisk_operator` (new) | — | Field only, reportable. Format `LAST, FIRST` (normalize display if ever shown). |
| 40 | `filename` | 32/890, 9 distinct; `17700_P141_..._..X12` | **Internal Carisk number** | ✅N | ✅N | ✅N | — | — | — | **Ignore.** raw_json only. |
| 41 | `(blank header)` | 0/890 (empty) | **Ignore** | ✅N | ✅N | ✅N | — | — | — | Unnamed trailing empty column; raw_json only. |

---

## Summary — what an imported Carisk row (one matter) produces

**Mapped matter fields** (source → our field, surfacing):
- Claim Number ← `insuredsID` (as written) — UI + token
- CIC # ← `CIC #` — field + token; **UNIQUE dedup key**
- Patient Name ← `PatientsName` (→ `First Last`, proper case) — all three
- Date(s) of Service ← `DateOfService` (`dos_start`/`dos_end` span, repeats collapsed) — all three
- Status ← `Status` — control field (routing)
- Status Date ← `StatusDate` — field + token
- Case Type ← `ClaimType` (`NY WC`→Workers Compensation, `Auto`→No-Fault) — all three
- Date of Injury ← `DOI` (`date_of_loss`) — all three
- Provider/Client ← `FacilityName` (**resolved to provider registry**) — all three
- Place of Service (addr/city/state/zip) ← `FacilityAddress`…`FacilityZip` — field only (reportable)
- Treating Physician ← `PhysicianName` (proper case) — all three
- Treating physician NPI ← `NPI` — field only
- Treating physician license ← `PhysicianLicenses` — field only
- Provider TIN/EIN ← `FacilityFedID` (normalize `XX-XXXXXXX`; one-per-provider) — field only
- Insurer/Carrier ← `CarrierName` (strip `[Electronic]`, **resolved to carrier registry**) — all three
- Status Notes ← `StatusNotes` (**HTML stripped**) — field (deeper parse deferred)
- Gross Claim Amount ← `totalCharges` (`claim_amount`) — all three
- Date Bill Submitted ← `SubmittedDate` — all three
- Carisk operator ← `UserName` — field only

**Ignored** (kept only in `raw_json`): `ClaimNumber`, `AccountNumber`, `DateCreated`, `DocType`,
`BillingName`, `BillingAddress`+`Address1`+`City`+`State`+`Zip` (20–24), `Pay-to` block (25–28),
`BillingNPI`, `ServiceLines`, `filename`, and the blank col 41.

**Cross-cutting artifacts:** CIC # uniqueness constraint · Status-driven routing · Carisk Management
Report (Saved Incomplete tracker + weekly email) · provider & carrier registry resolution · matter
numbering (`BRL_{YYYY}{seq}`, batch-allocated).

---

## Status-driven import routing (Carisk) — CORE RULE

Each Carisk row routes by `Status` (identity key = `CIC #`, the bill-specific unique number):

- **`Carrier Submission`** — insurer accepted the bill as complete → **create a BM matter**
  (if a matter for that `CIC #` already exists → **REJECT the row with a prompt stating the reason**:
  duplicate CIC # already exists as matter X; no create, no update). If that `CIC #` is currently
  on the Carisk Management Report (was previously Saved Incomplete), **remove it from the report and
  create the matter.**
- **`Submitted`** — temporary "under review" state → **ignore entirely** (no matter, not on any
  report). It will reappear in a later import as Carrier Submission or Saved Incomplete.
- **`Saved Incomplete`** — insurer rejected as incomplete pending corrections → **no matter**;
  **add/keep on the Carisk Management Report** (running tracker, keyed by `CIC #`).

This deterministic routing **supersedes** the earlier "operator selects statuses per import" idea.
The triage preview still shows counts by outcome (will-create / ignored / to-report) for
transparency, but the routing itself is fixed by the rules above.

### New artifacts this creates (to design)
1. **Carisk Management Report tracker** — a persistent table of open `Saved Incomplete` bills,
   keyed by `CIC #`, holding enough to report (patient, provider, carrier, DOS, charges, status
   date, rejection detail, first-seen, last-seen). Rows are **removed** when the same `CIC #` later
   arrives as `Carrier Submission`.
2. **Weekly email** — generate the Carisk Management Report and email it to a **specific user
   (not yet created)** at the **end of each week** (scheduled task).

## Import batches — audit + reversibility (ALL spreadsheet imports: Carisk + Dow)
- **Every import creates a batch record** storing the **FULL per-row outcome**: batch ID, source file,
  who ran it, when, and each row's result — **created → matter ID · rejected + reason (e.g. duplicate
  CIC#) · sent to Carisk Management Report · ignored** — plus the created matter IDs.
- **UI:** display the **readable summary line by default** — e.g. `Batch #47, May-2026.xlsx, run by
  Kajol 6/14: 850 created · 14 ignored · 11 to report · 15 rejected` — **expandable to the full
  per-row record** on demand.
- **Guarded undo (Owner/Admin):** a batch can be undone, but it **only removes matters UNTOUCHED since
  import** — no documents filed, not aggregated into a lawsuit, not edited. Touched matters are left
  and reported. Fully audited.

## Open cross-column questions (parked, revisit after the dictionary)
1. ~~Claim identity / natural key for dedup~~ **RESOLVED (Carisk): `CIC #` is the bill-specific unique key. Enforce uniqueness; dedup/idempotency is keyed on CIC #. (Dow has no equivalent — still open for that source.)**
2. ~~Re-import lifecycle~~ **RESOLVED: routing by `Status` keyed on `CIC #`. A `Carrier Submission` for a `CIC #` that is ALREADY a matter is REJECTED with a prompt stating the reason (duplicate; already matter X) — no create, no update.**
3. ~~Row eligibility~~ **RESOLVED: only `Carrier Submission` creates matters; `Submitted` ignored; `Saved Incomplete` → Carisk Management Report.**
4. ~~Carrier canonicalization~~ **RESOLVED: resolve `CarrierName` to a carrier registry (strip `[Electronic]`; exact match auto-links, else operator picks/creates).**
5. Import batch auditability + reversibility.
6. Carisk document/image linkage (`filename` / X12) — separate workstream, needs Carisk coordination.

_User's standing caution: rows can be near-identical yet legitimately distinct bills. Never assume duplicates._
