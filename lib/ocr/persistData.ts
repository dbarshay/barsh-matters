// Pure (DB-free) builder for an OcrExtraction row. Kept separate from persist.ts so it does
// NOT import "@/lib/prisma" (which is `server-only`) — this lets scripts and any non-RSC
// context construct the row data without tripping the server-only guard.

import crypto from "crypto";
import type { OcrExtractionResult, OcrExtractMode, OcrInput } from "@/lib/ocr/types";

export type OcrSourceType =
  | "import_intake"
  | "matter_document"
  | "payment_modal"
  | "scan"
  | "upload"
  | "email_attachment"
  | "template"
  | "adhoc";

export type BuildExtractionArgs = {
  input: OcrInput;
  result: OcrExtractionResult;
  mode: OcrExtractMode;
  sourceType?: OcrSourceType;
  matterId?: number | null;
  matterDisplayNumber?: string | null;
  clioDocumentId?: string | null;
};

/** sha256 (hex) of the decoded file bytes. */
export function sha256OfBase64(base64: string): string {
  return crypto.createHash("sha256").update(Buffer.from(base64, "base64")).digest("hex");
}

/** Shape the OcrExtraction row data. Consumed by persist.ts and by the smoke test. */
export function buildOcrExtractionData(args: BuildExtractionArgs) {
  const { input, result, mode } = args;
  const buf = Buffer.from(input.base64, "base64");
  return {
    sourceType: args.sourceType ?? "adhoc",
    matterId: args.matterId ?? null,
    matterDisplayNumber: args.matterDisplayNumber ?? null,
    clioDocumentId: args.clioDocumentId ?? null,
    fileName: input.fileName ?? null,
    contentType: input.contentType ?? null,
    byteSize: buf.length,
    fileHash: crypto.createHash("sha256").update(buf).digest("hex"),
    provider: result.provider,
    model: result.model,
    mode,
    pageCount: result.pageCount,
    meanConfidence: result.meanConfidence ?? null,
    text: result.text,
    // Round-trip to a plain JSON value the Prisma Json field accepts under strict mode.
    keyValues: JSON.parse(JSON.stringify(result.keyValues)),
    tables: JSON.parse(JSON.stringify(result.tables ?? [])),
  };
}
