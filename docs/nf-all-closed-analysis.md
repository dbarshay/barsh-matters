# NF All Closed — source spreadsheet analysis (first migration cutover)

File: `NF All Closed.xlsx` · one sheet (`CaseSearch_…`) · **33 columns × ~264,179 data rows**.
Every row = one legacy individual no-fault file (all closed, retained for records; documents to be
associated later). Analysis run on a 30,000-row sample unless noted.

## Structure / key findings

- **One row per file.** `Case_Id` is unique across the sample (0 repeats). Full file ≈ 264,179 matters.
- **`Case_Id` = legacy Individual number** `445YY-NNNNNN` (e.g. `44521-100016`). → `ClaimIndex.old_matter_number`.
- **`Packet ID` = legacy Lawsuit number** `445-PKTYY-NNNNNN` (e.g. `445-PKT21-114757`). Present on **~46%**
  of rows; **2,448 distinct packets** per 30k (→ **~20k lawsuits** full-file). Some packets aggregate
  **60–75 members**. 100% of populated Packet IDs matched `445-PKT…`. Empty Packet ID = standalone matter.
- **`Case Type` = `NF`** for all rows. **`Case Filling Status (YES/NO)`** ≈ 66% YES / 34% NO (suit/arb filed).
  Note: "filed" (66%) ≠ "packeted" (46%) — some filed files aren't in a packet.

## Column inventory (index → header → intended BM target)

| # | Header | BM target |
|---|---|---|
| 0 | `Case_Id` | Individual `old_matter_number` (445YY-) |
| 1 | `DenialReasons` | denial reason (normalize) |
| 2 | `Status` | close/status detail |
| 3 | `Provider` | provider (normalize → registry) |
| 4 | `Final Status` | matter final status (all CLOSED) |
| 5 | `D.O.S. Start` | date of service start |
| 6 | `D.O.S. End` | date of service end |
| 7 | `Collection Payment(Case Level)` | financial |
| 8 | `Voluntary Payment(Case Level)` | financial |
| 9 | `Claim Amount` | financial |
| 10 | `Case Type` | case type (NF → "No-Fault") |
| 11 | `Voluntary Payment Date` | date |
| 12 | `Defendant` | defendant / firm (normalize) |
| 13 | `Case Filling Status (YES/NO)` | filed flag |
| 14 | `Claim Number` | claim number |
| 15 | `Claimant` | patient (LAST,FIRST → parse + dedup) |
| 16 | `Date Bill Sent` | date |
| 17 | `Date Of Loss` | date of loss |
| 18 | `Insurance Company` | insurer (normalize → registry) |
| 19 | `Verification Status` | status |
| 20 | `Index OR AAA Number` | index/AAA number |
| 21 | `Date Opened` | date opened |
| 22 | `Policy No` | policy number |
| 23 | `Settled With` | settled-with |
| 24 | `Packet ID` | Lawsuit `oldLawsuitNumber` (445-PKT-) |
| 25 | `Provider Group` | provider group (normalize) |
| 26 | `Plaintiff Attorney` | attorney (normalize) |
| 27 | `Total Payment Received(Case Level)` | financial |
| 28 | `Suit Balance(Case Level)` | financial |
| 29 | `Court Name` | court/venue (normalize) |
| 30 | `Settlement Status` | settlement status |
| 31 | `Service Type` | service type (trim leading space, normalize) |
| 32 | `Date AAA Arb Filed` | date |

## Data-quality gotchas

- Junk sentinels: `Plaintiff Attorney = "Header not found"`, `Policy No = "N/A"`, empty `Verification Status`.
- `Service Type` has a leading space (`" PHYSICAL THERAPY"`).
- Provider/insurer names are long and inconsistent → require canonical normalization, not literal storage.
- `Claimant` is `LAST,FIRST` → parse to first/last for the patient master.
- Dates arrive as datetime values; financials as numeric strings.

## Decisions (locked — see migration-old-file-numbers.md)

- Single sheet drives both; **Packet ID authoritative** for lawsuit membership (no second sheet).
- **BRL_ preserves the original file year** from `Case_Id` (`44521-…` → `BRL_2021NNNNN`).
- Import **CLOSED / record-only**; **lazy** Clio folder creation.
- Scale forces a **chunked, resumable, idempotent background job**.
- **All matters currently in BM are TEST data** and may be deleted/overwritten → the import can start from a
  **clean slate** (wipe test `ClaimIndex`/`Lawsuit`/patient/reference rows first). Removes any BRL_ numbering
  collision worry and lets us reset sequences before the real load.

## Open for discussion (next)

- **Normalization**: patient (LAST,FIRST + dedup), provider + provider group, insurer, court/venue, service
  type, case type, denial reason — canonicalize to BM's reference registries rather than store raw.
- **Seed-first for a no-reject import**: pre-extract every distinct reference value (providers, insurers,
  patients, courts, service types, denial reasons) and upsert into BM's registries BEFORE the matter import,
  so every row resolves to an existing record and nothing gets held/rejected.
