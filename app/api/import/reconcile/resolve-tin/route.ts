import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isImportEnabled, IMPORT_DISABLED_MESSAGE } from "@/lib/import/importConfig";
import { REVIEW_READY, REVIEW_DISMISSED, HOLD_TIN_MISMATCH } from "@/lib/import/holdReasons";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Resolve a tin_mismatch held row: the operator ACCEPTS the row's TIN (import as-is) or DISMISSES the
// row. This does NOT change the provider's canonical TIN in the registry (that's an Owner registry
// edit). Touches only the ImportRow. Flag-gated.
//   { rowId, action: "accept" }  -> reviewStatus = ready
//   { rowId, action: "dismiss" } -> reviewStatus = dismissed

export async function POST(request: Request) {
  if (!isImportEnabled()) return NextResponse.json({ ok: false, error: IMPORT_DISABLED_MESSAGE }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const rowId = String(body?.rowId || "").trim();
  const action = String(body?.action || "").trim();
  if (!rowId) return NextResponse.json({ ok: false, error: "rowId is required." }, { status: 400 });
  if (action !== "accept" && action !== "dismiss") {
    return NextResponse.json({ ok: false, error: "action must be 'accept' or 'dismiss'." }, { status: 400 });
  }

  const row = await prisma.importRow.findUnique({ where: { id: rowId }, select: { outcome: true, holdReason: true } });
  if (!row || row.outcome !== "held" || row.holdReason !== HOLD_TIN_MISMATCH) {
    return NextResponse.json({ ok: false, error: "Row is not a TIN-mismatch hold." }, { status: 400 });
  }

  await prisma.importRow.update({
    where: { id: rowId },
    data: { reviewStatus: action === "accept" ? REVIEW_READY : REVIEW_DISMISSED, resolution: { tin: action } },
  });

  return NextResponse.json({ ok: true, rowId, action });
}
