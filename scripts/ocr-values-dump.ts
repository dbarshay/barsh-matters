// OCR VALUES DUMP — full-fidelity, one row per document, for eyeballing correctness.
//
//   npx tsx scripts/ocr-values-dump.ts
//   open ocr-samples/values-dump.csv        (opens in Excel/Numbers)
//
// Reads every cached extraction under ocr-samples/cache/, runs the current mapping, and writes a CSV
// with the classifier suggestion + every identity field's VALUE and its SOURCE (kv label / text-scan /
// table). Runs on the cache — no Azure, no re-OCR — so re-run freely while tuning. Contains PHI
// (values), same as review.md; keep it out of git (ocr-samples/ is already git-ignored).

import fs from "fs";
import path from "path";
import type { OcrExtractionResult } from "@/lib/ocr/types";

const CACHE_DIR = path.join(process.cwd(), "ocr-samples", "cache");
const OUT = path.join(process.cwd(), "ocr-samples", "values-dump.csv");

type CacheRecord = { fileName: string; result: OcrExtractionResult };

function csv(v: unknown): string {
  const s = v == null ? "" : String(v);
  return `"${s.replace(/"/g, '""')}"`;
}

async function main() {
  if (!fs.existsSync(CACHE_DIR)) {
    console.error(`No cache at ${CACHE_DIR}. Seed first: npx tsx scripts/ocr-seed.ts`);
    process.exit(1);
  }
  const files = fs.readdirSync(CACHE_DIR).filter((f) => f.endsWith(".json")).sort();
  if (files.length === 0) {
    console.error("Cache empty. Seed first: npx tsx scripts/ocr-seed.ts");
    process.exit(1);
  }

  const { mapBillToIntakeFields, INTAKE_FIELD_KEYS, suggestFolderTitle } = await import("@/lib/ocr/mapping");

  const header = [
    "file",
    "classifier_folder",
    "classifier_title",
    "classifier_conf",
    ...INTAKE_FIELD_KEYS.flatMap((k) => [k, `${k}__source`, `${k}__conf`]),
  ];
  const rows: string[] = [header.map(csv).join(",")];

  for (const f of files) {
    const rec = JSON.parse(fs.readFileSync(path.join(CACHE_DIR, f), "utf8")) as CacheRecord;
    const mapped: any = mapBillToIntakeFields(rec.result);
    const s = suggestFolderTitle(rec.result);
    const cells: unknown[] = [
      rec.fileName,
      s?.folderKey ?? "",
      s?.titleKey ?? "",
      s?.confidence ?? "",
    ];
    for (const k of INTAKE_FIELD_KEYS) {
      const mf = mapped[k];
      cells.push(mf?.value ?? "", mf?.source ?? "", mf?.confidence ?? "");
    }
    rows.push(cells.map(csv).join(","));
  }

  fs.writeFileSync(OUT, rows.join("\n"));
  console.log(`Wrote ${OUT} — ${files.length} rows. Open it: open ocr-samples/values-dump.csv`);
}

main().catch((e) => {
  console.error("Dump failed:", e);
  process.exit(1);
});
