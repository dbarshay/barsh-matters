# Migration notes — legacy paper file numbers (#130)

Two legacy taxonomies map onto the two BM taxonomies. Each legacy number becomes a BM file that stores
the legacy number in a dedicated field; scans/emails mentioning either number route to it. Retired once
the legacy files are closed out.

| Legacy | Example | BM analog | Stored in |
|---|---|---|---|
| Individual Matter | `445YY-NNNNNN` (e.g. `44524-528894`) | `BRL_2026NNNNN` | `ClaimIndex.old_matter_number` |
| Lawsuit Matter | `445-PKTYY-NNNNNN` (e.g. `445-PKT24-126923`) | `YYYY.MM.NNNNNN` | `Lawsuit.oldLawsuitNumber` |

A Lawsuit Matter aggregates one or more Individual Matters (same as the BM lawsuit → matters relationship).
Precedence: if a document/email mentions **both**, it routes to the **Lawsuit**.

## Matcher rules (validated against the 89-doc OCR sample set)

- **Individual:** `445YY` + a required separator (dash) + digits. The dash is essential — it's what keeps
  patient ids and ZIP codes out. Tolerates OCR splitting the number after the dash with a space/newline
  (`44524-\n528894`, `44524- 528894`) and normalizes the whitespace out. A trailing `_NNNNNNNNN` /
  ` NNNNNNNNN` is a separate id (bill/claim/scan), **not** part of the file number, and is dropped.
- **Lawsuit:** anchored on the distinctive literal **`PKT`** (+ year + number), tolerant of OCR mangling
  the `445-` prefix or the dashes; normalized to canonical `445-PKTYY-NNNNNN`. `PKT` almost never occurs
  by accident, and word-boundary guards reject `backpacket` / `spktr`.
- Shared implementation: `extractMatterNumbers` / `resolveMatterContext` in `lib/graph/webhookMessageSync.ts`
  (used by email, the Unmatched "Assign", and the backstop cron).

## What the OCR scan of the sample set showed

- **13 of 89** docs expose an old number in the OCR text (9 distinct: 7 individual, 2 lawsuit — `445-PKT24-126923`,
  `445-PKT25-133860`). OCR reads them reliably.
- **OCR gotchas found:** number split after the dash by a newline/space (handled); number split across
  separate table cells (not recoverable by regex → manual assign); OCR garble like `44526-8%` / `445-PKT*`
  (falls to manual assign).
- **Confirmed non-matches (correctly rejected):** `445DOS` (a DOS/date-of-service label), `K214452 CABRERA`
  (patient id + name), and a `0.9728…445561…` OCR **confidence float** (metadata, not document text — would
  not even appear in production, which matches on clean extracted text).
- **High-yield signal for the document channel (Phase C):** many docs carry the old number in the
  **filename** (`10- 44526-812455_….pdf`, `445-PKT24-126923_….pdf`) even when the page text is messy — so
  the document detector should scan the filename too, not just the OCR text.

## Migration sequence (spreadsheet-based, first cutover)

Because a lawsuit's membership is **fixed at creation** (individuals are linked during lawsuit creation
and **no matters can be added afterward**), the order is mandatory:

1. **Individual-matter spreadsheet first** → creates each `ClaimIndex` row, assigns a `BRL_2026NNNNN`,
   stores the legacy `445YY-NNNNNN` in `old_matter_number`.
2. **Lawsuit spreadsheet second** → creates each `Lawsuit`, stores the legacy `445-PKTYY-NNNNNN` in
   `oldLawsuitNumber`, and **links** the already-created individuals at creation.

The **lawsuit spreadsheet carries the membership** — each lawsuit row lists the individual matters it
aggregates. The **join key** is the legacy `445YY-…` number: the lawsuit import resolves each listed old
number via `ClaimIndex.old_matter_number` → the created matter → links it (`ClaimIndex.master_lawsuit_id`
= `Lawsuit.masterLawsuitId`). (Native BM link field is the same.)

## Status

- **A (done):** schema fields (`ClaimIndex.old_matter_number`, `Lawsuit.oldLawsuitNumber`) + shared
  matcher/resolver in `lib/graph/webhookMessageSync.ts`; email + Unmatched-assign route by legacy numbers,
  lawsuit precedence.
- **B (done):** editable "Old Matter Number" / "Old Lawsuit Number" fields on the matter/lawsuit pages
  (`components/OldFileNumberField.tsx` + `/api/admin/old-file-number`).
- **C part 1 (done):** `app/api/documents/ocr-prefill/route.ts` now runs the shared matcher/resolver over
  **filename + OCR text**, recognizing all four taxonomies and returning a resolved `fileNumberMatch`.
- **C part 2 (done):** inbound email-attachment OCR (`lib/graph/inboundAttachmentOcr.ts`) now detects all
  taxonomies from filename+text and sets `predictedMatterId` from the resolved match; the Upload Docs UI
  auto-runs a matter search on the resolved display number (so legacy docs surface the right matter).
  Note: pure **lawsuit** matches in Upload Docs still route via the lawsuit doc tree (the upload page is
  matter-oriented) — fine for now.
- **D (todo):** new scan/drop folder channel. Design decided: three intake front-doors (scan-to-email,
  watched cloud folder, bulk drag-drop) all funnel into ONE `ingestScannedDocument` core; de-dup by file
  content hash (`fileHash`) + `graphAttachmentId`, so the same file via multiple channels files once.
- **Importer (todo):** the first-cutover tooling — see below.

## Reference seeding (Approach A — seeder does match-or-create in-app)

The build sandbox CANNOT reach the live Neon DB, so "match existing vs. new" happens in the **seeder**
(runs in-app with DB access), not in a static worksheet. Registry model: `ReferenceEntity` (`type`,
`displayName`, `normalizedName`, `active`; `@@unique([type, normalizedName])`) + `ReferenceAlias`.

- The **normalization worksheet** (`NF-normalization-worksheet.xlsx`) captures the operator's **canonical
  name** choices per source value (merges within the source — e.g. the single Provider dup
  `NICOLE PULASKI, LAC.` ← `Nicole Pulaski, LAC`).
- The **seeder**, per canonical value: normalize → look up an existing `ReferenceEntity` of that type
  (+ its aliases). **MATCH** → map to it, add nothing. **NEW** → create it; **providers `active=false`**
  (legacy/closed), other new types default active (adjust per table).
- **Dry-run preview report first**: "N matched existing, M new (added inactive)", full match/new breakdown
  for review; commit only on confirm.
- Provider column is essentially clean (145 distinct, 1 real dup found by fuzzy match). Insurer (1,060),
  SettledWith (2,767), DenialReason (947), ServiceType (433) are the ones needing real canonicalization
  in the worksheet.
- Reference-tab distinct counts (full 264,179 rows): Provider 145 · ProviderGroup 44 · Insurer 1,060 ·
  Court 17 · ServiceType 433 · DenialReason 947 · Status 134 · Defendant 353 · SettledWith 2,767 ·
  VerificationStatus 2 · PlaintiffAttorney 1 · **distinct patients (Claimant) 42,407** (handled separately
  after the dedup decision — one-per-matter vs name+key vs name-only).

## First-cutover import — "NF All Closed" spreadsheet

Source: `NF All Closed.xlsx`, one sheet, **33 columns, ~264,179 data rows** (one row per legacy individual
file; `Case_Id` unique). All `Case Type = NF`, all closed. Key columns:

- `Case_Id` = legacy **Individual** number `445YY-NNNNNN` → `ClaimIndex.old_matter_number`.
- `Packet ID` = legacy **Lawsuit** number `445-PKTYY-NNNNNN` → `Lawsuit.oldLawsuitNumber`. Present on ~46%
  of rows; ~2,448 distinct packets per 30k sample (→ **~20k lawsuits, ~264k matters** full-file). Some
  packets aggregate 60–75 members. Rows with no Packet ID are standalone individual matters.
- Others → matter fields: `Claimant`(patient), `Claim Number`, `Policy No`, `Index OR AAA Number`,
  `Insurance Company`, `Provider`, `Provider Group`, `Court Name`, `Defendant`, `Plaintiff Attorney`,
  `D.O.S. Start/End`, `Date Of Loss`, `Date Opened`, `Final Status`(CLOSED), `Settled With`, `Service Type`,
  `Case Filling Status (YES/NO)`, and financials (`Claim Amount`, collection/voluntary/total payments,
  `Suit Balance`). Watch for junk like `Plaintiff Attorney = "Header not found"`, `Policy No = "N/A"`.

### Decisions (locked)
- **Single sheet drives both.** Packet ID is **authoritative** for lawsuit membership — no separate lawsuit
  sheet. Lawsuit-level fields (court, index #, attorney) derive from the packet's member rows.
- **BRL_ numbers preserve the ORIGINAL file year** from the `Case_Id` (`44521-…` → `BRL_2021NNNNN`), not the
  import year.
- **Import as CLOSED / record-only** (no active workflow). Create the Clio document folder **lazily** — only
  when the first document is associated (don't provision ~264k empty folders).

### Architecture (required by scale)
- **Chunked, resumable, idempotent background job** (a single serverless request can't process 264k rows).
  Batch inserts; track progress in an import-run record; dedup by `old_matter_number` (matters) and
  `oldLawsuitNumber` (lawsuits) so re-runs are safe.
- **Order within the job:** (1) create/upsert all individual matters (assign BRL_ by original year, set
  old_matter_number, closed status, mapped fields); (2) group non-empty Packet IDs, create/upsert one lawsuit
  per packet, link members (`ClaimIndex.master_lawsuit_id` + `Lawsuit.lawsuitMatters`).
