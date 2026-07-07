import { NextRequest, NextResponse } from "next/server";
import { isAdminRequestAuthorized } from "@/lib/adminAuth";
import { ensureEmailSubscription } from "@/lib/graph/emailSubscription";
import { isEmailWebhookEnabled, EMAIL_WEBHOOK_DISABLED_MESSAGE } from "@/lib/graph/webhookConfig";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Create / renew / self-heal the Microsoft Graph email subscription. This is the "auto-resubscribe +
// health check": it creates the subscription if missing, renews it before expiry, and recreates it if
// Graph reports it gone. The renewal cron calls this (Vercel cron uses GET); an admin can also trigger
// it manually. Gated by admin session OR a trusted scheduler bearer secret.
function clean(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}
function bearerSecretOk(req: NextRequest): boolean {
  const configured = clean(process.env.BARSH_MATTERS_BACKGROUND_EMAIL_SYNC_SECRET || process.env.CRON_SECRET);
  if (!configured) return false;
  const authorization = clean(req.headers.get("authorization"));
  const bearer = authorization.toLowerCase().startsWith("bearer ") ? authorization.slice(7).trim() : "";
  return bearer.length > 0 && bearer === configured;
}

async function run(req: NextRequest) {
  if (!isEmailWebhookEnabled()) {
    return NextResponse.json({ ok: false, error: EMAIL_WEBHOOK_DISABLED_MESSAGE }, { status: 403 });
  }
  if (!isAdminRequestAuthorized(req) && !bearerSecretOk(req)) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized. Requires an admin session or Authorization: Bearer <CRON_SECRET / BARSH_MATTERS_BACKGROUND_EMAIL_SYNC_SECRET>." },
      { status: 401 },
    );
  }
  const result = await ensureEmailSubscription();
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}

export async function GET(req: NextRequest) {
  return run(req);
}
export async function POST(req: NextRequest) {
  return run(req);
}
