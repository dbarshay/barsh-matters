import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isImportEnabled, IMPORT_DISABLED_MESSAGE } from "@/lib/import/importConfig";
import { REVIEW_READY, HOLD_CASE_TYPE_UNKNOWN } from "@/lib/import/holdReasons";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Resolve a case_type_unknown held row: the operator maps the raw ClaimType to a case type. GROUP
// RESOLVE — the decision applies to every open case_type_unknown row with the SAME raw ClaimType, so
// the operator maps each unknown ClaimType once. Touches only the ImportRows. Flag-gated.
//   { rowId, caseType }  -> e.g. "Workers Compensation" | "No-Fault" | custom

export async function POST(request: Request) {
  if (!isImportEnabled()) return NextResponse.json({ ok: false, error: IMPORT_DISABLED_MESSAGE }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const rowId = String(body?.rowId || "").trim();
  const caseType = String(body?.caseType || "").trim();
  if (!rowId) return NextResponse.json({ ok: false, error: "rowId is required." }, { status: 400 });
  if (!caseType) return NextResponse.json({ ok: false, error: "caseType is required." }, { status: 400 });

  const row = await prisma.importRow.findUnique({ where: { id: rowId }, select: { outcome: true, holdReason: true, staged: true } });
  if (!row || row.outcome !== "held" || row.holdReason !== HOLD_CASE_TYPE_UNKNOWN) {
    return NextResponse.json({ ok: false, error: "Row is not a case-type hold." }, { status: 400 });
  }
  const rawType = String(((row.staged ?? {}) as Record<string, any>).case_type_raw ?? "");

  // Apply to all open case-type holds sharing the same raw ClaimType.
  const open = await prisma.importRow.findMany({
    where: { outcome: "held", holdReason: HOLD_CASE_TYPE_UNKNOWN, reviewStatus: "open", batch: { is: { status: { not: "undone" } } } },
    select: { id: true, staged: true },
  });
  const ids = open.filter((r) => String(((r.staged ?? {}) as Record<string, any>).case_type_raw ?? "") === rawType).map((r) => r.id);

  await prisma.importRow.updateMany({
    where: { id: { in: ids.length ? ids : [rowId] } },
    data: { reviewStatus: REVIEW_READY, resolution: { caseType } },
  });

  return NextResponse.json({ ok: true, rowId, caseType, rawType, appliedTo: ids.length || 1 });
}
