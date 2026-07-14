// Resumable ledger + manifest, in Postgres. Two tables (created on demand, additive — no app schema
// change): legacy_case (per-case progress) and legacy_document (the manifest BM will read). Everything is
// keyed by Atlas case_id, which equals BM's old_matter_number.
import { Pool } from "pg";
import { config, assertLedger } from "./config";

let pool: Pool | null = null;
export function db(): Pool {
  if (!pool) {
    assertLedger();
    pool = new Pool({ connectionString: config.ledger.databaseUrl });
  }
  return pool;
}

export async function initSchema() {
  await db().query(`
    CREATE TABLE IF NOT EXISTS legacy_case (
      case_id      TEXT PRIMARY KEY,
      status       TEXT NOT NULL DEFAULT 'pending',   -- pending | listed | done | error
      priority     INTEGER NOT NULL DEFAULT 0,        -- higher = processed first (e.g. open matters)
      file_count   INTEGER,
      done_count   INTEGER NOT NULL DEFAULT 0,
      error        TEXT,
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    ALTER TABLE legacy_case ADD COLUMN IF NOT EXISTS priority INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE legacy_case ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0;
    CREATE TABLE IF NOT EXISTS legacy_document (
      id            BIGSERIAL PRIMARY KEY,
      case_id       TEXT NOT NULL,
      atlas_file_id BIGINT NOT NULL,
      folder_path   TEXT,
      file_name     TEXT NOT NULL,
      byte_size     BIGINT,
      sha256        TEXT,
      blob_key      TEXT,
      status        TEXT NOT NULL DEFAULT 'pending',   -- pending | stored | error
      error         TEXT,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (case_id, atlas_file_id)
    );
    ALTER TABLE legacy_document ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0;
    CREATE INDEX IF NOT EXISTS legacy_document_case_idx ON legacy_document (case_id);
    CREATE INDEX IF NOT EXISTS legacy_document_status_idx ON legacy_document (status);
    CREATE INDEX IF NOT EXISTS legacy_document_sha_idx ON legacy_document (sha256);
    -- Supports storedDocByFileId(): the pre-download cache lookup, run once per document.
    CREATE INDEX IF NOT EXISTS legacy_document_fileid_idx ON legacy_document (atlas_file_id);
  `);
}

export async function upsertCases(ids: string[], priority = 0) {
  if (!ids.length) return;
  const CHUNK = 1000;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const slice = ids.slice(i, i + CHUNK);
    const p = `$${slice.length + 1}`;
    const values = slice.map((_, j) => `($${j + 1}, ${p})`).join(",");
    await db().query(
      `INSERT INTO legacy_case (case_id, priority) VALUES ${values}
       ON CONFLICT (case_id) DO UPDATE SET priority = GREATEST(legacy_case.priority, EXCLUDED.priority)`,
      [...slice, priority]
    );
  }
}

// Newest-first: higher priority first (open matters seeded with --priority), then Case_Id DESC (highest
// 445YY-NNNNNN = most recent). Set newestFirst=false for oldest-first.
//
// CRITICAL: an 'error' case must NOT stay eligible forever. A case with even one unservable file (Atlas
// 500s on broken cross-org refs) keeps status='error'; if that kept it in the candidate set, it would sort
// straight back to the top (newest case_id first) and be re-selected every pass. Once ~`limit` such cases
// accumulate they fill the whole batch, the sweep stops reaching NEW cases, and the run spins forever —
// re-downloading nothing, storing nothing, and hammering Atlas into producing MORE 500s. (This is exactly
// what happened on the first full run.) So error cases get `maxAttempts` tries and then step aside; their
// failed docs remain in legacy_document and are collected later by `--retry-errors`.
export async function nextCases(limit: number, newestFirst = true, maxAttempts = 3): Promise<string[]> {
  const dir = newestFirst ? "DESC" : "ASC";
  const r = await db().query(
    `SELECT case_id FROM legacy_case
      WHERE status IN ('pending','listed')
         OR (status = 'error' AND attempts < $2)
      ORDER BY priority DESC, case_id ${dir} LIMIT $1`,
    [limit, maxAttempts]
  );
  return r.rows.map((x) => x.case_id as string);
}

/** Count a processing attempt against a case, so a permanently-broken case can't spin the sweep forever. */
export async function bumpCaseAttempt(caseId: string) {
  await db().query(`UPDATE legacy_case SET attempts = attempts + 1 WHERE case_id = $1`, [caseId]);
}

export async function setCase(caseId: string, patch: { status?: string; file_count?: number; done_count?: number; error?: string | null }) {
  await db().query(
    `UPDATE legacy_case SET status=COALESCE($2,status), file_count=COALESCE($3,file_count),
       done_count=COALESCE($4,done_count), error=$5, updated_at=now() WHERE case_id=$1`,
    [caseId, patch.status ?? null, patch.file_count ?? null, patch.done_count ?? null, patch.error ?? null]
  );
}

export async function upsertDocuments(caseId: string, docs: { atlasFileId: number; folderPath: string; fileName: string }[]) {
  for (const d of docs) {
    await db().query(
      `INSERT INTO legacy_document (case_id, atlas_file_id, folder_path, file_name)
       VALUES ($1,$2,$3,$4) ON CONFLICT (case_id, atlas_file_id) DO NOTHING`,
      [caseId, d.atlasFileId, d.folderPath, d.fileName]
    );
  }
}

export async function pendingDocsForCase(caseId: string) {
  const r = await db().query(
    `SELECT id, atlas_file_id, folder_path, file_name FROM legacy_document WHERE case_id=$1 AND status <> 'stored' ORDER BY id`,
    [caseId]
  );
  return r.rows as { id: string; atlas_file_id: string; folder_path: string; file_name: string }[];
}

export async function markDocStored(id: string, patch: { byte_size: number; sha256: string; blob_key: string }) {
  await db().query(`UPDATE legacy_document SET status='stored', byte_size=$2, sha256=$3, blob_key=$4, error=NULL WHERE id=$1`, [
    id,
    patch.byte_size,
    patch.sha256,
    patch.blob_key,
  ]);
}

export async function markDocError(id: string, error: string) {
  await db().query(`UPDATE legacy_document SET status='error', error=$2, attempts=attempts+1 WHERE id=$1`, [id, error.slice(0, 500)]);
}

/** Docs stuck in error, for the targeted low-concurrency retry pass (--retry-errors). */
export async function errorDocs(limit: number, maxAttempts = 0) {
  const r = await db().query(
    `SELECT id, case_id, atlas_file_id, folder_path, file_name, attempts FROM legacy_document
     WHERE status='error' ${maxAttempts ? "AND attempts < " + Number(maxAttempts) : ""}
     ORDER BY attempts ASC, id ASC LIMIT $1`,
    [limit]
  );
  return r.rows as { id: string; case_id: string; atlas_file_id: string; folder_path: string; file_name: string; attempts: number }[];
}

/**
 * DISTINCT failing files for the deduped retry (--retry-errors). Atlas serves the same physical file under
 * thousands of cases, and a broken one (e.g. an unservable `_ATT_Letter_` PDF) fails in every case that
 * references it — so the error rows are dominated by a small set of distinct-but-repeated files. We retry
 * each distinct atlas_file_id ONCE (one representative row); on success `propagateStoredByFileId` fixes all
 * the siblings without re-fetching. Turns a multi-million-attempt cleanup into one sized by distinct files.
 */
export async function distinctErrorFileIds(limit: number) {
  const r = await db().query(
    `SELECT DISTINCT ON (atlas_file_id) id, case_id, atlas_file_id, folder_path, file_name
       FROM legacy_document WHERE status='error'
      ORDER BY atlas_file_id, id LIMIT $1`,
    [limit]
  );
  return r.rows as { id: string; case_id: string; atlas_file_id: string; folder_path: string; file_name: string }[];
}

/** How many DISTINCT files are in error (vs. how many error rows) — sizes the deduped cleanup. */
export async function errorFileStats() {
  const r = await db().query(
    `SELECT count(*)::int rows, count(DISTINCT atlas_file_id)::int files FROM legacy_document WHERE status='error'`
  );
  return r.rows[0] as { rows: number; files: number };
}

/** After one representative of a broken-then-recovered file stores, point every OTHER error row that shares
 *  its atlas_file_id at the same blob — no re-download. Returns how many sibling rows were fixed. */
export async function propagateStoredByFileId(
  atlasFileId: string | number,
  patch: { byte_size: number; sha256: string; blob_key: string }
): Promise<number> {
  const r = await db().query(
    `UPDATE legacy_document SET status='stored', byte_size=$2, sha256=$3, blob_key=$4, error=NULL
      WHERE atlas_file_id=$1 AND status='error'`,
    [atlasFileId, patch.byte_size, patch.sha256, patch.blob_key]
  );
  return r.rowCount ?? 0;
}

/**
 * DISTINCT failing files, for the deduped retry pass.
 *
 * Failures are dominated by a small set of SHARED documents: Atlas serves the same file under thousands of
 * cases, and when it 500s on one it 500s on all of them. Measured: a single `_ATT_Letter_`

/** Re-derive legacy_case.status from its documents (a case is 'done' once every doc is stored). */
export async function reconcileCases() {
  const r = await db().query(`
    WITH agg AS (
      SELECT case_id,
             count(*) FILTER (WHERE status <> 'stored')::int AS bad,
             count(*) FILTER (WHERE status = 'stored')::int  AS good
      FROM legacy_document GROUP BY case_id
    )
    UPDATE legacy_case c
       SET status = CASE WHEN a.bad = 0 THEN 'done' ELSE 'error' END,
           done_count = a.good,
           error = CASE WHEN a.bad = 0 THEN NULL ELSE a.bad || ' files failed' END,
           updated_at = now()
      FROM agg a WHERE a.case_id = c.case_id AND c.status <> 'pending'
    RETURNING c.case_id, c.status
  `);
  return {
    done: r.rows.filter((x: any) => x.status === "done").length,
    stillError: r.rows.filter((x: any) => x.status === "error").length,
  };
}

/** Every doc Atlas would not give us — the permanent-failure list (--report-failures). */
export async function failureRows() {
  const r = await db().query(
    `SELECT case_id, folder_path, file_name, atlas_file_id, attempts, error
     FROM legacy_document WHERE status='error' ORDER BY case_id, folder_path, file_name`
  );
  return r.rows as any[];
}

/** Dedup helper: has this exact content already been stored (any case)? Returns its blob_key if so. */
export async function blobKeyForHash(sha256: string): Promise<string | null> {
  const r = await db().query(`SELECT blob_key FROM legacy_document WHERE sha256=$1 AND status='stored' AND blob_key IS NOT NULL LIMIT 1`, [sha256]);
  return r.rows[0]?.blob_key ?? null;
}

/**
 * PRE-DOWNLOAD dedup: has this exact Atlas file (by atlas_file_id) already been stored under ANY case?
 *
 * Atlas serves the same physical file under many cases (shared packet-level docs, the same AOB/IME/fax PDFs
 * referenced across matters) — measured at ~40% of all documents. blobKeyForHash() dedups by CONTENT, but
 * only after paying to download the bytes. This dedups by IDENTITY, so we skip the download entirely.
 *
 * SAFETY: this is only sound because atlas_file_id → content is 1:1. Verified against 770,128 stored rows:
 * ZERO file IDs mapped to more than one sha256. If Atlas ever scoped IDs per-case, reusing a blob would
 * attach the WRONG document to a client's matter — so if that invariant is ever in doubt, delete this.
 */
export async function storedDocByFileId(atlasFileId: string | number) {
  const r = await db().query(
    `SELECT byte_size, sha256, blob_key FROM legacy_document
      WHERE atlas_file_id=$1 AND status='stored' AND blob_key IS NOT NULL LIMIT 1`,
    [atlasFileId]
  );
  return (r.rows[0] as { byte_size: string; sha256: string; blob_key: string } | undefined) ?? null;
}

export async function statusReport() {
  const cases = await db().query(`SELECT status, count(*)::int n FROM legacy_case GROUP BY status`);
  const docs = await db().query(`SELECT status, count(*)::int n, COALESCE(sum(byte_size),0)::bigint bytes FROM legacy_document GROUP BY status`);
  return { cases: cases.rows, docs: docs.rows };
}
