import type { TokenBaseValue } from "@/lib/documents/templateTokenResolver";

// Token syntax: {{namespace.field|modifier|modifier}}
// Supported modifiers: upper, lower, title, date:MM/DD/YYYY, date:Month D, YYYY, currency.
// Formatting modifiers bold/italic/underline are catalogued but require Word run-property
// edits, so they are accepted and ignored here (value inserted as plain text).

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function parseTemplateToken(token: string): { base: string; modifiers: string[] } {
  const inner = token.replace(/^\{\{/, "").replace(/\}\}$/, "");
  const parts = inner.split("|").map((p) => p.trim()).filter(Boolean);
  const base = (parts.shift() || "").trim();
  return { base, modifiers: parts };
}

export function extractTemplateTokens(text: string): string[] {
  const matches = text.match(/\{\{[^{}]+\}\}/g) || [];
  return Array.from(new Set(matches));
}

function titleCase(value: string): string {
  return value.replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}

function formatCurrency(raw: string | number | null): string {
  if (raw === null || raw === undefined || raw === "") return "";
  const num = Number(raw);
  if (!Number.isFinite(num)) return "";
  return num.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function parseDateParts(raw: string): { y: number; mo: number; d: number } | null {
  const s = String(raw).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return { y: Number(m[1]), mo: Number(m[2]), d: Number(m[3]) };
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return { y: Number(m[3]), mo: Number(m[1]), d: Number(m[2]) };
  const dt = new Date(s);
  if (!Number.isNaN(dt.getTime())) return { y: dt.getFullYear(), mo: dt.getMonth() + 1, d: dt.getDate() };
  return null;
}

export function formatDate(raw: string, fmt: string = "MM/DD/YYYY"): string {
  const parts = parseDateParts(raw);
  if (!parts) return String(raw).trim();
  const pad = (n: number) => String(n).padStart(2, "0");
  if (/^month/i.test(fmt)) {
    const monthName = MONTHS[parts.mo - 1] || "";
    return `${monthName} ${parts.d}, ${parts.y}`.trim();
  }
  return `${pad(parts.mo)}/${pad(parts.d)}/${parts.y}`;
}

export function formatTokenValue(entry: TokenBaseValue, modifiers: string[]): string {
  const mods = modifiers.map((m) => m.trim()).filter(Boolean);
  const raw = entry.raw;

  let str: string;
  if (entry.type === "currency") {
    str = formatCurrency(raw);
  } else if (entry.type === "date") {
    const dateMod = mods.find((m) => /^date:/i.test(m));
    str = raw === null || raw === undefined || raw === "" ? "" : formatDate(String(raw), dateMod ? dateMod.slice(5) : "MM/DD/YYYY");
  } else {
    str = raw === null || raw === undefined ? "" : String(raw);
  }

  for (const mod of mods) {
    const lower = mod.toLowerCase();
    if (lower === "upper") str = str.toUpperCase();
    else if (lower === "lower") str = str.toLowerCase();
    else if (lower === "title") str = titleCase(str);
    // currency/date handled above; bold/italic/underline intentionally ignored.
  }

  return str;
}
