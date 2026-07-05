// Field-mapping profile types — the bridge between the generic OCR result and the specific
// matter-creation fields (createMatters.ts StagedForCreate / the manual-create API).
//
// Every mapped field carries a value + confidence + source so the VERIFY UI can highlight what
// to check (low confidence = yellow) and show where each guess came from. NOTHING here commits;
// the operator reviews and corrects. `caseType` is intentionally absent — operator always picks it.

export type MappedField<T> = {
  /** Normalized value (dates -> MM/DD/YYYY, amounts -> number), or null if not found. */
  value: T | null;
  /** 0..1 confidence. Inherited from the OCR key/value when matched there; lower for fallbacks. */
  confidence: number | null;
  /** Human-readable provenance, e.g. `kv:"PATIENT'S NAME"` | `table` | `regex:text`. */
  source: string | null;
  /** The raw matched text before normalization (handy for the verify UI + debugging). */
  rawText: string | null;
};

export type IntakeMappingResult = {
  patientName: MappedField<string>;
  providerName: MappedField<string>;
  insurerName: MappedField<string>;
  claimNumber: MappedField<string>;
  policyNumber: MappedField<string>;
  dateOfLoss: MappedField<string>;
  dosStart: MappedField<string>;
  dosEnd: MappedField<string>;
  claimAmount: MappedField<number>;
};

export type IntakeFieldKey = keyof IntakeMappingResult;

export const INTAKE_FIELD_KEYS: IntakeFieldKey[] = [
  "patientName",
  "providerName",
  "insurerName",
  "claimNumber",
  "policyNumber",
  "dateOfLoss",
  "dosStart",
  "dosEnd",
  "claimAmount",
];

export function emptyField<T>(): MappedField<T> {
  return { value: null, confidence: null, source: null, rawText: null };
}
