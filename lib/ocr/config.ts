// OCR engine configuration + readiness, mirroring the lib/graph/config.ts pattern.
//
// Env (add to .env.local — git-ignored):
//   AZURE_DOCINTEL_ENDPOINT   e.g. https://barsh-matters-docintel.cognitiveservices.azure.com/
//   AZURE_DOCINTEL_KEY        the resource key (Keys and Endpoint blade)
//   AZURE_DOCINTEL_API_VERSION  optional, defaults to the GA version below
//   OCR_PROVIDER              optional: "azure" (default) | "stub" to force the fallback

export type OcrProviderName = "azure" | "stub";

const DEFAULT_API_VERSION = "2024-11-30"; // Document Intelligence v4.0 GA

export type OcrConfig = {
  endpoint: string;
  apiKey: string;
  apiVersion: string;
  preferred: OcrProviderName;
};

export function getOcrConfig(): OcrConfig {
  const endpoint = (process.env.AZURE_DOCINTEL_ENDPOINT || "").trim().replace(/\/+$/, "");
  const apiKey = (process.env.AZURE_DOCINTEL_KEY || "").trim();
  const apiVersion = (process.env.AZURE_DOCINTEL_API_VERSION || DEFAULT_API_VERSION).trim();
  const preferredRaw = (process.env.OCR_PROVIDER || "azure").trim().toLowerCase();
  const preferred: OcrProviderName = preferredRaw === "stub" ? "stub" : "azure";
  return { endpoint, apiKey, apiVersion, preferred };
}

export type OcrReadiness = {
  ready: boolean;
  provider: OcrProviderName;
  missing: string[];
};

/** Whether the Azure provider is fully configured; used to decide azure-vs-stub. */
export function getOcrReadiness(): OcrReadiness {
  const cfg = getOcrConfig();
  if (cfg.preferred === "stub") {
    return { ready: true, provider: "stub", missing: [] };
  }
  const missing: string[] = [];
  if (!cfg.endpoint) missing.push("AZURE_DOCINTEL_ENDPOINT");
  if (!cfg.apiKey) missing.push("AZURE_DOCINTEL_KEY");
  return { ready: missing.length === 0, provider: "azure", missing };
}
