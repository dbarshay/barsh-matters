// Provider-agnostic OCR engine types.
//
// The engine is deliberately NOT tied to any one vendor. Both consumers — import-intake
// (scan a bill/claim form to CREATE a matter) and matter-document filing (drop a doc into a
// View Documents folder, pre-fill that title's fields) — call the SAME low-level extract()
// and then apply their own field-mapping profile on top of the generic result below.

/** A key/value pair the OCR layout model found (e.g. "Date of Loss" -> "01/02/2026"). */
export type OcrKeyValue = {
  key: string;
  value: string;
  /** 0..1 model confidence for the pair, or null if the provider didn't score it. */
  confidence: number | null;
};

export type OcrTableCell = {
  rowIndex: number;
  columnIndex: number;
  content: string;
  rowSpan?: number;
  columnSpan?: number;
  /** e.g. "columnHeader" | "content" when the provider labels cells. */
  kind?: string;
};

export type OcrTable = {
  rowCount: number;
  columnCount: number;
  cells: OcrTableCell[];
};

/**
 * What every provider returns, regardless of vendor. Consumers read `text` for full-text
 * search and `keyValues`/`tables` to pre-fill structured fields for user VERIFY (never
 * auto-commit — see document-folder-structure.md, enhancement #8).
 */
export type OcrExtractionResult = {
  /** e.g. "azure-document-intelligence" | "stub". */
  provider: string;
  /** e.g. "prebuilt-layout" | "prebuilt-read". */
  model: string;
  /** Full concatenated document text (for content search + fallback parsing). */
  text: string;
  pageCount: number;
  keyValues: OcrKeyValue[];
  tables: OcrTable[];
  /** Aggregate 0..1 confidence (mean of word confidences), or null if unavailable. */
  meanConfidence: number | null;
  /** Raw provider payload, kept for debugging / re-mapping. Not persisted by default. */
  raw?: unknown;
};

export type OcrInput = {
  /** Base64-encoded file bytes (matches the import xlsx base64 convention). */
  base64: string;
  /** MIME type, e.g. "application/pdf", "image/png", "image/tiff". */
  contentType?: string;
  /** Original filename, for logging/telemetry only. */
  fileName?: string;
};

/**
 * "read"  = text-only OCR  (cheapest — Azure Read, ~$1.50/1k pages). Use on EVERY document
 *           for full-text search.
 * "layout"= text + tables + key/value pairs (Azure Layout, ~$10/1k). Use only on document
 *           types that need structured pre-fill (denials, bills, awards, payments).
 * Routing read-vs-layout per document type is how we keep cost sane at millions of pages/yr.
 */
export type OcrExtractMode = "read" | "layout";

export interface OcrProvider {
  readonly name: string;
  /** True when the provider has everything it needs (creds/endpoint) to run. */
  isReady(): boolean;
  extract(input: OcrInput, mode: OcrExtractMode): Promise<OcrExtractionResult>;
}
