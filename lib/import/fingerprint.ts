// Derived "bill fingerprint" for Dow / manual dedup (soft key — flagged for review, never auto-merged).
// Validated on real Dow data: claim/policy + patient + DOS span + gross charges is 100% unique.
// Pure — no DB.

function normalizeToken(v: unknown): string {
  return String(v ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

export type BillFingerprintInput = {
  claimOrPolicy: string; // claim number OR policy number (whichever identifies the bill)
  patientKey: string; // already-normalized patient match key
  dosStart: string;
  dosEnd: string;
  grossAmount: number | null;
};

/** Deterministic fingerprint string. NOT a hard-unique key — used to flag likely duplicates. */
export function computeBillFingerprint(input: BillFingerprintInput): string {
  return [
    normalizeToken(input.claimOrPolicy),
    normalizeToken(input.patientKey),
    normalizeToken(input.dosStart),
    normalizeToken(input.dosEnd),
    input.grossAmount == null ? "" : input.grossAmount.toFixed(2),
  ].join("|");
}
