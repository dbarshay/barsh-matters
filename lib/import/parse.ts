// Shared parsing helpers for spreadsheet imports (Carisk / Dow). Pure — no DB, no side effects.

/** Parse a money value to a number rounded to cents, or null if blank/invalid. */
export function parseMoney(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const n = Number(s.replace(/[^0-9.\-]/g, ""));
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100) / 100;
}

/** Parse a US date token "M/D/YYYY" (or an ISO-ish string) to a Date, or null. */
export function parseUsDate(raw: unknown): Date | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) {
    const d = new Date(Number(m[3]), Number(m[1]) - 1, Number(m[2]));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Normalize a datetime-ish value to a date-only `YYYY-MM-DD` string (empty if unparseable). */
export function toDateOnly(raw: unknown): string {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  // Already ISO-ish "YYYY-MM-DD..." -> take the date part.
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const d = parseUsDate(s);
  if (!d) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export type DosSpan = { start: string; end: string; distinctCount: number };

/**
 * Parse a Date(s) of Service value that may be a single date OR a semicolon/comma-separated list
 * (often the same date repeated once per service line). Returns the earliest/latest as the span
 * (repeats collapsed). `start`/`end` are the original token strings for the min/max dates.
 */
export function parseDosSpan(raw: unknown): DosSpan {
  const tokens = String(raw ?? "")
    .split(/[;,]/)
    .map((t) => t.trim())
    .filter(Boolean);
  const parsed = tokens
    .map((t) => ({ t, d: parseUsDate(t) }))
    .filter((x): x is { t: string; d: Date } => x.d !== null);
  if (parsed.length === 0) return { start: "", end: "", distinctCount: 0 };
  parsed.sort((a, b) => a.d.getTime() - b.d.getTime());
  const distinct = new Set(parsed.map((p) => p.t));
  return { start: parsed[0].t, end: parsed[parsed.length - 1].t, distinctCount: distinct.size };
}
