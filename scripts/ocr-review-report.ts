// OCR REVIEW — PHI-SAFE REPORT (run ANYWHERE; no Azure, no original forms needed).
//
//   npx tsx scripts/ocr-review-report.ts
//
// Reads every cached extraction under ocr-samples/cache/ and writes ocr-samples/review-report.md — a
// report that is SAFE TO SHARE: it contains NO field values and NO table contents. Only:
//   1. field hit-rate + low-confidence summary across all samples,
//   2. the distinct KEY-LABELS the OCR captured that we did NOT map to any field (with how many docs
//      each appears in) — the raw material for adding synonyms to lib/ocr/mapping/synonyms.ts,
//   3. the folder/title classifier's suggestion distribution (+ how many docs got no suggestion).
// Re-run freely while tuning — it never calls Azure. Paste this file's contents into chat safely.

import fs from "fs";
import path from "path";
import type { OcrExtractionResult } from "@/lib/ocr/types";

const SAMPLES_DIR = path.join(process.cwd(), "ocr-samples");
const CACHE_DIR = path.join(SAMPLES_DIR, "cache");

type CacheRecord = { fileName: string; fileHash: string; mode: string; result: OcrExtractionResult };

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
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

  const { mapBillToIntakeFields, INTAKE_FIELD_KEYS, suggestFolderTitle } = await import("@/lib/ocr/mapping");
  const { FIELD_SYNONYMS } = await import("@/lib/ocr/mapping/synonyms");

  // Flat, normalized set of every known synonym across all fields (to detect "already covered" labels).
  const knownSynonyms: string[] = Object.values(FIELD_SYNONYMS as Record<string, string[]>)
    .flat()
    .map(norm)
    .filter(Boolean);
  const isCovered = (label: string): boolean => {
    const n = norm(label);
    if (!n) return true;
    return knownSynonyms.some((syn) => n.includes(syn) || syn.includes(n));
  };

  const n = cacheFiles.length;
  const hits: Record<string, number> = {};
  const lowConf: Record<string, number> = {};
  for (const k of INTAKE_FIELD_KEYS) { hits[k] = 0; lowConf[k] = 0; }

  const unmatchedLabelDocCount = new Map<string, number>(); // label -> # of docs it appears in (uncovered)
  const folderSuggest = new Map<string, number>();
  const titleSuggest = new Map<string, number>();
  let noFolderSuggestion = 0;

  for (const cf of cacheFiles) {
    const rec = JSON.parse(fs.readFileSync(path.join(CACHE_DIR, cf), "utf8")) as CacheRecord;
    const mapped: any = mapBillToIntakeFields(rec.result);
    for (const k of INTAKE_FIELD_KEYS) {
      const mf = mapped[k];
      if (mf?.value != null && mf.value !== "") hits[k]++;
      if (mf?.confidence != null && mf.confidence < 0.5 && mf?.value != null) lowConf[k]++;
    }

    // Uncovered labels (per-doc unique so counts = doc frequency).
    const seen = new Set<string>();
    for (const kv of rec.result.keyValues) {
      const label = (kv.key || "").replace(/\s+/g, " ").trim();
      if (!label || label.length < 2) continue;
      if (isCovered(label)) continue;
      const key = label.slice(0, 60);
      if (seen.has(key.toLowerCase())) continue;
      seen.add(key.toLowerCase());
      unmatchedLabelDocCount.set(key, (unmatchedLabelDocCount.get(key) ?? 0) + 1);
    }

    // Classifier suggestion distribution.
    const s = suggestFolderTitle(rec.result);
    if (s?.folderKey) {
      folderSuggest.set(s.folderKey, (folderSuggest.get(s.folderKey) ?? 0) + 1);
      const tkey = `${s.folderKey} / ${s.titleKey ?? "?"}`;
      titleSuggest.set(tkey, (titleSuggest.get(tkey) ?? 0) + 1);
    } else {
      noFolderSuggestion++;
    }
  }

  const lines: string[] = [];
  lines.push(`# OCR Review Report (PHI-safe)`);
  lines.push(``);
  lines.push(`${n} cached sample(s). No values or table contents — safe to share.`);
  lines.push(``);
  lines.push(`## 1. Identity-field hit rate`);
  lines.push(``);
  lines.push(`| Field | Found | Low-conf | Hit rate |`);
  lines.push(`|---|---|---|---|`);
  for (const k of INTAKE_FIELD_KEYS) {
    lines.push(`| ${k} | ${hits[k]}/${n} | ${lowConf[k]} | ${((hits[k] / n) * 100).toFixed(0)}% |`);
  }
  lines.push(``);

  lines.push(`## 2. Uncovered captured labels (candidates for synonyms.ts)`);
  lines.push(`Labels the OCR read that no field synonym matched, with how many docs each appears in.`);
  lines.push(``);
  lines.push(`| Label (key text only) | Docs |`);
  lines.push(`|---|---|`);
  for (const [label, count] of [...unmatchedLabelDocCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 120)) {
    lines.push(`| \`${label.replace(/\|/g, "\\|")}\` | ${count} |`);
  }
  lines.push(``);

  lines.push(`## 3. Folder/title classifier distribution`);
  lines.push(`How the classifier is currently binning these docs (no suggestion = ${noFolderSuggestion}/${n}).`);
  lines.push(``);
  lines.push(`| Suggested folder / title | Docs |`);
  lines.push(`|---|---|`);
  for (const [k, c] of [...titleSuggest.entries()].sort((a, b) => b[1] - a[1])) {
    lines.push(`| ${k} | ${c} |`);
  }
  lines.push(``);

  const out = path.join(SAMPLES_DIR, "review-report.md");
  fs.writeFileSync(out, lines.join("\n"));
  console.log(`Wrote ${out} from ${n} sample(s). This file is PHI-safe to share.`);
  console.log(`Field hit rates:`);
  for (const k of INTAKE_FIELD_KEYS) console.log(`   ${k.padEnd(13)} ${hits[k]}/${n}`);
  console.log(`No folder suggestion: ${noFolderSuggestion}/${n}`);
}

main().catch((err) => {
  console.error("Report failed:", err);
  process.exit(1);
});
