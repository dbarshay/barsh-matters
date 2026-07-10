# Legacy bulk-import marking — implementation spec

**Decision (2026-07-10):** make NF bulk-imported ("legacy") matters clearly distinguishable **without**
mutating the parsed matter-number strings. A `-legacy` suffix on the stored number would break Clio
storage routing, email subject-tag matching, and OCR cross-reference (see "Do NOT touch" below).

Approach: **one flag column + one display-only formatter.** The canonical
`BRL_YYYYNNNNNN` / `YYYY.MM.NNNNN` numbers stay byte-for-byte parseable; the `-legacy` marker is
rendered only where a human reads it.

---

## 1. Schema — add a batch tag to `ClaimIndex`

```prisma
model ClaimIndex {
  matter_id      Int     @id
  display_number String?
  // ... existing fields ...
  import_batch   String? // e.g. "nf-legacy"; null = normal/live matter. Set once at bulk import.

  // ... existing indexes ...
  @@index([import_batch])
}
```

- **Nullable string, not boolean** — lets us distinguish *this* NF load from any future bulk load
  ("nf-legacy-2026", "carisk-backfill", …) and filter/report per batch. `null` = a normal live matter.
- Additive nullable column + index → **safe migration, no backfill** (existing rows read as non-legacy).
- `old_matter_number` (the `445YY-…` paper number) already exists and legacy NF matters will also carry
  it, but that's derived source data; `import_batch` is the explicit, queryable "which load" flag.

## 2. Importer — set the flag once

In the NF bulk importer path (mirrors `lib/import/createMatters.ts` `createMattersFromStaged`), add
`import_batch: "nf-legacy"` to every row it inserts. **Number allocation is unchanged** —
`allocateMatterNumbers` / `formatBrlDisplayNumber` still mint clean `BRL_YYYYNNNNNN`.

```ts
const data = rows.map((r, i) => ({
  matter_id: nums.matterIds[i],
  display_number: nums.displayNumbers[i], // unchanged, clean BRL_
  // ...
  import_batch: "nf-legacy",
}));
```

## 3. Display layer — one helper, used everywhere a human sees the number

Add to `lib/matterNumbering.ts`:

```ts
/** Display-ONLY. Never feed the result to Clio storage, email tags, or cross-ref parsers. */
export function formatMatterDisplayLabel(
  displayNumber: string,
  opts?: { legacy?: boolean }
): string {
  return opts?.legacy ? `${displayNumber}-legacy` : displayNumber;
}
```

Call it (passing `legacy: matter.import_batch === "nf-legacy"`) in the presentation surfaces only:

- `app/matters/page.tsx`, `app/matter/[id]/page.tsx`, `app/lawsuits/page.tsx` (lists / headers)
- print queue (`app/print-queue/page.tsx`), claim-index UI (`app/admin/claim-index/page.tsx`)
- document titles / folder labels (`lib/documents/folderTaxonomy.ts`, `titleFields.ts`) — display text only
- any matter-picker / search result label

If you'd rather tag the lawsuit dotted number too, apply the same helper to the `YYYY.MM.NNNNN`
label — again display-only.

## 4. Do NOT touch (these consume the raw number and will break on a suffix)

- `lib/clioStoragePlan.ts` — `^BRL_\d{9}$` and `^BRL_(\d{4})(\d{5})$` build Clio folder targets.
- `lib/matterEmail.ts` `ensureMatterSubjectTag` + `lib/graph/webhookMessageSync.ts` dotted/BRL regexes
  (`\b(20\d{2})[.\-/](\d{2})[.\-/](\d{3,})\b`) — email is routed to matters by these tags.
- `lib/graph/inboundAttachmentOcr.ts` / OCR cross-reference — matches docs to matters by the raw number.
- `lib/matterNumbering.ts` `formatBrlDisplayNumber`, `allocateMatterNumbers`, `lib/buildMasterId.ts`.

Rule of thumb: **stored/parsed = raw number; rendered-to-human = run through `formatMatterDisplayLabel`.**

## 5. Benefits

- Clio filing, email routing, and cross-reference keep working unchanged.
- Legacy files are unmistakable in every list, title, and picker.
- `WHERE import_batch = 'nf-legacy'` gives instant filtering/reporting on the whole set.
- Reversible with no data migration — drop the display suffix (or the column) any time.
