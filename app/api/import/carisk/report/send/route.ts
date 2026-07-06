import { NextRequest, NextResponse } from "next/server";
import { isImportEnabled, IMPORT_DISABLED_MESSAGE } from "@/lib/import/importConfig";
import { isAdminRequestAuthorized, adminUnauthorizedJson } from "@/lib/adminAuth";
import { sendReportEmail } from "@/lib/import/cariskReportEmail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Send the Carisk Management Report email. Two entry points:
//   - GET  = the weekly SCHEDULER (Vercel Cron on Fridays). Authorizes with
//            `Authorization: Bearer <CRON_SECRET>` (Vercel injects it; also accepts
//            CARISK_REPORT_CRON_SECRET). Fail-closed if no secret configured.
//   - POST = the admin "Send now" button (admin session cookie).
// Flag-gated. Recipient(s) come from CARISK_REPORT_RECIPIENT.

function bearer(req: NextRequest): string {
  const a = (req.headers.get("authorization") || "").trim();
  return a.toLowerCase().startsWith("bearer ") ? a.slice(7).trim() : "";
}

async function run() {
  const result = await sendReportEmail();
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}

export async function GET(req: NextRequest) {
  if (!isImportEnabled()) return NextResponse.json({ ok: false, error: IMPORT_DISABLED_MESSAGE }, { status: 403 });
  const secret = (process.env.CRON_SECRET || process.env.CARISK_REPORT_CRON_SECRET || "").trim();
  if (!secret || bearer(req) !== secret) {
    return NextResponse.json({ ok: false, error: "Unauthorized (scheduler). Call with Authorization: Bearer <CRON_SECRET>." }, { status: 401 });
  }
  return run();
}

export async function POST(req: NextRequest) {
  if (!isImportEnabled()) return NextResponse.json({ ok: false, error: IMPORT_DISABLED_MESSAGE }, { status: 403 });
  if (!isAdminRequestAuthorized(req)) return adminUnauthorizedJson();
  return run();
}
