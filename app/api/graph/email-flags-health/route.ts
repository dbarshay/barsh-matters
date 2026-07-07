import { NextResponse } from "next/server";
import { isMatterEmailEnabled } from "@/lib/graph/matterEmailConfig";
import { isInboundAttachmentOcrEnabled } from "@/lib/graph/inboundOcrConfig";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Read-only diagnostic: reports whether the running server actually sees the email feature flags.
// Reports PRESENCE + length + computed boolean only — never the raw value — so it's safe to hit
// without auth while debugging a deployment. Length helps catch trailing spaces / empty values.
function flagState(key: string) {
  const raw = process.env[key];
  const isString = typeof raw === "string";
  return {
    set: isString && raw.length > 0,
    length: isString ? raw.length : 0,
    normalized: isString ? raw.trim().toLowerCase() : null, // "1"/"true"/... — not a secret
  };
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    vercelEnv: process.env.VERCEL_ENV || null, // "production" | "preview" | "development" | null
    nodeEnv: process.env.NODE_ENV || null,
    computed: {
      matterEmailEnabled: isMatterEmailEnabled(),
      inboundAttachmentOcrEnabled: isInboundAttachmentOcrEnabled(),
    },
    env: {
      BARSH_MATTER_EMAIL_ENABLED: flagState("BARSH_MATTER_EMAIL_ENABLED"),
      BARSH_INBOUND_ATTACHMENT_OCR_ENABLED: flagState("BARSH_INBOUND_ATTACHMENT_OCR_ENABLED"),
    },
  });
}
