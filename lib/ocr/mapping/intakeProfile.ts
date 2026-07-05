// Import-intake mapping profile: generic OCR result -> matter-creation fields.
//
//   const mapped = mapBillToIntakeFields(ocrResult);
//
// Strategy (format-agnostic, best-effort, operator VERIFIES everything):
//   1. Prefer a labeled key/value whose label matches a field synonym (synonym priority order).
//   2. Dates are normalized to MM/DD/YYYY; amounts parsed to numbers.
//   3. Fallbacks (lower confidence): DOS from date cells in the service table; claim amount from the
//      largest dollar value across tables/text (heuristic total charge).
// Selection marks (:selected:/:unselected:) are never used as values. `caseType` is NOT mapped —
// the operator always picks it.

import type { OcrExtractionResult } from "@/lib/ocr/types";
import type { IntakeMappingResult, MappedField } from "@/lib/ocr/mapping/types";
import { emptyField } from "@/lib/ocr/mapping/types";
import { FIELD_SYNONYMS } from "@/lib/ocr/mapping/synonyms";
import {
  cleanValue,
  labelMatchesAny,
  normalizeDate,
  parseAmount,
} from "@/lib/ocr/mapping/normalize";

const SELECTION_MARK = /:(?:un)?selected:/i;
const FALLBACK_CONF = 0.3;
const DOLLAR_RE = /\$\s?\d[\d,]*(?:\.\d{2})?/g;

function isUsableValue(v: string): boolean {
  const t = v.trim();
  return t.length > 0 && !SELECTION_MARK.test(t);
}

type KvHit = { value: string; confidence: number | null; key: string };

/** First key/value whose label matches a synonym (synonyms in priority order) with a usable value. */
function findKv(result: OcrExtractionResult, synonyms: string[]): KvHit | null {
  for (const syn of synonyms) {
    for (const kv of result.keyValues) {
      if (!isUsableValue(kv.value)) continue;
      if (labelMatchesAny(kv.key, [syn])) {
        return { value: kv.value, confidence: kv.confidence, key: kv.key };
      }
    }
  }
  return null;
}

function stringField(result: OcrExtractionResult, synonyms: string[]): MappedField<string> {
  const hit = findKv(result, synonyms);
  if (!hit) return emptyField<string>();
  return {
    value: cleanValue(hit.value),
    confidence: hit.confidence,
    source: `kv:"${hit.key}"`,
    rawText: hit.value,
  };
}

function dateFieldKvOnly(result: OcrExtractionResult, synonyms: string[]): MappedField<string> {
  const hit = findKv(result, synonyms);
  if (hit) {
    const norm = normalizeDate(hit.value);
    if (norm) {
      return { value: norm, confidence: hit.confidence, source: `kv:"${hit.key}"`, rawText: hit.value };
    }
  }
  return emptyField<string>();
}

/** All parseable dates found in table cells (service grid), de-duped, as MM/DD/YYYY. */
function collectTableDates(result: OcrExtractionResult): string[] {
  const seen = new Set<string>();
  for (const t of result.tables) {
    for (const c of t.cells) {
      const norm = normalizeDate(c.content);
      if (norm) seen.add(norm);
    }
  }
  return [...seen];
}

function toEpoch(mdY: string): number {
  const [m, d, y] = mdY.split("/").map((n) => parseInt(n, 10));
  return new Date(y, m - 1, d).getTime();
}

/** All dollar amounts across tables + text, with provenance. */
function collectAmounts(result: OcrExtractionResult): { value: number; source: string; raw: string }[] {
  const out: { value: number; source: string; raw: string }[] = [];
  for (const t of result.tables) {
    for (const c of t.cells) {
      const m = c.content.match(DOLLAR_RE);
      if (m) for (const s of m) {
        const n = parseAmount(s);
        if (n != null) out.push({ value: n, source: "table", raw: s });
      }
    }
  }
  const tm = result.text.match(DOLLAR_RE);
  if (tm) for (const s of tm) {
    const n = parseAmount(s);
    if (n != null) out.push({ value: n, source: "regex:text", raw: s });
  }
  return out;
}

export function mapBillToIntakeFields(result: OcrExtractionResult): IntakeMappingResult {
  // Strings
  const patientName = stringField(result, FIELD_SYNONYMS.patientName);
  const providerName = stringField(result, FIELD_SYNONYMS.providerName);
  const insurerName = stringField(result, FIELD_SYNONYMS.insurerName);
  const claimNumber = stringField(result, FIELD_SYNONYMS.claimNumber);
  const policyNumber = stringField(result, FIELD_SYNONYMS.policyNumber);

  // Date of loss — key/value only (a service-grid date would be a DOS, not the DOL).
  const dateOfLoss = dateFieldKvOnly(result, FIELD_SYNONYMS.dateOfLoss);

  // DOS start/end — key/value first, else min/max of service-table dates (lower confidence).
  let dosStart = dateFieldKvOnly(result, FIELD_SYNONYMS.dosStart);
  let dosEnd = dateFieldKvOnly(result, FIELD_SYNONYMS.dosEnd);
  if (!dosStart.value || !dosEnd.value) {
    const tableDates = collectTableDates(result)
      .filter((d) => d !== dateOfLoss.value) // don't reuse the DOL
      .sort((a, b) => toEpoch(a) - toEpoch(b));
    if (tableDates.length > 0) {
      if (!dosStart.value) {
        dosStart = { value: tableDates[0], confidence: FALLBACK_CONF, source: "table", rawText: tableDates[0] };
      }
      if (!dosEnd.value) {
        const last = tableDates[tableDates.length - 1];
        dosEnd = { value: last, confidence: FALLBACK_CONF, source: "table", rawText: last };
      }
    }
  }

  // Claim (billed) amount — key/value first, else the largest dollar value seen (heuristic total).
  let claimAmount: MappedField<number> = emptyField<number>();
  const amtHit = findKv(result, FIELD_SYNONYMS.claimAmount);
  if (amtHit) {
    const amt = parseAmount(amtHit.value);
    if (amt != null) {
      claimAmount = { value: amt, confidence: amtHit.confidence, source: `kv:"${amtHit.key}"`, rawText: amtHit.value };
    }
  }
  if (claimAmount.value == null) {
    const amounts = collectAmounts(result);
    if (amounts.length > 0) {
      const max = amounts.reduce((a, b) => (b.value > a.value ? b : a));
      claimAmount = { value: max.value, confidence: FALLBACK_CONF, source: max.source, rawText: max.raw };
    }
  }

  return {
    patientName,
    providerName,
    insurerName,
    claimNumber,
    policyNumber,
    dateOfLoss,
    dosStart,
    dosEnd,
    claimAmount,
  };
}
