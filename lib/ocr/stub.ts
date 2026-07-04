// Stub OCR provider — deterministic, offline fallback so the engine (and the consumers that
// call it) can be built and unit-tested BEFORE Azure credentials exist. It performs no real
// OCR; it echoes a fixed shape derived from the input so calling code has something concrete
// to map. Selected automatically when Azure isn't configured, or forced via OCR_PROVIDER=stub.

import type {
  OcrExtractionResult,
  OcrExtractMode,
  OcrInput,
  OcrProvider,
} from "@/lib/ocr/types";

export class StubOcrProvider implements OcrProvider {
  readonly name = "stub";

  isReady(): boolean {
    return true;
  }

  async extract(input: OcrInput, mode: OcrExtractMode): Promise<OcrExtractionResult> {
    const approxBytes = Math.floor((input.base64?.length || 0) * 0.75);
    const text =
      `[STUB OCR] No real extraction performed. ` +
      `file=${input.fileName || "unknown"} type=${input.contentType || "unknown"} ` +
      `~${approxBytes} bytes mode=${mode}.`;

    return {
      provider: this.name,
      model: mode === "layout" ? "stub-layout" : "stub-read",
      text,
      pageCount: 1,
      keyValues:
        mode === "layout"
          ? [{ key: "StubField", value: "StubValue", confidence: 0.5 }]
          : [],
      tables: [],
      meanConfidence: 0.5,
    };
  }
}
