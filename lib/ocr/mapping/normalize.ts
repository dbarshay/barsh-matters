// Normalization + matching helpers for the field-mapping profile. Deliberately dependency-free
// and pure so they're trivially unit-testable and reusable by any consumer/profile.

/** Lowercase, strip everything but a-z0-9 and spaces, collapse whitespace. For label matching. */
export function normalizeLabel(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** True if a normalized label contains any of the synonym phrases (also normalized). */
export function labelMatchesAny(label: string, synonyms: string[]): boolean {
  const norm = normalizeLabel(label);
  if (!norm) return false;
  return synonyms.some((syn) => {
    const s = normalizeLabel(syn);
    return s.length > 0 && (norm === s || norm.includes(s));
  });
}

/**
 * Normalize a date string to MM/DD/YYYY. Handles MM/DD/YYYY, MM-DD-YYYY, MM/DD/YY,
 * "MM DD YYYY" (OCR often drops separators), and YYYY-MM-DD. Returns null if not parseable.
 * Two-digit years map to 19xx/20xx around a 2049 pivot.
 */
export function normalizeDate(input: string): string | null {
  if (!input) return null;
  const cleaned = input.trim();

  // YYYY-MM-DD (ISO)
  const iso = cleaned.match(/\b(\d{4})[-/](\d{1,2})[-/](\d{1,2})\b/);
  if (iso) {
    const [, y, m, d] = iso;
    return fmt(m, d, y);
  }

  // MM/DD/YYYY | MM-DD-YYYY | MM DD YYYY | MM/DD/YY
  const mdy = cleaned.match(/\b(\d{1,2})[-/\s](\d{1,2})[-/\s](\d{2,4})\b/);
  if (mdy) {
    let [, m, d, y] = mdy;
    if (y.length === 2) {
      const yr = parseInt(y, 10);
      y = String(yr <= 49 ? 2000 + yr : 1900 + yr);
    }
    return fmt(m, d, y);
  }
  return null;

  function fmt(m: string, d: string, y: string): string | null {
    const mm = parseInt(m, 10);
    const dd = parseInt(d, 10);
    const yyyy = parseInt(y, 10);
    if (mm < 1 || mm > 12 || dd < 1 || dd > 31 || yyyy < 1900 || yyyy > 2100) return null;
    return `${String(mm).padStart(2, "0")}/${String(dd).padStart(2, "0")}/${yyyy}`;
  }
}

/** Parse a currency-ish string to a number. "$1,234.56" -> 1234.56. Null if no number found. */
export function parseAmount(input: string): number | null {
  if (!input) return null;
  // Grab the last number-looking token (totals usually trail the label).
  const matches = input.replace(/[, ]/g, (c) => (c === "," ? "" : c)).match(/-?\d+(?:\.\d{1,2})?/g);
  if (!matches || matches.length === 0) return null;
  const n = parseFloat(matches[matches.length - 1]);
  return Number.isFinite(n) ? n : null;
}

/** Light cleanup for a name/string value: trim, collapse spaces, strip trailing punctuation. */
export function cleanValue(input: string): string {
  return input.replace(/\s+/g, " ").trim().replace(/[.,;:]+$/, "").trim();
}
