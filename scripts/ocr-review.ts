// OCR REVIEW — Stage 2 (run ANYWHERE; no Azure, no original forms needed).
//
//   npx tsx scripts/ocr-review.ts
//
// Reads every cached extraction under ocr-samples/cache/, runs the intake mapping profile on each,
// and writes ocr-samples/review.md: per-file mapped fields + confidence + source + the captured
// key/value LABELS (so synonym gaps are obvious), plus a field-by-field hit-rate summary across all
// samples. Re-run freely while tuning lib/ocr/mapping/synonyms.ts — it never calls Azure.

import fs from "fs";
import path from "path";
import type { OcrExtractionResult } from "@/lib/ocr/types";
import type { IntakeMappingResult } from "@/lib/ocr/mapping/types";

const SAMPLES_DIR = path.join(process.cwd(), "ocr-samples");
const CACHE_DIR = path.join(SAMPLES_DIR, "cache");

type CacheRecord = {
  fileName: string;
  fileHash: string;
  byteSize: number;
  mode: string;
  seededAt: string;
  result: OcrExtractionResult;
};

function fmtConf(c: number | null): string {
  return c == null ? "n/a" : c.toFixed(2);
}

function flag(value: unknown, conf: number | null): string {
  if (value == null || value === "") return "❌ missing";
  if (conf != null && conf < 0.5) return "⚠️ low";
  return "✅";
}

async function main() {
  if (!fs.existsSync(CACHE_DIR)) {
    console.error(`No cache at ${CACHE_DIR}. Seed first: npx tsx scripts/ocr-seed.ts`);
    process.exit(1);
  }
  const cacheFiles = fs.readdirSync(CACHE_DIR).filter((f) => f.endsWith(".json")).sort();
  if (cacheFiles.length === 0) {
    console.error("Cache is empty. Seed first: npx tsx scripts/ocr-seed.ts");
    process.exit(1);
  }

  const { mapBillToIntakeFields, INTAKE_FIELD_KEYS } = await import("@/lib/ocr/mapping");

  const lines: string[] = [];
  lines.push(`# OCR Mapping Review`);
  lines.push(``);
  lines.push(`Generated ${new Date().toISOString()} from ${cacheFiles.length} cached sample(s).`);
  lines.push(`Mapping = \`lib/ocr/mapping\`. Operator verifies everything; case type is operator-picked.`);
  lines.push(``);

  const hits: Record<string, number> = {};
  const lowConf: Record<string, number> = {};
  for (const k of INTAKE_FIELD_KEYS) {
    hits[k] = 0;
    lowConf[k] = 0;
  }

  for (const cf of cacheFiles) {
    const rec = JSON.parse(fs.readFileSync(path.join(CACHE_DIR, cf), "utf8")) as CacheRecord;
    const mapped = mapBillToIntakeFields(rec.result) as IntakeMappingResult;

    lines.push(`## ${rec.fileName}`);
    lines.push(
      `\`${rec.mode}\` · ${rec.result.pageCount}p · meanConf ${fmtConf(rec.result.meanConfidence)} · ` +
        `${rec.result.keyValues.length} kv · ${rec.result.tables.length} tables · hash \`${rec.fileHash.slice(0, 12)}\``,
    );
    lines.push(``);
    lines.push(`| Field | Value | Conf | Source | |`);
    lines.push(`|---|---|---|---|---|`);
    for (const key of INTAKE_FIELD_KEYS) {
      const mf = mapped[key];
      const val = mf.value == null ? "—" : String(mf.value).replace(/\|/g, "\\|").slice(0, 60);
      if (mf.value != null && mf.value !== "") hits[key]++;
      if (mf.confidence != null && mf.confidence < 0.5 && mf.value != null) lowConf[key]++;
      lines.push(
        `| ${key} | ${val} | ${fmtConf(mf.confidence)} | ${(mf.source ?? "-").replace(/\|/g, "\\|")} | ${flag(mf.value, mf.confidence)} |`,
      );
    }
    lines.push(``);
    // Captured labels — the raw kv keys, so we can spot which labels a format uses (synonym tuning).
    const labels = rec.result.keyValues
      .filter((kv) => kv.value && !/:(?:un)?selected:/i.test(kv.value))
      .map((kv) => kv.key.replace(/\s+/g, " ").trim())
      .filter((k) => k.length > 0);
    lines.push(`<details><summary>Captured labels (${labels.length})</summary>`);
    lines.push(``);
    lines.push(labels.map((l) => `- \`${l}\``).join("\n"));
    lines.push(``);
    lines.push(`</details>`);
    lines.push(``);
  }

  // Summary hit-rate table
  lines.push(`## Summary — field hit rate across ${cacheFiles.length} sample(s)`);
  lines.push(``);
  lines.push(`| Field | Found | Low-conf | Hit rate |`);
  lines.push(`|---|---|---|---|`);
  for (const k of INTAKE_FIELD_KEYS) {
    const rate = ((hits[k] / cacheFiles.length) * 100).toFixed(0);
    lines.push(`| ${k} | ${hits[k]}/${cacheFiles.length} | ${lowConf[k]} | ${rate}% |`);
  }
  lines.push(``);

  const out = path.join(SAMPLES_DIR, "review.md");
  fs.writeFileSync(out, lines.join("\n"));
  console.log(`Wrote ${out} from ${cacheFiles.length} sample(s).`);
  console.log(`Field hit rates:`);
  for (const k of INTAKE_FIELD_KEYS) {
    console.log(`   ${k.padEnd(13)} ${hits[k]}/${cacheFiles.length}`);
  }
}

main().catch((err) => {
  console.error("Review failed:", err);
  process.exit(1);
});
