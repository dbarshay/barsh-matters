// Persist an OCR extraction result to the OcrExtraction table (SERVER-ONLY — imports the
// server-only prisma client). Consumers in server components / API routes call this after
// extract(). The pure row-shaping lives in persistData.ts so non-server contexts can reuse it.

import { prisma } from "@/lib/prisma";
import { buildOcrExtractionData, type BuildExtractionArgs } from "@/lib/ocr/persistData";

export type PersistExtractionArgs = BuildExtractionArgs;
export { sha256OfBase64 } from "@/lib/ocr/persistData";
export type { OcrSourceType } from "@/lib/ocr/persistData";

export async function persistExtraction(args: PersistExtractionArgs) {
  return prisma.ocrExtraction.create({ data: buildOcrExtractionData(args) });
}
