import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { resolveCarrier, stripReferenceNoise } from "@/lib/referenceResolution";
import { normalizeReferenceText } from "@/lib/referenceData";

// LENIENT carrier resolution — used ONLY by the one-time bulk load. Order:
//   1) strict registry (canonical name or clean alias) — same resolver live imports use;
//   2) bulk-only LEGACY MAP (docs/nf-insurer-legacy-map.csv, raw -> canonical) — consulted here ONLY,
//      never written to ReferenceAlias, so regular imports stay strict and we're never blocked from
//      later promoting a value to a real alias/canonical;
//   3) otherwise RECORD RAW on the historical matter (entityId=null, displayName=cleaned raw).
// Bulk carriers are NEVER held — the whole point of the bulk load is to land every closed matter.

export type BulkCarrierResolution = {
  entityId: string | null;
  displayName: string; // canonical name when matched, else cleaned raw
  via: "name" | "alias" | "legacy-map" | "raw";
};

let legacyMapCache: Record<string, string> | null = null;

/** Load the bulk-only legacy map (raw normalized -> canonical BM display name). Missing file = {}. */
function loadLegacyMap(): Record<string, string> {
  if (legacyMapCache) return legacyMapCache;
  const map: Record<string, string> = {};
  for (const rel of ["docs/nf-insurer-legacy-map.csv"]) {
    const fp = resolve(process.cwd(), rel);
    if (!existsSync(fp)) continue;
    const text = readFileSync(fp, "utf8");
    const lines = text.split(/\r?\n/).filter(Boolean);
    if (!lines.length) continue;
    // The CSV is header-driven: current format is `nf_value,count,canonical,kind` (a `count` column sits
    // BETWEEN the raw value and the canonical). Resolve columns by NAME so an extra/reordered column can
    // never make us treat the count as the canonical name. Falls back to col0=raw, col1=canonical for a
    // bare two-column file with no header.
    const header = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
    const findIdx = (names: string[], fallback: number) => {
      const i = header.findIndex((h) => names.includes(h));
      return i >= 0 ? i : fallback;
    };
    const hasHeader = header.some((h) => ["nf_value", "raw", "source", "value", "canonical"].includes(h));
    const rawIdx = findIdx(["nf_value", "raw", "source", "value", "nf"], 0);
    const canonIdx = findIdx(["canonical", "bm_value", "canonical_name", "target"], 1);
    for (const line of lines.slice(hasHeader ? 1 : 0)) {
      const cells = splitCsvLine(line);
      const raw = cells[rawIdx];
      const canonical = cells[canonIdx];
      if (!raw || !canonical) continue;
      map[normalizeReferenceText(raw)] = canonical.trim();
    }
  }
  legacyMapCache = map;
  return map;
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { if (inQ && line[i + 1] === '"') { cur += '"'; i++; } else inQ = !inQ; }
    else if (ch === "," && !inQ) { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

export async function resolveBulkCarrier(raw: unknown): Promise<BulkCarrierResolution> {
  // 1) strict registry
  const strict = await resolveCarrier(raw);
  if (strict.status === "matched") {
    return { entityId: strict.entityId, displayName: strict.displayName, via: strict.via };
  }
  // 2) bulk-only legacy map
  const map = loadLegacyMap();
  const key = normalizeReferenceText(stripReferenceNoise(raw));
  const key2 = normalizeReferenceText(String(raw ?? ""));
  const mapped = map[key] || map[key2];
  if (mapped) {
    const viaMap = await resolveCarrier(mapped);
    if (viaMap.status === "matched") {
      return { entityId: viaMap.entityId, displayName: viaMap.displayName, via: "legacy-map" };
    }
    // legacy map points to a name that isn't (yet) a registry entity — record that canonical string raw
    return { entityId: null, displayName: mapped, via: "legacy-map" };
  }
  // 3) record raw
  const cleaned = stripReferenceNoise(raw) || String(raw ?? "").trim();
  return { entityId: null, displayName: cleaned, via: "raw" };
}

/** Test/utility hook to reset the cached legacy map (e.g. after editing the CSV). */
export function _resetBulkLegacyMapCache() { legacyMapCache = null; }
