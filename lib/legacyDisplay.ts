// Display-only helper for the one-time NF bulk load. Matters created by that load are tagged
// `ClaimIndex.import_batch = "nf-legacy"`; wherever their BM number is SHOWN we append a "-legacy"
// suffix so staff can tell historical closed-file records apart at a glance. This is PURELY visual —
// never feed the suffixed string back into search, navigation, Clio, or email parsers (use the raw
// display_number for those). Pure + isomorphic (safe to import in client components and server routes).

export const LEGACY_IMPORT_BATCH = "nf-legacy";

/** True when a matter/row came from the NF bulk load (checks both snake and camel field spellings). */
export function isLegacyMatter(row: any): boolean {
  const batch = row?.import_batch ?? row?.importBatch ?? "";
  return String(batch) === LEGACY_IMPORT_BATCH;
}

/** "-legacy" for bulk-loaded matters, else "" — append after a rendered display number. */
export function legacyTag(row: any): string {
  return isLegacyMatter(row) ? "-legacy" : "";
}

/** Convenience: a display label with the legacy suffix already appended (display-only). */
export function withLegacyTag(label: string | number | null | undefined, row: any): string {
  return `${label ?? ""}${legacyTag(row)}`;
}
