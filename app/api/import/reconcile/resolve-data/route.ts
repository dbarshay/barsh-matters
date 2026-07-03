import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isImportEnabled, IMPORT_DISABLED_MESSAGE } from "@/lib/import/importConfig";
import { REVIEW_READY, REVIEW_DISMISSED, HOLD_DATA_QUALITY } from "@/lib/import/holdReasons";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Resolve a data_quality held row: the operator either ACCEPTS the flagged value (mark Ready to
// Commit) or DISMISSES the row (won't be imported). Touches only the ImportRow. Flag-gated.
//   { rowId, action: "accept" }  -> reviewStatus = ready
//   { rowId, action: "dismiss" } -> reviewStatus = dismissed

export async function POST(request: Request) {
  if (!isImportEnabled()) {
    return NextResponse.json({ ok: false, error: IMPORT_DISABLED_MESSAGE }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const rowId = String(body?.rowId || "").trim();
  const action = String(body?.action || "").trim();

  if (!rowId) return NextResponse.json({ ok: false, error: "rowId is required." }, { status: 400 });
  if (action !== "accept" && action !== "dismiss") {
    return NextResponse.json({ ok: false, error: "action must be 'accept' or 'dismiss'." }, { status: 400 });
  }

  const row = await prisma.importRow.findUnique({ where: { id: rowId }, select: { id: true, outcome: true, holdReason: true } });
  if (!row || row.outcome !== "held" || row.holdReason !== HOLD_DATA_QUALITY) {
    return NextResponse.json({ ok: false, error: "Row is not a data-quality hold." }, { status: 400 });
  }

  await prisma.importRow.update({
    where: { id: rowId },
    data: {
      reviewStatus: action === "accept" ? REVIEW_READY : REVIEW_DISMISSED,
      resolution: { dataQuality: action },
    },
  });

  return NextResponse.json({ ok: true, rowId, action });
}
