import { NextResponse } from "next/server";
import { isImportEnabled, IMPORT_DISABLED_MESSAGE } from "@/lib/import/importConfig";
import { parseSheetToObjects } from "@/lib/import/xlsxParse";
import { BULK_FIELDS, suggestBulkMapping } from "@/lib/import/bulkAdapter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Bulk-load: parse an uploaded xlsx and return its column headers, a few sample rows, the BM fields to
// map to, and an auto-suggested mapping. Read-only.
export async function POST(request: Request) {
  if (!isImportEnabled()) return NextResponse.json({ ok: false, error: IMPORT_DISABLED_MESSAGE }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const fileBase64 = String(body?.fileBase64 || "");
  if (!fileBase64) return NextResponse.json({ ok: false, error: "fileBase64 is required." }, { status: 400 });

  let rows: Record<string, unknown>[];
  try {
    rows = parseSheetToObjects(fileBase64);
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: `Could not parse spreadsheet: ${error?.message || String(error)}` }, { status: 400 });
  }

  const headers = rows.length ? Object.keys(rows[0]) : [];
  const samples = rows.slice(0, 5);
  return NextResponse.json({
    ok: true,
    source: "bulk",
    rowCount: rows.length,
    headers,
    samples,
    fields: BULK_FIELDS,
    suggestedMapping: suggestBulkMapping(headers),
  });
}
