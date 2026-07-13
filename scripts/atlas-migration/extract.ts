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
  errorDocs,
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
}

// Targeted retry over documents stuck in 'error'. Atlas returns HTTP 500 for two different reasons:
//   (a) TRANSIENT — it buckles under our request rate; a slow, low-concurrency refetch succeeds.
//   (b) PERMANENT — broken/cross-org file references Atlas will never serve, however many times we ask.
// Running this pass at concurrency 1-2 drains (a), so whatever still fails is the true (b) set.
//   RETRY_CONCURRENCY=2 MAX_ATTEMPTS=4 npx tsx scripts/atlas-migration/extract.ts --retry-errors
async function retryErrors() {
  await initSchema();
  const conc = num(process.env.RETRY_CONCURRENCY, 2);
  const maxAttempts = num(process.env.MAX_ATTEMPTS, 0); // 0 = retry regardless of prior attempts
  const batch = num(process.env.RETRY_BATCH, 500);
  let recovered = 0;
  let stillFailing = 0;
  for (;;) {
    const docs = await errorDocs(batch, maxAttempts);
    if (!docs.length) break;
    await pool(docs, conc, async (d) => {
      const r = await storeDoc(d, d.case_id);
      if (r !== "error") {
        recovered++;
        console.log(`  RECOVERED ${d.case_id} "${d.file_name}"${r === "cached" ? " (from cache)" : ""}`);
      } else {
        stillFailing++;
      }
    });
    console.log(`  ...pass: ${recovered} recovered, ${stillFailing} still failing`);
    if (docs.length < batch) break;
    if (maxAttempts === 0) break; // without an attempts ceiling, one sweep only (else we'd loop forever)
  }
  const rc = await reconcileCases();
  console.log(`\nRetry complete. ${recovered} recovered, ${stillFailing} still failing.`);
  console.log(`Cases reconciled: ${rc.done} now done, ${rc.stillError} still have failures.`);
  console.log(`Next: --report-failures to dump the permanent list.`);
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

async function status() {
  await initSchema();
  const r = await statusReport();
  console.log("Cases:", r.cases);
  console.log("Docs :", r.docs.map((d: any) => ({ ...d, gb: (Number(d.bytes) / 1e9).toFixed(2) })));
}

(async () => {
  try {
    if (has("--enumerate")) await enumerate();
    else if (has("--run")) await run();
    else if (has("--retry-errors")) await retryErrors();
    else if (has("--report-failures")) await reportFailures();
    else if (has("--reconcile")) console.log("Reconciled:", await reconcileCases());
    else if (has("--status")) await status();
    else
      console.log(
        "Usage: --enumerate (--from-csv <f> | --from-atlas) | --run | --retry-errors | --report-failures [--out f.csv] | --reconcile | --status"
      );
  } catch (e: any) {
    const msg = e?.message || String(e);
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
