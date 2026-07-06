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

  // Month-name dates: "16 May 2025", "16-May-2025", "May 16, 2025".
  const MONTHS: Record<string, number> = {
    jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
  };
  const dMonY = cleaned.match(/\b(\d{1,2})[-\s]([A-Za-z]{3,9})[-\s,]+(\d{4})\b/);
  if (dMonY) {
    const mo = MONTHS[dMonY[2].slice(0, 3).toLowerCase()];
    if (mo) return fmt(String(mo), dMonY[1], dMonY[3]);
  }
  const monDY = cleaned.match(/\b([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})\b/);
  if (monDY) {
    const mo = MONTHS[monDY[1].slice(0, 3).toLowerCase()];
    if (mo) return fmt(String(mo), monDY[2], monDY[3]);
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

/**
 * True if the label matches any synonym but NONE of the exclude phrases. Lets a field claim
 * "provider" while rejecting "referring provider", or "claim number" while rejecting "our file".
 */
export function labelMatchesWithExcludes(label: string, synonyms: string[], excludes: string[]): boolean {
  if (!labelMatchesAny(label, synonyms)) return false;
  if (excludes.length && labelMatchesAny(label, excludes)) return false;
  return true;
}

/**
 * Clean a person's name off an OCR value that often trails into the address. Names never contain
 * digits, so truncate at the first digit ("SINGLETON ALNIESHA 1C JAMESTOWN" -> "SINGLETON ALNIESHA"),
 * then drop stray trailing punctuation.
 */
export function cleanPersonName(input: string): string {
  let v = input.replace(/\s+/g, " ").trim();
  const firstDigit = v.search(/\d/);
  if (firstDigit > 0) v = v.slice(0, firstDigit);
  v = v.replace(/[[\].,;:\s]+$/, "").trim(); // trailing brackets/punct ("EMMANUEL[" -> "EMMANUEL")
  // OCR often duplicates a name across two columns ("STEFANIE PERKINS STEFANIE PERKINS").
  const words = v.split(" ");
  if (words.length >= 2 && words.length % 2 === 0) {
    const half = words.length / 2;
    if (words.slice(0, half).join(" ").toLowerCase() === words.slice(half).join(" ").toLowerCase()) {
      v = words.slice(0, half).join(" ");
    }
  }
  return v.trim();
}

/**
 * A value that plausibly is an identifier (claim/policy number): contains at least one digit,
 * isn't a date or a bare dollar amount, and fits ID length.
 */
export function looksLikeIdentifier(input: string): boolean {
  const v = input.trim();
  if (v.length < 3 || v.length > 40) return false;
  if (!/\d/.test(v)) return false; // must have a digit
  if (normalizeDate(v)) return false; // numeric date, not an ID
  if (/^\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d{2,4}$/i.test(v)) return false; // "21 Feb 2025"
  // Money — only reject things that actually look like currency: a $ sign, or decimal cents. A pure
  // digit string (0507279790101029, 74237694) is a CLAIM/POLICY number, NOT money.
  if (/^\$/.test(v)) return false;
  if (/^\d{1,3}(?:,\d{3})*\.\d{2}$/.test(v)) return false; // 1,234.56
  if (/^\d+\.\d{2}$/.test(v)) return false; // 356.94
  return true;
}

/** Epoch ms for an MM/DD/YYYY string (local). */
export function mdyToEpoch(mdY: string): number {
  const [m, d, y] = mdY.split("/").map((n) => parseInt(n, 10));
  return new Date(y, m - 1, d).getTime();
}

/** A loss/service date must not be in the future (small clock-skew grace). */
export function isPlausiblePastDate(mdY: string, graceDays = 1): boolean {
  const t = mdyToEpoch(mdY);
  if (!Number.isFinite(t)) return false;
  return t <= Date.now() + graceDays * 86400000;
}
