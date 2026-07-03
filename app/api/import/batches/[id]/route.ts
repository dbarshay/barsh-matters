import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isImportEnabled, IMPORT_DISABLED_MESSAGE } from "@/lib/import/importConfig";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// READ-ONLY details for a single import batch: the batch header/counts plus every ImportRow
// (outcome + reason + matter link). Created rows are joined back to ClaimIndex for their BRL
// display number and patient name so the "list of cases" is human-readable. Flag-gated.

export async function GET(_req: Request, context: { params: Promise<{ id: string }> | { id: string } }) {
  if (!isImportEnabled()) {
    return NextResponse.json({ ok: false, error: IMPORT_DISABLED_MESSAGE }, { status: 403 });
  }

  const params = await context.params;
  const id = String(params?.id || "").trim();
  if (!id) return NextResponse.json({ ok: false, error: "Batch id required." }, { status: 400 });

  const batch = await prisma.importBatch.findUnique({ where: { id } });
  if (!batch) return NextResponse.json({ ok: false, error: "No such import batch." }, { status: 404 });

  const rows = await prisma.importRow.findMany({
    where: { batchId: id },
    orderBy: { rowIndex: "asc" },
    select: { rowIndex: true, outcome: true, reason: true, matterId: true, fingerprint: true, holdReason: true, reviewStatus: true },
  });

  // Join created matters back to ClaimIndex for a readable case list.
  const matterIds = rows.map((r) => r.matterId).filter((m): m is number => typeof m === "number");
  const matters = matterIds.length
    ? await prisma.claimIndex.findMany({
        where: { matter_id: { in: matterIds } },
        select: { matter_id: true, display_number: true, patient_name: true, matter_stage_name: true, final_status: true },
      })
    : [];
  const matterById = new Map(matters.map((m) => [m.matter_id, m]));

  const details = (batch.details ?? {}) as Record<string, unknown>;
  const held = Number(details.heldUnmatchedCarrier ?? 0) || 0;

  const enriched = rows.map((r) => {
    const m = r.matterId != null ? matterById.get(r.matterId) : undefined;
    return {
      rowIndex: r.rowIndex,
      outcome: r.outcome,
      holdReason: r.holdReason,
      reviewStatus: r.reviewStatus,
      reason: r.reason,
      matterId: r.matterId,
      displayNumber: m?.display_number ?? null,
      patientName: m?.patient_name ?? null,
      stage: m?.matter_stage_name ?? null,
      finalStatus: m?.final_status ?? null,
      fingerprint: r.fingerprint,
    };
  });

  // Count per outcome for the breakdown.
  const byOutcome: Record<string, number> = {};
  for (const r of rows) byOutcome[r.outcome] = (byOutcome[r.outcome] ?? 0) + 1;

  return NextResponse.json({
    ok: true,
    batch: {
      id: batch.id,
      source: batch.source,
      sourceFile: batch.sourceFile,
      actorName: batch.actorName,
      status: batch.status,
      totalRows: batch.totalRows,
      createdCount: batch.createdCount,
      rejectedCount: batch.rejectedCount,
      reportCount: batch.reportCount,
      ignoredCount: batch.ignoredCount,
      held,
      providerName: details.providerName ?? null,
      createdAt: batch.createdAt.toISOString(),
    },
    byOutcome,
    rows: enriched,
  });
}
