// Import-intake mapping profile: generic OCR result -> matter-creation fields.
//
//   const mapped = mapBillToIntakeFields(ocrResult);
//
// Strategy (format-agnostic, best-effort, operator VERIFIES everything):
//   1. Prefer a labeled key/value whose label matches a field synonym (synonym priority order),
//      while REJECTING labels that name a confusable sibling (referring vs billing provider, our
//      file/court index vs carrier claim number, DOB vs date of loss, etc.).
//   2. Dates are normalized to MM/DD/YYYY; amounts parsed to numbers. Loss/service dates that are in
//      the future, or equal to a captured date of birth, are dropped.
//   3. Identifier fields (claim/policy #) must actually look like an ID (has a digit, not a date/amount).
//   4. Person names are trimmed off any trailing address.
// Selection marks (:selected:/:unselected:) are never used as values. `caseType` is NOT mapped —
// the operator always picks it.

import type { OcrExtractionResult } from "@/lib/ocr/types";
import type { IntakeMappingResult, MappedField } from "@/lib/ocr/mapping/types";
import { emptyField } from "@/lib/ocr/mapping/types";
import { FIELD_SYNONYMS } from "@/lib/ocr/mapping/synonyms";
import {
  cleanPersonName,
  cleanValue,
  isPlausiblePastDate,
  labelMatchesAny,
  labelMatchesWithExcludes,
  looksLikeIdentifier,
  normalizeDate,
  parseAmount,
} from "@/lib/ocr/mapping/normalize";

const SELECTION_MARK = /:(?:un)?selected:/i;
const FALLBACK_CONF = 0.3;
const DOLLAR_RE = /\$\s?\d[\d,]*(?:\.\d{2})?/g;

// Labels that name a CONFUSABLE sibling of a field — matching one of these disqualifies the kv from
// that field even if it also matches a synonym. This is what keeps patient≠insured, billing≠referring
// provider, carrier≠employer, and carrier-claim-# ≠ our-file-#/court-index-#/policy-#.
const EXCLUDES: Record<string, string[]> = {
  // Patient's name must not come from the insured/subscriber/guarantor slot (Box 4/etc.), nor the
  // "Patient Acct #"/"Patient Account #" field (an id, not a name).
  patientName: ["insured", "subscriber", "guarantor", "policyholder", "responsible party", "acct", "account"],
  // Billing/rendering provider — not the REFERRING provider (Box 17), not "Provider Type" (a category
  // like POD), and not NPI/payor/adjuster/tax rows that also contain the word "provider".
  providerName: ["referring", "referred by", "ordering", "primary care", "type", "npi", "payor", "adjuster", "tax"],
  // Carrier/insurer — not the employer (WC) and not the patient's own relationship-to-insured note.
  insurerName: ["employer", "relationship to insured"],
  // Carrier CLAIM number — not OUR internal file #, the court index #, an invoice #, or the provider's
  // TIN/NPI. (We only exclude the possessive "our/your file" — a bare carrier "File No." IS the claim.)
  claimNumber: ["our file", "your file", "index no", "index number", "invoice", "npi", "tax id", "federal tax"],
  // Policy/member number — not the claim #, TIN/NPI, our file #, or court index #.
  policyNumber: ["claim", "tax id", "federal tax", "npi", "our file", "your file", "index no", "index number"],
  // Date of loss/accident — not DOB, statement/print/signature/bill date.
  dateOfLoss: ["birth", "dob", "statement", "printed", "print date", "signature", "signed", "bill date", "date of bill", "today"],
};

// Labels that identify a date of birth — captured so it can be excluded from loss/service dates.
const DOB_LABELS = ["date of birth", "birth date", "dob", "d.o.b", "patient's birth date"];

function isUsableValue(v: string): boolean {
  const t = v.trim();
  return t.length > 0 && !SELECTION_MARK.test(t);
}

type KvHit = { value: string; confidence: number | null; key: string };

/**
 * First key/value whose label matches a synonym (synonyms in priority order) and does NOT match any
 * exclude phrase, with a usable value.
 */
function findKv(result: OcrExtractionResult, synonyms: string[], excludes: string[] = []): KvHit | null {
  for (const syn of synonyms) {
    for (const kv of result.keyValues) {
      if (!isUsableValue(kv.value)) continue;
      if (labelMatchesWithExcludes(kv.key, [syn], excludes)) {
        return { value: kv.value, confidence: kv.confidence, key: kv.key };
      }
    }
  }
  return null;
}

/** A plain labeled string field (with optional sibling-exclusions). */
function stringField(
  result: OcrExtractionResult,
  synonyms: string[],
  excludes: string[] = [],
): MappedField<string> {
  const hit = findKv(result, synonyms, excludes);
  if (!hit) return emptyField<string>();
  return {
    value: cleanValue(hit.value),
    confidence: hit.confidence,
    source: `kv:"${hit.key}"`,
    rawText: hit.value,
  };
}

/** An identifier field (claim/policy #) — only accepts values that actually look like an ID. */
function idField(
  result: OcrExtractionResult,
  synonyms: string[],
  excludes: string[],
): MappedField<string> {
  for (const syn of synonyms) {
    for (const kv of result.keyValues) {
      if (!isUsableValue(kv.value)) continue;
      if (!labelMatchesWithExcludes(kv.key, [syn], excludes)) continue;
      const v = cleanIdValue(cleanValue(kv.value));
      if (!looksLikeIdentifier(v)) continue; // skip names, dates, dollar amounts in the ID slot
      return { value: v, confidence: kv.confidence, source: `kv:"${kv.key}"`, rawText: kv.value };
    }
  }
  return emptyField<string>();
}

/** Find the patient's date of birth (used only to EXCLUDE it from loss/service dates). */
function findDob(result: OcrExtractionResult): string | null {
  for (const kv of result.keyValues) {
    if (!isUsableValue(kv.value)) continue;
    if (labelMatchesAny(kv.key, DOB_LABELS)) {
      const n = normalizeDate(kv.value);
      if (n) return n;
    }
  }
  return null;
}

function dateFieldKvOnly(
  result: OcrExtractionResult,
  synonyms: string[],
  excludes: string[],
  disallow: Set<string>,
): MappedField<string> {
  for (const syn of synonyms) {
    for (const kv of result.keyValues) {
      if (!isUsableValue(kv.value)) continue;
      if (!labelMatchesWithExcludes(kv.key, [syn], excludes)) continue;
      const norm = normalizeDate(kv.value);
      if (!norm) continue;
      if (disallow.has(norm)) continue; // e.g. the DOB
      if (!isPlausiblePastDate(norm)) continue; // no future dates for a loss/service date
      return { value: norm, confidence: kv.confidence, source: `kv:"${kv.key}"`, rawText: kv.value };
    }
  }
  return emptyField<string>();
}

/** Parseable, plausibly-past table dates (service grid), de-duped, excluding disallowed values. */
function collectTableDates(result: OcrExtractionResult, disallow: Set<string>): string[] {
  const seen = new Set<string>();
  for (const t of result.tables) {
    for (const c of t.cells) {
      const norm = normalizeDate(c.content);
      if (!norm) continue;
      if (disallow.has(norm)) continue;
      if (!isPlausiblePastDate(norm)) continue;
      seen.add(norm);
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
  // Text amounts, skipping any dollar figure sitting next to policy-limit / coverage wording so the
  // "largest amount" fallback doesn't grab the coverage limit (e.g. $25,000) instead of the charge.
  const text = result.text;
  let m: RegExpExecArray | null;
  const re = new RegExp(DOLLAR_RE.source, "g");
  while ((m = re.exec(text)) !== null) {
    const ctx = text.slice(Math.max(0, m.index - 30), m.index + m[0].length + 15).toLowerCase();
    if (/(limit|coverage|maximum|policy limit|per person|per accident)/.test(ctx)) continue;
    const n = parseAmount(m[0]);
    if (n != null) out.push({ value: n, source: "regex:text", raw: m[0] });
  }
  return out;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Text fallback for identifiers (claim #) when key/value pairing fails — common on carrier EORs /
 * denials whose two-column "Claim Number : 0507…" layout confuses the kv extractor even though the
 * text is clean. Scans raw text for a label followed by an ID-shaped token.
 */
function scanLabeledIdentifier(text: string, labels: string[]): string | null {
  for (const label of labels) {
    const re = new RegExp(`${escapeRe(label)}\\s*[:#.]*\\s*([a-z0-9][a-z0-9-]{3,29})`, "i");
    const m = text.match(re);
    if (m && looksLikeIdentifier(m[1])) return m[1];
  }
  return null;
}

/** Text fallback for a labeled name (carrier), cut before any PO-box / street-address continuation. */
function scanLabeledText(text: string, labels: string[]): string | null {
  for (const label of labels) {
    const re = new RegExp(`${escapeRe(label)}\\s*[:#]?\\s*([^\\n]{2,60})`, "i");
    const m = text.match(re);
    if (!m) continue;
    let v = m[1].split(/\s+(?:p\.?\s*o\.?\s*box|po box)\b/i)[0];
    v = v.replace(/\s+\d{1,6}\s+[A-Za-z].*$/, ""); // drop "1234 Main St …"
    v = v.replace(/[.,;:]+$/, "").trim();
    if (v.length >= 2 && /[a-z]/i.test(v) && !normalizeDate(v)) return v;
  }
  return null;
}

/**
 * Clean a carrier/insurer value: drop the value entirely if it's really a form-label continuation
 * ("...OR SELF-INSURER", "claim processor (Third Party Administrator)") or boilerplate sentence, and
 * trim any trailing PO-box / street address so we keep just the carrier name. Returns null if nothing
 * usable remains.
 */
function cleanInsurerName(input: string): string | null {
  let s = input.replace(/\s+/g, " ").trim();
  if (!s) return null;
  // Form-label continuations / administrator rows — not a carrier name.
  if (/^or\s+self|self-?insurer|claim processor|third party administrat/i.test(s)) return null;
  // Boilerplate sentence fragments captured as a value.
  if (/\b(please|opposed|assist|hereby|pursuant|enclosed|demand|retained)\b/i.test(s)) return null;
  // Trim address tails.
  s = s.split(/\s+(?:p\.?\s*o\.?\s*box|po box)\b/i)[0];
  s = s.replace(/\s+\d{1,6}\s+[A-Za-z].*$/, ""); // "1234 Main St …"
  s = s.replace(/[.,;:]+$/, "").trim();
  if (s.length < 2 || !/[a-z]/i.test(s) || normalizeDate(s)) return null;
  return s;
}

/** Strip a trailing person-name/word OCR appended to an id ("00019805 CALCANES RYAN" -> "00019805",
 * "250392126 Dr" -> "250392126"). Only strips when the leading token carries the digits. */
function cleanIdValue(v: string): string {
  const m = v.match(/^(\S*\d\S*)\s+[A-Za-z].*$/);
  return m ? m[1] : v;
}

export function mapBillToIntakeFields(result: OcrExtractionResult): IntakeMappingResult {
  // Person / entity names — patient trimmed off any trailing address; siblings excluded.
  const patientHit = findKv(result, FIELD_SYNONYMS.patientName, EXCLUDES.patientName);
  const patientName: MappedField<string> = patientHit
    ? {
        value: cleanPersonName(patientHit.value),
        confidence: patientHit.confidence,
        source: `kv:"${patientHit.key}"`,
        rawText: patientHit.value,
      }
    : emptyField<string>();
  const providerName = stringField(result, FIELD_SYNONYMS.providerName, EXCLUDES.providerName);

  // Carrier/insurer — reject a date/PO-box the kv pairing grabbed, then fall back to a text scan of
  // the "Carrier:" / "Insurance Plan Name" line (cut before the address).
  let insurerName = stringField(result, FIELD_SYNONYMS.insurerName, EXCLUDES.insurerName);
  if (insurerName.value) {
    const cleaned = cleanInsurerName(insurerName.value);
    insurerName = cleaned ? { ...insurerName, value: cleaned } : emptyField<string>();
  }
  if (!insurerName.value) {
    const scanned = scanLabeledText(result.text, [
      "carrier", "insurance plan name or program name", "name of insurer", "name and address of insurer",
    ]);
    const cleaned = scanned ? cleanInsurerName(scanned) : null;
    if (cleaned) insurerName = { value: cleaned, confidence: 0.4, source: "text-scan", rawText: scanned! };
  }

  // Identifiers — must look like an ID (has a digit, not a name/date/amount) and not name a sibling.
  // Claim # gets a text-scan fallback for carrier EORs/denials where kv pairing mis-aligns.
  let claimNumber = idField(result, FIELD_SYNONYMS.claimNumber, EXCLUDES.claimNumber);
  if (!claimNumber.value) {
    const scanned = scanLabeledIdentifier(result.text, ["claim number", "claim no", "claim #", "claim id"]);
    if (scanned) claimNumber = { value: scanned, confidence: 0.4, source: "text-scan", rawText: scanned };
  }
  const policyNumber = idField(result, FIELD_SYNONYMS.policyNumber, EXCLUDES.policyNumber);

  // Capture DOB to keep it out of the loss/service dates.
  const dob = findDob(result);
  const disallowDates = new Set<string>(dob ? [dob] : []);

  // Date of loss — key/value only, no DOB, no future date.
  const dateOfLoss = dateFieldKvOnly(result, FIELD_SYNONYMS.dateOfLoss, EXCLUDES.dateOfLoss, disallowDates);

  // DOS start/end — key/value first, else min/max of service-table dates (lower confidence).
  const dosDisallow = new Set<string>(disallowDates);
  if (dateOfLoss.value) dosDisallow.add(dateOfLoss.value); // don't reuse the DOL as a DOS
  let dosStart = dateFieldKvOnly(result, FIELD_SYNONYMS.dosStart, [], dosDisallow);
  let dosEnd = dateFieldKvOnly(result, FIELD_SYNONYMS.dosEnd, [], dosDisallow);
  if (!dosStart.value || !dosEnd.value) {
    const tableDates = collectTableDates(result, dosDisallow).sort((a, b) => toEpoch(a) - toEpoch(b));
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
