// Orchestrator for the Atlas→Azure migration. Resumable + idempotent; safe to Ctrl-C and re-run.
//
//   npx tsx scripts/atlas-migration/extract.ts --enumerate --from-csv cases.csv   # stage 1: seed case list
//   npx tsx scripts/atlas-migration/extract.ts --enumerate --from-atlas           # stage 1: via Atlas search
//   npx tsx scripts/atlas-migration/extract.ts --run                              # stages 2-5
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
  statusReport,
  db,
} from "./ledger";
import { sha256, blobKeyFor, uploadBlob } from "./azureStore";

const args = process.argv.slice(2);
const has = (f: string) => args.includes(f);
const val = (f: string) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : undefined; };

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

async function processCase(caseId: string) {
  try {
    // Stage 2: list files (idempotent).
    const tree = await getCaseDocumentTree(caseId);
    const leaves = flattenFileLeaves(tree);
    await upsertDocuments(caseId, leaves);
    await setCase(caseId, { status: "listed", file_count: leaves.length });

    // Stages 3-5: download → hash → dedup → upload → manifest.
    const pending = await pendingDocsForCase(caseId);
    let done = 0;
    await pool(pending, config.run.fileConcurrency, async (doc) => {
      try {
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
        done++;
      } catch (e: any) {
        await markDocError(doc.id, e?.message || String(e));
      }
    });

    const total = await pendingDocsForCase(caseId);
    await setCase(caseId, { status: total.length === 0 ? "done" : "error", done_count: done, error: total.length ? `${total.length} files failed` : null });
    console.log(`  ${caseId}: ${leaves.length} files, ${done} stored, ${total.length} failed`);
  } catch (e: any) {
    await setCase(caseId, { status: "error", error: e?.message || String(e) });
    console.log(`  ${caseId}: CASE ERROR — ${e?.message || e}`);
  }
}

async function run() {
  await initSchema();
  const batchSize = config.run.limitCases || 10_000;
  let processed = 0;
  for (;;) {
    const remaining = config.run.limitCases ? config.run.limitCases - processed : batchSize;
    if (remaining <= 0) break;
    const cases = await nextCases(Math.min(remaining, 500), config.run.newestFirst);
    if (!cases.length) break;
    await pool(cases, config.run.caseConcurrency, processCase);
    processed += cases.length;
    if (config.run.limitCases && processed >= config.run.limitCases) break;
  }
  console.log(`Run complete. Processed ${processed} cases this pass.${config.run.dryRun ? " (DRY RUN — no uploads)" : ""}`);
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
    else if (has("--status")) await status();
    else console.log("Usage: --enumerate (--from-csv <f> | --from-atlas) | --run | --status");
  } catch (e: any) {
    console.error("FAILED:", e?.message || e);
    process.exitCode = 1;
  } finally {
    await db().end().catch(() => {});
  }
})();
