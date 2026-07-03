// Sub-reasons for a HELD import row. "Held" = needs an operator decision before a matter can be
// created (distinct from "error" = hard reject, and "duplicate" = skip). The reconcile page routes
// each hold to a reason-specific dialog:
//   carrier_unmatched -> map to an existing carrier (alias) or add a new carrier
//   patient_ambiguous -> link to an existing patient or create a new one
//   data_quality       -> accept the flagged value or dismiss the row

export const HOLD_CARRIER_UNMATCHED = "carrier_unmatched";
export const HOLD_PROVIDER_UNMATCHED = "provider_unmatched";
export const HOLD_PATIENT_AMBIGUOUS = "patient_ambiguous";
export const HOLD_CASE_TYPE_UNKNOWN = "case_type_unknown";
export const HOLD_TIN_MISMATCH = "tin_mismatch";
export const HOLD_DATA_QUALITY = "data_quality";

export const HOLD_REASONS = [
  HOLD_CARRIER_UNMATCHED,
  HOLD_PROVIDER_UNMATCHED,
  HOLD_PATIENT_AMBIGUOUS,
  HOLD_CASE_TYPE_UNKNOWN,
  HOLD_TIN_MISMATCH,
  HOLD_DATA_QUALITY,
] as const;
export type HoldReason = (typeof HOLD_REASONS)[number];

export const HOLD_REASON_LABEL: Record<string, string> = {
  [HOLD_CARRIER_UNMATCHED]: "Carrier not in registry",
  [HOLD_PROVIDER_UNMATCHED]: "Provider not in registry",
  [HOLD_PATIENT_AMBIGUOUS]: "Patient match ambiguous",
  [HOLD_CASE_TYPE_UNKNOWN]: "Unknown case type (ClaimType)",
  [HOLD_TIN_MISMATCH]: "Provider TIN mismatch",
  [HOLD_DATA_QUALITY]: "Data quality",
};

// Review lifecycle for a held row.
export const REVIEW_OPEN = "open"; // needs operator action
export const REVIEW_READY = "ready"; // fixed -> "Ready to Commit"
export const REVIEW_COMMITTED = "committed"; // matter created from this row
export const REVIEW_DISMISSED = "dismissed"; // operator chose not to import this row

/**
 * Data-quality gate for a staged row (checked only after carrier + patient pass). Returns a reason
 * string when the row should be held for review, or null when it's clean. Kept intentionally
 * conservative: only a clearly-suspect charge amount holds today; add checks here as needed.
 */
export function dataQualityHold(staged: { claim_amount: number | null }): string | null {
  const amt = staged.claim_amount;
  if (amt == null) return null; // missing amount is a hard "error" upstream, not a data-quality hold
  if (amt <= 0) return "Charge amount is zero or negative.";
  return null;
}
