import { prisma } from "@/lib/prisma";

// Patient identity resolution for imports + manual creation.
//
// Rules (from docs/manual-creation-intake.md):
//  - Patient = reusable MASTER record (one per person, linked across matters).
//  - Names vary (typos, transpositions, middle initials, LAST/FIRST). Fuzzy-match to avoid dupes.
//  - HARD constraint: similar names can be DIFFERENT people (co-claimants share a last name).
//    NEVER auto-link on a fuzzy name — SUGGEST and let the operator confirm.
//  - Spectrum: no match -> create new (normal, first import); close/ambiguous -> suggest;
//    single exact -> link. Corroborating identifiers (policy/claim #, DOI) used by the preview layer
//    to rank suggestions (they live on the matter, not the patient).

/** Convert an incoming name to canonical "First Last" (proper case). Handles "LAST, FIRST". */
export function toFirstLastProperCase(raw: unknown): string {
  const s = String(raw ?? "").trim().replace(/\s+/g, " ");
  if (!s) return "";

  let first = "";
  let last = "";
  if (s.includes(",")) {
    const [l, ...rest] = s.split(",");
    last = l.trim();
    first = rest.join(",").trim();
  } else {
    const parts = s.split(" ");
    if (parts.length === 1) {
      first = parts[0];
    } else {
      last = parts[parts.length - 1];
      first = parts.slice(0, -1).join(" ");
    }
  }

  const proper = (word: string) =>
    word
      .split(/([ \-']+)/)
      .map((seg) => (/[a-zA-Z]/.test(seg) ? seg.charAt(0).toUpperCase() + seg.slice(1).toLowerCase() : seg))
      .join("");

  const name = [first, last].filter(Boolean).map(proper).join(" ").trim();
  return name || proper(s);
}

/** Lowercase, punctuation-stripped match key (order-preserving). */
export function patientMatchKey(name: unknown): string {
  return String(name ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** Last-name token of a canonical "First Last" name (for coarse "close" candidate search). */
function lastNameKey(name: string): string {
  const parts = patientMatchKey(name).split(" ").filter(Boolean);
  return parts.length ? parts[parts.length - 1] : "";
}

export type PatientCandidate = { id: string; name: string; kind: "exact" | "close" };

export type PatientResolution =
  | { status: "exact"; patientId: string; name: string }
  | { status: "suggest"; candidates: PatientCandidate[] }
  | { status: "new" };

/**
 * Resolve an incoming patient name against the master. NEVER auto-links on a fuzzy name:
 *  - exactly one exact-key match -> "exact" (safe to link);
 *  - any close matches, or multiple exact matches (possible same-name different people) -> "suggest";
 *  - nothing -> "new" (caller creates a new patient — the normal first-import case).
 */
export async function resolvePatient(rawName: unknown): Promise<PatientResolution> {
  const canonical = toFirstLastProperCase(rawName);
  const key = patientMatchKey(canonical);
  if (!key) return { status: "new" };

  // Only MATCHABLE patients are link/suggest targets. Quarantined bulk-load patients (matchable:false,
  // e.g. pre-2025 NF matters) are recorded for history but never re-linked by later imports.
  const exact = await prisma.patient.findMany({
    where: { normalizedName: key, matchable: true },
    select: { id: true, name: true },
    take: 25,
  });

  if (exact.length === 1) {
    return { status: "exact", patientId: exact[0].id, name: exact[0].name };
  }
  if (exact.length > 1) {
    // Same normalized name, but could be different people -> make the operator choose.
    return { status: "suggest", candidates: exact.map((p) => ({ ...p, kind: "exact" as const })) };
  }

  // No exact match — look for close candidates by last name (co-claimants / typos surface here).
  const last = lastNameKey(canonical);
  const close = last
    ? await prisma.patient.findMany({
        where: { normalizedName: { contains: last }, matchable: true },
        select: { id: true, name: true },
        take: 25,
      })
    : [];

  if (close.length) {
    return { status: "suggest", candidates: close.map((p) => ({ ...p, kind: "close" as const })) };
  }
  return { status: "new" };
}

/** Create a new patient master record from an incoming name.
 *  `matchable=false` quarantines it (recorded for history but never a future-import link target) —
 *  used by the bulk importer for pre-2025 matters. */
export async function createPatient(rawName: unknown, source = "import", opts?: { matchable?: boolean }) {
  const name = toFirstLastProperCase(rawName);
  return prisma.patient.create({
    data: { name, normalizedName: patientMatchKey(name), source, matchable: opts?.matchable ?? true },
  });
}
