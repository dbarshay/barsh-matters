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

## Status

- **A (done):** schema fields + shared matcher/resolver; email + Unmatched-assign route by legacy numbers.
- **B (done):** editable "Old Matter Number" / "Old Lawsuit Number" fields on the matter/lawsuit pages
  (`components/OldFileNumberField.tsx` + `/api/admin/old-file-number`).
- **C (todo):** wire legacy detection (incl. filename scan) into Upload Docs + inbound email-attachment OCR.
- **D (todo):** new scan/drop folder channel.
