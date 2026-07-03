import { NextResponse } from "next/server";
import { isImportEnabled, IMPORT_DISABLED_MESSAGE } from "@/lib/import/importConfig";
import { parseSheetToObjects } from "@/lib/import/xlsxParse";
import { suggestMapping, OTHER_FIELDS } from "@/lib/import/otherAdapter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// READ-ONLY: parse an uploaded generic spreadsheet, return its column headers, a few sample rows, and
// an AUTO-SUGGESTED BM-field -> column mapping the operator can override. Writes nothing. Flag-gated.

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

  const headers = rows.length ? Object.keys(rows[0]).filter((h) => h && h.trim()) : [];
  const samples = rows.slice(0, 3);

  return NextResponse.json({
    ok: true,
    headers,
    samples,
    totalRows: rows.length,
    fields: OTHER_FIELDS.map((f) => ({ key: f.key, label: f.label, required: !!f.required })),
    suggested: suggestMapping(headers),
  });
}
