# Atlas → Azure legacy-document migration

Standalone, **resumable** pipeline that pulls **every document for every matter (open + closed)** out of
the old case-management system (LawSpades / "445 ATLAS") and lands them in Azure Blob Storage, writing a
manifest so Barsh Matters (BM) can serve them per matter — **with Atlas out of the loop entirely** once the
run completes.

This lives under `scripts/` and is **completely separate from the BM Next app** — it never imports app
runtime code and is run by hand with `npx tsx`. It only shares the database (for the manifest tables).

---

## What we reverse-engineered (facts, verified in-browser)

- Atlas is a React SPA over a REST API at **`https://api.lawspades.com/AtlasAPI/api`**, authenticated with a
  **JWT bearer token** (from `localStorage.token` of a logged-in session; there's a `refreshtoken` and an
  `exp` — tokens expire ~hourly, so long runs must refresh).
- **Per-case document tree** (reliable): `GET /case/{caseId}/document/node/false` → JSON array of folder
  nodes; nested `items` bottom out in **file leaves** shaped like
  `{ id, ImageId, name:"AOB.pdf", node_level, parent_id, is_active }`. `id`/`ImageId` is the file id.
- **Case id === `old_matter_number`** we already store on every BM matter (the `445YY-NNNNNN` Case_Id). So
  doc→matter mapping is a direct key lookup — no OCR, no filename guessing.
- Packets (`445-PKTYY-…`) have their own document sets too → map to BM dotted lawsuits.
- Volume: sampled 2021 closed files hold **34–114 docs each (~60 avg)**; newer files run higher (168 seen).
  → ~264k matters × ~60 ≈ **~16M files, ~5–15 TB** (before dedup — sibling cases duplicate heavily).

- **Per-file download** (CONFIRMED, wired): `GET /case/{caseId}/document/file/{fileId}/view` → 200 streaming
  the raw bytes with `Content-Type` (e.g. `application/pdf`) and `Content-Disposition: attachment; filename=…`.
  `fileId` is the tree leaf's `id`/`ImageId`. Double-clicking a file in the UI hits this and renders the blob;
  server-side there's no CORS preflight (that was a browser artifact of the Authorization header).

The pipeline is now **fully wired** — every endpoint is confirmed. Remaining before a full run: enumerate the
case list (open + closed) and stand up the Azure account.

---

## Pipeline stages (all resumable & idempotent)

1. **Enumerate** every Case_Id (open + closed) → `legacy_case` ledger rows.
   - Source options: a CSV you provide, or Atlas `Case/simple_search` paging (see `atlasClient.enumerateCases`).
   - ⚠️ The `NF All Closed.xlsx` sheet is **closed-only** — open matters must come from Atlas search or a
     separate open-matter export.
2. **List** each case's files via the document tree → `legacy_document` rows (`status=pending`).
3. **Download** each file from Atlas (`fetchFileBytes`).
4. **Hash + upload** to Azure Blob under `container/{caseId}/{folder}/{fileName}` (Cool tier). Dedup by
   sha256 so shared sibling docs are stored once (blob key can point at the canonical hash).
5. **Record** the manifest row (`status=stored`, blob key, size, hash). BM reads these to render "Legacy Docs".

Re-running skips anything already `stored`; failures stay `pending`/`error` and are retried.

---

## BM serving side (phase 2 — after extraction)

Once `legacy_document` is populated, BM shows a **"Legacy Docs"** panel on each matter:
`old_matter_number` → `legacy_document WHERE case_id = ?` → generate a short-lived Azure **SAS URL** per file
so staff click and the PDF opens. No Atlas involvement. (Route + matter-page button are a small additive
change — proposed, not yet built.)

---

## Prerequisites / env (`.env` in this folder or the repo `.env.local`)

```
ATLAS_API_BASE=https://api.lawspades.com/AtlasAPI/api
ATLAS_TOKEN=<paste a fresh JWT from localStorage.token>      # expires ~hourly
ATLAS_REFRESH_TOKEN=<localStorage.refreshtoken>              # optional, for auto-refresh
AZURE_STORAGE_CONNECTION_STRING=<from the Azure storage account>
AZURE_BLOB_CONTAINER=atlas-legacy-docs
MIGRATION_DATABASE_URL=<Postgres for the manifest; defaults to DATABASE_URL>
CASE_CONCURRENCY=4
FILE_CONCURRENCY=6
DRY_RUN=1            # 1 = don't upload/write, just walk + log
LIMIT_CASES=5       # cap for test runs
```

## Run order (newest / open matters FIRST)

Processing order = `priority DESC, case_id DESC` — so the highest Case_Ids (most recent) go first, and you
can force a set to lead by seeding it with `--priority`. Open matters aren't in the closed sheet, so seed
them from an open-matter list (or `--from-atlas`) with a high priority:

```
# stage 1a — seed OPEN matters first (highest priority so they lead)
npx tsx scripts/atlas-migration/extract.ts --enumerate --from-csv open-matters.csv --priority 10
# stage 1b — seed the closed matters (default priority 0)
npx tsx scripts/atlas-migration/extract.ts --enumerate --from-csv closed-matters.csv

# stage 2–5 — extract (resumable; open matters + newest Case_Ids drain first)
npx tsx scripts/atlas-migration/extract.ts --run

npx tsx scripts/atlas-migration/extract.ts --status     # progress + GB stored
```

Default is newest-first; set `OLDEST_FIRST=1` to reverse. Start with `DRY_RUN=1 LIMIT_CASES=5` to validate
the tree walk + file fetch on a handful of cases before committing to storage.

## Security / compliance

This moves ~16M **PHI** files. Run under the same BAA/security bar as go-live: encrypted Azure account,
private container (no public access), SAS-only reads, and keep the offline drive as a **cold backup** copy —
not as the thing BM reads from (Vercel can't reach an office drive; a single unencrypted drive is a
data-loss + HIPAA risk).
