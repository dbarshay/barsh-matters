// Orchestrator for the Atlas→Azure migration. Resumable + idempotent; safe to Ctrl-C and re-run.
//
//   npx tsx scripts/atlas-migration/extract.ts --enumerate --from-csv cases.csv   # stage 1: seed case list
//   npx tsx scripts/atlas-migration/extract.ts --enumerate --from-atlas           # stage 1: via Atlas search
//   npx tsx scripts/atlas-migration/extract.ts --run                              # stages 2-5
//   npx tsx scripts/atlas-migration/extract.ts --retry-errors                     # slow retry of stuck docs
//   npx tsx scripts/atlas-migration/extract.ts --report-failures                  # CSV of unrecoverable docs
//   npx tsx scripts/atlas-migration/extract.ts --status                           # progress report
//
// Start with DRY_RUN=1 LIMIT_CASES=5 to validate the tree walk + fetch before writing to storage.
import { readFileSync, existsSync } from "fs";
import { config } from "./config";
import {
  getCaseDocumentTree,
  flattenFileLeaves,
  fetchFileBytes,
  enumerateCasesFromAtlas,
} from "./atlasClient";
import {
  initSchema,
  upsertCases,
  nextCases,
  setCase,
  upsertDocuments,
  pendingDocsForCase,
  markDocStored,
  markDocError,
  blobKeyForHash,
  storedDocByFileId,
  statusReport,
  distinctErrorFileIds,
  errorFileStats,
  propagateStoredByFileId,
  reconcileCases,
  failureRows,
  bumpCaseAttempt,
  db,
} from "./ledger";
import { writeFileSync } from "fs";
import { sha256, blobKeyFor, uploadBlob } from "./azureStore";

const args = process.argv.slice(2);
const has = (f: string) => args.includes(f);
const val = (f: string) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : undefined; };
const num = (v: string | undefined, d: number) => (v && Number.isFinite(Number(v)) ? Number(v) : d);

// Simple concurrency pool.
async function pool<T>(items: T[], limit: number, fn: (t: T) => Promise<void>) {
  let i = 0;
  const workers = Array.from({ length: Math.max(1, limit) }, async () => {
    while (i < items.length) {
      const idx = i++;
      await fn(items[idx]);
    }
  });
  await Promise.all(workers);
}

const contentType = (name: string) =>
  /\.pdf$/i.test(name) ? "application/pdf" : /\.(jpe?g)$/i.test(name) ? "image/jpeg" : /\.png$/i.test(name) ? "image/png" : "application/octet-stream";

async function enumerate() {
  await initSchema();
  let ids: string[] = [];
  const csv = val("--from-csv");
  if (csv) {
    if (!existsSync(csv)) throw new Error(`CSV not found: ${csv}`);
    ids = readFileSync(csv, "utf8")
      .split(/\r?\n/)
      .map((l) => l.split(",")[0].trim())
      .filter((x) => x && /\d/.test(x) && !/case/i.test(x)); // drop header
  } else if (has("--from-atlas")) {
    ids = await enumerateCasesFromAtlas();
  } else {
    throw new Error("Provide --from-csv <file> or --from-atlas");
  }
  ids = Array.from(new Set(ids));
  const priority = Number(val("--priority") || 0) || 0; // seed open matters with e.g. --priority 10 to lead
  await upsertCases(ids, priority);
  console.log(`Enumerated ${ids.length} cases into legacy_case${priority ? ` (priority ${priority})` : ""}.`);
}

type LedgerDoc = { id: string; atlas_file_id: string; folder_path: string; file_name: string };

let skippedFetches = 0; // run-wide total of documents satisfied from the file-ID cache (no download at all)
let auditsRun = 0;
let auditsPassed = 0;

// Continuous verification of the file-ID cache.
//
// The cache assumes atlas_file_id -> content is 1:1. That was MEASURED, not guessed: before the cache
// existed we downloaded every duplicate independently, and across 311,813 ID-duplicate downloads not one
// produced a different sha256. But a cache hit is a download we don't perform, which means it is also a
// hash we no longer check — so from here on the invariant would be trusted, not tested, across ~46M docs.
//
// So: audit a random sample of cache hits. Re-download the file, hash it, and confirm it matches the blob
// we were about to reuse. A mismatch means Atlas scoped that file ID per-case and we would be attaching the
// WRONG DOCUMENT to a client's matter — so it does not warn, it HALTS the run.
const AUDIT_RATE = Number(process.env.AUDIT_CACHE_RATE ?? 0.01); // 1% of cache hits; 0 disables

class CacheIntegrityError extends Error {}

/**
 * Download → hash → dedup → upload → mark stored. Shared by the main run and the retry pass.
 * Returns which path was taken so the CALLER can count per-case: a module-level counter cannot be used for
 * per-case stats, since cases run concurrently and would steal each other's numbers.
 */
type StoreResult = "stored" | "cached" | "error";

async function storeDoc(doc: LedgerDoc, caseId: string): Promise<StoreResult> {
  try {
    // Fast path: Atlas serves the same physical file under many cases (~40% of all documents). If we have
    // already stored this atlas_file_id, point this row at the existing blob and skip the download entirely.
    // Safe because atlas_file_id → content is 1:1 (verified: 0 conflicts across 770k stored rows).
    const known = await storedDocByFileId(doc.atlas_file_id);
    if (known) {
      // Sample-audit: prove the invariant still holds instead of assuming it.
      if (AUDIT_RATE > 0 && Math.random() < AUDIT_RATE) {
        const buf = await fetchFileBytes(
          { atlasFileId: Number(doc.atlas_file_id), fileName: doc.file_name, folderPath: doc.folder_path },
          caseId
        );
        const actual = sha256(buf);
        auditsRun++;
        if (actual !== known.sha256) {
          // Do NOT recover from this. If file IDs are not globally content-stable, every cache hit we have
          // already taken is suspect, and we may be misfiling client documents. Stop the world.
          throw new CacheIntegrityError(
            `CACHE INTEGRITY FAILURE — atlas_file_id ${doc.atlas_file_id} returned DIFFERENT content ` +
              `under case ${caseId} ("${doc.file_name}").\n` +
              `  expected sha256: ${known.sha256} (stored, blob ${known.blob_key})\n` +
              `  actual   sha256: ${actual}\n` +
              `File IDs are NOT globally content-stable. The file-ID cache is UNSAFE and documents reused ` +
              `from it may be attached to the wrong matter. Set AUDIT_CACHE_RATE=1 and re-verify, or disable ` +
              `the cache, before trusting any cached row.`
          );
        }
        auditsPassed++;
      }

      await markDocStored(doc.id, {
        byte_size: Number(known.byte_size),
        sha256: known.sha256,
        blob_key: known.blob_key,
      });
      skippedFetches++;
      return "cached";
    }

    const buf = await fetchFileBytes(
      { atlasFileId: Number(doc.atlas_file_id), fileName: doc.file_name, folderPath: doc.folder_path },
      caseId
    );
    const hash = sha256(buf);
    let key = await blobKeyForHash(hash); // dedup: reuse existing blob if identical content seen
    if (!key) {
      key = blobKeyFor(caseId, doc.folder_path, doc.file_name, hash);
      await uploadBlob(key, buf, contentType(doc.file_name));
    }
    await markDocStored(doc.id, { byte_size: buf.length, sha256: hash, blob_key: key });
    return "stored";
  } catch (e: any) {
    if (e instanceof CacheIntegrityError) throw e; // never swallow — this must halt the run, not fail a file
    await markDocError(doc.id, e?.message || String(e));
    return "error";
  }
}

/** Returns the number of NEW documents stored, so run() can detect a stalled (no-progress) sweep. */
async function processCase(caseId: string): Promise<number> {
  try {
    await bumpCaseAttempt(caseId); // bounded retries — see nextCases(): unbounded retries spin the sweep
    // Stage 2: list files (idempotent).
    const tree = await getCaseDocumentTree(caseId);
    const leaves = flattenFileLeaves(tree);
    await upsertDocuments(caseId, leaves);
    await setCase(caseId, { status: "listed", file_count: leaves.length });

    // Stages 3-5: download → hash → dedup → upload → manifest.
    const pending = await pendingDocsForCase(caseId);
    let done = 0; // stored this pass (downloaded OR served from cache)
    let cached = 0; // of which: satisfied from the file-ID cache, no download. Counted LOCALLY — a shared
    //                counter would be corrupted by the other cases running concurrently.
    await pool(pending, config.run.fileConcurrency, async (doc) => {
      const r = await storeDoc(doc, caseId);
      if (r === "cached") cached++;
      if (r !== "error") done++;
    });

    const total = await pendingDocsForCase(caseId);
    await setCase(caseId, { status: total.length === 0 ? "done" : "error", done_count: done, error: total.length ? `${total.length} files failed` : null });
    console.log(
      `  ${caseId}: ${leaves.length} files, ${done} stored, ${total.length} failed${cached ? ` (${cached} cached)` : ""}`
    );
    return done;
  } catch (e: any) {
    if (e instanceof CacheIntegrityError) throw e; // propagate past the per-case handler and stop the run
    await setCase(caseId, { status: "error", error: e?.message || String(e) });
    console.log(`  ${caseId}: CASE ERROR — ${e?.message || e}`);
    return 0;
  }
}

async function run() {
  await initSchema();
  const batchSize = config.run.limitCases || 10_000;
  const maxCaseAttempts = num(process.env.MAX_CASE_ATTEMPTS, 3);
  let processed = 0;
  let storedThisRun = 0;
  for (;;) {
    const remaining = config.run.limitCases ? config.run.limitCases - processed : batchSize;
    if (remaining <= 0) break;
    const cases = await nextCases(Math.min(remaining, 500), config.run.newestFirst, maxCaseAttempts);
    if (!cases.length) break;
    const before = storedThisRun;
    await pool(cases, config.run.caseConcurrency, async (c) => {
      storedThisRun += await processCase(c);
    });
    processed += cases.length;
    // Safety net: if a whole batch of 500 cases stored ZERO new documents, we are almost certainly
    // re-chewing cases we cannot make progress on. Stop rather than spin (and rather than keep pounding
    // Atlas, which only produces more 500s). Run --retry-errors / --status to see where things stand.
    if (storedThisRun === before && cases.length >= 50) {
      console.log(`\n*** STALLED: processed ${cases.length} cases and stored 0 new documents. Stopping. ***`);
      console.log(`*** Nothing is lost — failed docs stay in the ledger. Check: --status, then --retry-errors. ***\n`);
      break;
    }
    if (config.run.limitCases && processed >= config.run.limitCases) break;
  }
  console.log(
    `Run complete. Processed ${processed} cases, stored ${storedThisRun} new documents this pass ` +
      `(${skippedFetches} served from the file-ID cache — no download).${config.run.dryRun ? " (DRY RUN — no uploads)" : ""}`
  );
  if (auditsRun) {
    console.log(`Cache audit: ${auditsPassed}/${auditsRun} sampled cache hits re-downloaded and verified byte-identical.`);
  }
}

// Targeted retry over documents stuck in 'error'. Atlas returns HTTP 500 for two reasons:
//   (a) TRANSIENT — it buckled under our request rate; a slow, low-concurrency refetch succeeds.
//   (b) PERMANENT — broken/cross-org file references Atlas will never serve, however many times we ask.
//
// DEDUPED BY FILE: the error rows are dominated by a small set of files that Atlas serves under thousands of
// cases and 500s on every time (e.g. one `_ATT_Letter_` PDF accounted for 7,140 error rows). So we retry each
// DISTINCT atlas_file_id ONCE; on success, propagate the blob to every sibling row without re-downloading; on
// failure, leave the siblings alone rather than re-failing them thousands of times. Re-run it a couple times
// at low concurrency to drain (a); whatever distinct files still fail are the true (b) set.
//   RETRY_CONCURRENCY=2 npx tsx scripts/atlas-migration/extract.ts --retry-errors
async function retryErrors() {
  await initSchema();
  const conc = num(process.env.RETRY_CONCURRENCY, 2);
  const batch = num(process.env.RETRY_BATCH, 500);
  const stats = await errorFileStats();
  console.log(`Error backlog: ${stats.rows.toLocaleString()} rows across ${stats.files.toLocaleString()} DISTINCT files ` +
    `(${(stats.rows / Math.max(1, stats.files)).toFixed(1)}x sharing) — retrying each distinct file once.`);

  let filesRecovered = 0;
  let rowsRecovered = 0;
  let filesStillFailing = 0;
  for (;;) {
    const files = await distinctErrorFileIds(batch);
    if (!files.length) break;
    await pool(files, conc, async (d) => {
      const r = await storeDoc(d, d.case_id); // stores the representative row + uploads the blob
      if (r !== "error") {
        filesRecovered++;
        // Point every OTHER case that references this now-recovered file at the same blob — no re-download.
        const known = await storedDocByFileId(d.atlas_file_id);
        const siblings = known
          ? await propagateStoredByFileId(d.atlas_file_id, {
              byte_size: Number(known.byte_size),
              sha256: known.sha256,
              blob_key: known.blob_key,
            })
          : 0;
        rowsRecovered += 1 + siblings;
        if (siblings > 50) console.log(`  RECOVERED file ${d.atlas_file_id} "${d.file_name}" → +${siblings} shared rows`);
      } else {
        filesStillFailing++;
      }
    });
    console.log(`  ...pass: ${filesRecovered} distinct files recovered (${rowsRecovered.toLocaleString()} rows), ${filesStillFailing} files still failing`);
    if (files.length < batch) break;
  }
  const rc = await reconcileCases();
  console.log(`\nRetry complete. ${filesRecovered} distinct files recovered → ${rowsRecovered.toLocaleString()} document rows.`);
  console.log(`${filesStillFailing} distinct files still failing (Atlas will not serve them). Run again to drain transients, or:`);
  console.log(`Cases reconciled: ${rc.done} now done, ${rc.stillError} still have failures. Next: --report-failures.`);
}

// Dump every doc Atlas refused to serve, so they can be spot-checked in LawSpades before it goes dark.
async function reportFailures() {
  await initSchema();
  const rows = await failureRows();
  const esc = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [
    "case_id,folder_path,file_name,atlas_file_id,attempts,error",
    ...rows.map((r) => [r.case_id, r.folder_path, r.file_name, r.atlas_file_id, r.attempts, r.error].map(esc).join(",")),
  ].join("\n");
  const out = val("--out") || "atlas-failures.csv";
  writeFileSync(out, csv);
  const byCase = new Set(rows.map((r) => r.case_id));
  console.log(`Wrote ${rows.length} failed documents across ${byCase.size} cases → ${out}`);
}

// Settle whether a size-verified skip could actually be FAST: does Atlas support HEAD, does it return
// content-length, and is a HEAD meaningfully cheaper than a full GET? Raw fetches with an explicit token and
// NO auto-refresh — so it can never rotate the refresh token out from under the running sweep.
//   PROBE_TOKEN=<fresh access_token from a browser login> npx tsx extract.ts --probe-head
async function probeHead() {
  await initSchema();
  const token = process.env.PROBE_TOKEN || config.atlas.token;
  if (!token) throw new Error("Set PROBE_TOKEN=<a fresh access_token> (from a LawSpades browser login).");
  const base = config.atlas.apiBase;
  // Known-good, reasonably large files, so GET body time is meaningful.
  const r = await db().query(
    `SELECT case_id, atlas_file_id, file_name, byte_size FROM legacy_document
      WHERE status='stored' AND byte_size > 200000 ORDER BY random() LIMIT 6`
  );
  if (!r.rows.length) throw new Error("No stored docs to probe.");
  const time = async (fn: () => Promise<any>) => { const t = Date.now(); const v = await fn().catch((e: any) => ({ err: e?.message })); return { ms: Date.now() - t, v }; };
  const headMs: number[] = [];
  const getMs: number[] = [];
  let headWorks = true;
  let headHasLen = true;
  for (const d of r.rows) {
    const url = `${base}/case/${encodeURIComponent(d.case_id)}/document/file/${d.atlas_file_id}/view`;
    const h = await time(() => fetch(url, { method: "HEAD", headers: { Authorization: `Bearer ${token}` } }));
    const g = await time(() => fetch(url, { headers: { Authorization: `Bearer ${token}` } }).then(async (res: any) => ({ status: res.status, bytes: (await res.arrayBuffer()).byteLength })));
    const hStatus = h.v?.status ?? h.v?.err;
    const hLen = h.v?.headers?.get?.("content-length");
    if (h.v?.status !== 200) headWorks = false;
    if (!hLen) headHasLen = false;
    headMs.push(h.ms);
    getMs.push(g.ms);
    console.log(
      `${d.file_name.slice(0, 34).padEnd(34)} | HEAD ${String(hStatus).padStart(3)} ${String(h.ms).padStart(5)}ms len=${hLen ?? "—"} ` +
        `| GET ${String(g.v?.status ?? g.v?.err).padStart(3)} ${String(g.ms).padStart(5)}ms ${g.v?.bytes ?? "?"}b`
    );
  }
  const avg = (a: number[]) => Math.round(a.reduce((s, x) => s + x, 0) / a.length);
  console.log(`\nHEAD supported: ${headWorks ? "YES" : "NO"} | returns content-length: ${headHasLen ? "YES" : "NO"}`);
  console.log(`avg HEAD ${avg(headMs)}ms vs avg GET ${avg(getMs)}ms → HEAD is ${(avg(getMs) / Math.max(1, avg(headMs))).toFixed(1)}x ${avg(headMs) < avg(getMs) ? "faster" : "NOT faster"}`);
  console.log(headWorks && headHasLen && avg(headMs) < avg(getMs) * 0.6
    ? "VERDICT: size-verified skip is worth building — HEAD is cheap and gives us the size."
    : "VERDICT: HEAD does not buy enough — a size-verified skip would not meaningfully speed things up.");
}

async function status() {
  await initSchema();
  const r = await statusReport();
  console.log("Cases:", r.cases);
  console.log("Docs :", r.docs.map((d: any) => ({ ...d, gb: (Number(d.bytes) / 1e9).toFixed(2) })));
}

// Breakdown of stored documents by file extension (what kinds of docs the archive contains).
async function docTypes() {
  await initSchema();
  const r = await db().query(`
    SELECT lower(coalesce(nullif(regexp_replace(file_name, '^.*\\.', ''), file_name), '(none)')) AS ext,
           count(*)::int AS files,
           count(DISTINCT sha256)::int AS unique_files,
           coalesce(sum(byte_size),0)::bigint AS bytes
      FROM legacy_document WHERE status='stored'
     GROUP BY 1 ORDER BY files DESC LIMIT 40`);
  console.log("Stored documents by extension:");
  console.table(
    r.rows.map((x: any) => ({
      ext: x.ext,
      files: Number(x.files).toLocaleString(),
      unique: Number(x.unique_files).toLocaleString(),
      gb: (Number(x.bytes) / 1e9).toFixed(2),
    }))
  );
}

(async () => {
  try {
    if (has("--enumerate")) await enumerate();
    else if (has("--run")) await run();
    else if (has("--retry-errors")) await retryErrors();
    else if (has("--report-failures")) await reportFailures();
    else if (has("--reconcile")) console.log("Reconciled:", await reconcileCases());
    else if (has("--probe-head")) await probeHead();
    else if (has("--status")) await status();
    else if (has("--doc-types")) await docTypes();
    else
      console.log(
        "Usage: --enumerate (--from-csv <f> | --from-atlas) | --run | --retry-errors | --report-failures [--out f.csv] | --reconcile | --status | --doc-types"
      );
  } catch (e: any) {
    const msg = e?.message || String(e);
    if (e instanceof CacheIntegrityError) {
      console.error("\n" + "!".repeat(100));
      console.error("*** RUN HALTED: FILE-ID CACHE INTEGRITY FAILURE — POSSIBLE MISFILED DOCUMENTS ***");
      console.error("!".repeat(100));
      console.error(msg);
      console.error("\nDo NOT trust cached rows until this is understood. Re-run with AUDIT_CACHE_RATE=1 to");
      console.error("verify every cache hit, or AUDIT_CACHE_RATE=0 plus a cache-disabled build to re-fetch.\n");
      process.exitCode = 2;
      return;
    }
    if (/relation .* does not exist|does not exist/i.test(msg)) {
      console.error("\n*** LEDGER TABLES MISSING — the ledger database was reset/dropped underneath the run. ***");
      console.error("*** Cause: MIGRATION_DATABASE_URL points at a DB that a backup/restore reverts (e.g. the app DB). ***");
      console.error("*** Fix: point MIGRATION_DATABASE_URL at a DEDICATED Neon project (nothing else touches it), then re-run. ***\n");
    }
    console.error("FAILED:", msg);
    process.exitCode = 1;
  } finally {
    await db().end().catch(() => {});
  }
})();
