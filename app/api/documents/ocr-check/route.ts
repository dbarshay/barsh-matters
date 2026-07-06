import { NextRequest, NextResponse } from "next/server";
import { isAdminRequestAuthorized, adminUnauthorizedJson } from "@/lib/adminAuth";
import { getOcrReadiness, getOcrConfig } from "@/lib/ocr/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// READ-ONLY: reports whether the OCR engine will use real Azure Document Intelligence or the
// offline stub, and which env pieces (if any) are missing. No document is processed. Admin-gated.
export async function GET(req: NextRequest) {
  if (!isAdminRequestAuthorized(req)) return adminUnauthorizedJson();

  const readiness = getOcrReadiness();
  const cfg = getOcrConfig();

  return NextResponse.json({
    ok: readiness.ready,
    provider: readiness.provider, // "azure" when configured, else "stub"
    ready: readiness.ready,
    missing: readiness.missing,
    endpointConfigured: Boolean(cfg.endpoint),
    apiKeyConfigured: Boolean(cfg.apiKey),
    preferred: cfg.preferred,
    note:
      readiness.provider === "stub" || !readiness.ready
        ? "OCR is using the offline stub (or Azure not fully configured). Set AZURE_DOCINTEL_ENDPOINT + AZURE_DOCINTEL_KEY (and unset OCR_PROVIDER) and RESTART the dev server so it reloads .env.local."
        : "Azure Document Intelligence is configured. Real OCR will run.",
  });
}
