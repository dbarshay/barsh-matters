// OCR engine entry point. Consumers import from here; they never touch a specific vendor.
//
//   import { extractDocument } from "@/lib/ocr";
//   const result = await extractDocument({ base64, contentType: "application/pdf" }, "layout");
//
// Provider selection: Azure when configured (or forced), else the offline stub. This is the
// single seam where a future provider (a per-doc-type custom model, or a different vendor as
// a fallback) gets swapped in — nothing upstream changes.

import { getOcrReadiness } from "@/lib/ocr/config";
import { AzureDocumentIntelligenceProvider } from "@/lib/ocr/azureDocumentIntelligence";
import { StubOcrProvider } from "@/lib/ocr/stub";
import type { OcrExtractionResult, OcrExtractMode, OcrInput, OcrProvider } from "@/lib/ocr/types";

export * from "@/lib/ocr/types";
export { getOcrReadiness, getOcrConfig } from "@/lib/ocr/config";
// Pure (DB-free) persistence helpers are safe to re-export here. The server-only writer
// `persistExtraction` is intentionally NOT re-exported — import it from "@/lib/ocr/persist"
// in server components / API routes so this barrel stays usable in any context.
export { buildOcrExtractionData, sha256OfBase64 } from "@/lib/ocr/persistData";
export type { OcrSourceType, BuildExtractionArgs } from "@/lib/ocr/persistData";

const azure = new AzureDocumentIntelligenceProvider();
const stub = new StubOcrProvider();

/** Resolve the active provider based on config/readiness. */
export function getOcrProvider(): OcrProvider {
  const readiness = getOcrReadiness();
  if (readiness.provider === "azure" && readiness.ready) return azure;
  return stub;
}

/** Extract from a document with the active provider. `mode` picks cost/detail (read vs layout). */
export async function extractDocument(
  input: OcrInput,
  mode: OcrExtractMode = "read",
): Promise<OcrExtractionResult> {
  return getOcrProvider().extract(input, mode);
}
