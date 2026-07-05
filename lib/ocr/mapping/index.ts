// Field-mapping profiles: turn a generic OcrExtractionResult into consumer-specific fields.
// This module is DB-free and pure — safe to import anywhere (no server-only dependency).

export * from "@/lib/ocr/mapping/types";
export { mapBillToIntakeFields } from "@/lib/ocr/mapping/intakeProfile";
export { mapOcrToTitleFields } from "@/lib/ocr/mapping/titleFields";
export type { PrefilledField, TitleFieldPrefill } from "@/lib/ocr/mapping/titleFields";
export { suggestFolderTitle } from "@/lib/ocr/mapping/classify";
export type { FolderTitleSuggestion } from "@/lib/ocr/mapping/classify";
export {
  normalizeLabel,
  labelMatchesAny,
  normalizeDate,
  parseAmount,
  cleanValue,
} from "@/lib/ocr/mapping/normalize";
export { FIELD_SYNONYMS } from "@/lib/ocr/mapping/synonyms";
