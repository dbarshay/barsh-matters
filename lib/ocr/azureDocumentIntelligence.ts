// Azure AI Document Intelligence adapter (REST, no SDK — same fetch style as lib/graph/client.ts).
//
// Flow (Document Intelligence v4.0, async):
//   1. POST {endpoint}/documentintelligence/documentModels/{model}:analyze?api-version=...
//      body { base64Source }  -> 202 with an `operation-location` header
//   2. Poll GET operation-location until status === "succeeded" (or "failed")
//   3. Read body.analyzeResult -> map to our generic OcrExtractionResult
//
// Auth: the resource key via `Ocp-Apim-Subscription-Key`.

import { getOcrConfig } from "@/lib/ocr/config";
import type {
  OcrExtractionResult,
  OcrExtractMode,
  OcrInput,
  OcrKeyValue,
  OcrProvider,
  OcrTable,
} from "@/lib/ocr/types";

const POLL_INTERVAL_MS = 1200;
const POLL_TIMEOUT_MS = 120_000;

function modelIdForMode(mode: OcrExtractMode): string {
  return mode === "layout" ? "prebuilt-layout" : "prebuilt-read";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type AzureAnalyzeResult = {
  content?: string;
  pages?: Array<{
    pageNumber?: number;
    words?: Array<{ content?: string; confidence?: number }>;
  }>;
  tables?: Array<{
    rowCount?: number;
    columnCount?: number;
    cells?: Array<{
      rowIndex?: number;
      columnIndex?: number;
      content?: string;
      rowSpan?: number;
      columnSpan?: number;
      kind?: string;
    }>;
  }>;
  keyValuePairs?: Array<{
    key?: { content?: string };
    value?: { content?: string };
    confidence?: number;
  }>;
};

function mapKeyValues(raw: AzureAnalyzeResult): OcrKeyValue[] {
  const pairs = raw.keyValuePairs || [];
  return pairs
    .map((p) => ({
      key: (p.key?.content || "").trim(),
      value: (p.value?.content || "").trim(),
      confidence: typeof p.confidence === "number" ? p.confidence : null,
    }))
    .filter((p) => p.key.length > 0);
}

function mapTables(raw: AzureAnalyzeResult): OcrTable[] {
  return (raw.tables || []).map((t) => ({
    rowCount: t.rowCount || 0,
    columnCount: t.columnCount || 0,
    cells: (t.cells || []).map((c) => ({
      rowIndex: c.rowIndex || 0,
      columnIndex: c.columnIndex || 0,
      content: (c.content || "").trim(),
      rowSpan: c.rowSpan,
      columnSpan: c.columnSpan,
      kind: c.kind,
    })),
  }));
}

function meanWordConfidence(raw: AzureAnalyzeResult): number | null {
  let sum = 0;
  let count = 0;
  for (const page of raw.pages || []) {
    for (const word of page.words || []) {
      if (typeof word.confidence === "number") {
        sum += word.confidence;
        count += 1;
      }
    }
  }
  return count > 0 ? sum / count : null;
}

export class AzureDocumentIntelligenceProvider implements OcrProvider {
  readonly name = "azure-document-intelligence";

  isReady(): boolean {
    const cfg = getOcrConfig();
    return Boolean(cfg.endpoint && cfg.apiKey);
  }

  async extract(input: OcrInput, mode: OcrExtractMode): Promise<OcrExtractionResult> {
    const cfg = getOcrConfig();
    if (!cfg.endpoint || !cfg.apiKey) {
      throw new Error(
        "Azure Document Intelligence is not configured (missing AZURE_DOCINTEL_ENDPOINT / AZURE_DOCINTEL_KEY).",
      );
    }

    const model = modelIdForMode(mode);
    // v4.0 makes key/value-pair extraction an opt-in add-on. Request it in layout mode so
    // labeled form fields (e.g. HCFA-1500 patient/insured/dates) come back as keyValuePairs.
    // (Billed as an add-on; only enabled for the pricier "layout" path, never plain "read".)
    const features = mode === "layout" ? "&features=keyValuePairs" : "";
    const analyzeUrl =
      `${cfg.endpoint}/documentintelligence/documentModels/${model}:analyze` +
      `?api-version=${encodeURIComponent(cfg.apiVersion)}${features}`;

    const submit = await fetch(analyzeUrl, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": cfg.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ base64Source: input.base64 }),
    });

    if (submit.status !== 202) {
      const detail = await submit.text().catch(() => "");
      throw new Error(
        `Azure analyze submit failed (${submit.status} ${submit.statusText}): ${detail.slice(0, 500)}`,
      );
    }

    const operationLocation = submit.headers.get("operation-location");
    if (!operationLocation) {
      throw new Error("Azure analyze response missing operation-location header.");
    }

    const deadline = Date.now() + POLL_TIMEOUT_MS;
    let payload: { status?: string; analyzeResult?: AzureAnalyzeResult; error?: unknown } | null =
      null;

    while (Date.now() < deadline) {
      await sleep(POLL_INTERVAL_MS);
      const poll = await fetch(operationLocation, {
        headers: { "Ocp-Apim-Subscription-Key": cfg.apiKey },
      });
      if (!poll.ok) {
        const detail = await poll.text().catch(() => "");
        throw new Error(
          `Azure analyze poll failed (${poll.status} ${poll.statusText}): ${detail.slice(0, 500)}`,
        );
      }
      payload = await poll.json();
      const status = payload?.status;
      if (status === "succeeded") break;
      if (status === "failed") {
        throw new Error(
          `Azure analyze failed: ${JSON.stringify(payload?.error || {}).slice(0, 500)}`,
        );
      }
    }

    if (!payload || payload.status !== "succeeded" || !payload.analyzeResult) {
      throw new Error("Azure analyze timed out before completion.");
    }

    const raw = payload.analyzeResult;
    return {
      provider: this.name,
      model,
      text: raw.content || "",
      pageCount: (raw.pages || []).length,
      keyValues: mapKeyValues(raw),
      tables: mapTables(raw),
      meanConfidence: meanWordConfidence(raw),
      raw,
    };
  }
}
