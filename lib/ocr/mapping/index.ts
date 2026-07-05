// Field-mapping profiles: turn a generic OcrExtractionResult into consumer-specific fields.
// This module is DB-free and pure — safe to import anywhere (no server-only dependency).

export * from "@/lib/ocr/mapping/types";
export { mapBillToIntakeFields } from "@/lib/ocr/mapping/intakeProfile";
export {
  normalizeLabel,
  labelMatchesAny,
  normalizeDate,
  parseAmount,
  cleanValue,
} from "@/lib/ocr/mapping/normalize";
export { FIELD_SYNONYMS } from "@/lib/ocr/mapping/synonyms";
