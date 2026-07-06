import { NextResponse } from "next/server";
import { isImportEnabled, IMPORT_DISABLED_MESSAGE } from "@/lib/import/importConfig";
import { listOpenReport } from "@/lib/import/cariskManagementReport";
import { reportRecipients } from "@/lib/import/cariskReportEmail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// READ-ONLY: the open Carisk Management Report (Saved-Incomplete bills not yet graduated to matters).
// Flag-gated.
export async function GET() {
  if (!isImportEnabled()) return NextResponse.json({ ok: false, error: IMPORT_DISABLED_MESSAGE }, { status: 403 });
  const items = await listOpenReport();
  return NextResponse.json({
    ok: true,
    count: items.length,
    recipientsConfigured: reportRecipients().length,
    items: items.map((r: any) => ({ ...r, firstSeen: r.firstSeen.toISOString(), lastSeen: r.lastSeen.toISOString() })),
  });
}
