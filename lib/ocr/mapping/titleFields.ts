// OCR → title-field prefill (Phase 4). Given a chosen folder+title, pre-fill THAT title's prompt
// fields (date/amounts/outcome/category/description) from the OCR result — distinct from the
// import-intake matter-field profile. Best-effort + confidence; operator verifies (never auto-files).

import type { OcrExtractionResult } from "@/lib/ocr/types";
import { findTitle, type TitlePromptField } from "@/lib/documents/folderTaxonomy";
import {
  cleanValue,
  labelMatchesAny,
  normalizeDate,
  parseAmount,
} from "@/lib/ocr/mapping/normalize";

export type PrefilledField = { value: string; confidence: number | null; source: string | null };
export type TitleFieldPrefill = Record<string, PrefilledField>;

const SELECTION_MARK = /:(?:un)?selected:/i;
const FALLBACK_CONF = 0.3;

function usable(v: string): boolean {
  const t = v.trim();
  return t.length > 0 && !SELECTION_MARK.test(t);
}

// Extra label synonyms per prompt-field key (beyond the field's own label + key words).
const EXTRA_SYNONYMS: Record<string, string[]> = {
  principal: ["principal"],
  interest: ["interest"],
  attorneys_fees: ["attorney", "attorneys fees", "attorney fee", "legal fee"],
  costs: ["costs", "court costs", "disbursements"],
  outcome: ["outcome", "result", "disposition", "decision"],
  description: ["description", "re", "subject", "regarding"],
  category: ["category", "type", "payment type"],
  amount_primary: ["amount", "payment amount"],
  amount_secondary: ["amount", "interest", "filing"],
};

function fieldSynonyms(field: TitlePromptField): string[] {
  return [field.label, field.key.replace(/_/g, " "), ...(EXTRA_SYNONYMS[field.key] ?? [])];
}

function firstDateInText(text: string): string | null {
  const m = text.match(/\b\d{1,2}[-/\s]\d{1,2}[-/\s]\d{2,4}\b|\b\d{4}[-/]\d{1,2}[-/]\d{1,2}\b/);
  return m ? normalizeDate(m[0]) : null;
}

function matchOption(text: string, options: string[]): string | null {
  const lc = text.toLowerCase();
  for (const o of options) if (lc.includes(o.toLowerCase())) return o;
  // Outcome-style loose matching.
  if (options.includes("Partial Win") && /partial/.test(lc)) return "Partial Win";
  if (options.includes("Win") && /(in favor|granted|award(ed)? to (the )?(applicant|plaintiff))/.test(lc)) return "Win";
  if (options.includes("Loss") && /(denied|dismiss|loss|in favor of respondent)/.test(lc)) return "Loss";
  return null;
}

function valueByType(field: TitlePromptField, raw: string, result: OcrExtractionResult): string | null {
  switch (field.type) {
    case "date":
      return normalizeDate(raw);
    case "money": {
      const a = parseAmount(raw);
      return a == null ? null : String(a);
    }
    case "select":
      return matchOption(raw, field.options ?? []) ?? matchOption(result.text, field.options ?? []);
    default:
      return cleanValue(raw) || null;
  }
}

function typeFallback(field: TitlePromptField, result: OcrExtractionResult): PrefilledField {
  if (field.type === "date") {
    const d = firstDateInText(result.text);
    if (d) return { value: d, confidence: FALLBACK_CONF, source: "regex:text" };
  }
  if (field.type === "select") {
    const o = matchOption(result.text, field.options ?? []);
    if (o) return { value: o, confidence: FALLBACK_CONF, source: "keyword:text" };
  }
  // No money/text fallback — avoid mislabeling (e.g. principal vs interest).
  return { value: "", confidence: null, source: null };
}

function extractForField(result: OcrExtractionResult, field: TitlePromptField): PrefilledField {
  const syns = fieldSynonyms(field);
  for (const kv of result.keyValues) {
    if (!usable(kv.value)) continue;
    if (!labelMatchesAny(kv.key, syns)) continue;
    const v = valueByType(field, kv.value, result);
    if (v != null) return { value: v, confidence: kv.confidence, source: `kv:"${kv.key}"` };
  }
  return typeFallback(field, result);
}

/** Pre-fill every prompt field of the given title from the OCR result. */
export function mapOcrToTitleFields(
  result: OcrExtractionResult,
  folderKey: string,
  titleKey: string,
): TitleFieldPrefill {
  const title = findTitle(folderKey, titleKey);
  const out: TitleFieldPrefill = {};
  for (const p of title?.prompts ?? []) {
    out[p.key] = extractForField(result, p);
  }
  return out;
}
