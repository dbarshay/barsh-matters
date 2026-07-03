import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isImportEnabled, IMPORT_DISABLED_MESSAGE } from "@/lib/import/importConfig";
import { REVIEW_OPEN, REVIEW_READY } from "@/lib/import/holdReasons";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// READ-ONLY list of held import rows that still need review (open) or are fixed and awaiting commit
// (ready), across all non-undone batches. Each row carries its sub-reason, staged summary, batch
// context, and any operator resolution so the reconcile page can render a reason-specific dialog.
// Flag-gated. Optional filters: ?reason=carrier_unmatched|patient_ambiguous|data_quality
// and ?status=open|ready|all (default: open+ready), ?batchId=... to scope to one import.

export async function GET(request: Request) {
  if (!isImportEnabled()) {
    return NextResponse.json({ ok: false, error: IMPORT_DISABLED_MESSAGE }, { status: 403 });
  }

  const url = new URL(request.url);
  const reason = url.searchParams.get("reason") || "";
  const status = url.searchParams.get("status") || "";
  const batchId = url.searchParams.get("batchId") || "";
  const takeRaw = Number(url.searchParams.get("take") || "500");
  const take = Number.isFinite(takeRaw) ? Math.min(Math.max(takeRaw, 1), 2000) : 500;

  const reviewStatusFilter =
    status === "open" ? [REVIEW_OPEN] : status === "ready" ? [REVIEW_READY] : [REVIEW_OPEN, REVIEW_READY];

  const rows = await prisma.importRow.findMany({
    where: {
      outcome: "held",
      reviewStatus: { in: reviewStatusFilter },
      ...(reason ? { holdReason: reason } : {}),
      ...(batchId ? { batchId } : {}),
      batch: { is: { status: { not: "undone" } } },
    },
    orderBy: [{ holdReason: "asc" }, { batchId: "asc" }, { rowIndex: "asc" }],
    take,
    select: {
      id: true,
      batchId: true,
      rowIndex: true,
      holdReason: true,
      reviewStatus: true,
      reason: true,
      staged: true,
      resolution: true,
      batch: { select: { source: true, sourceFile: true, details: true, createdAt: true } },
    },
  });

  const shaped = rows.map((r) => {
    const s = (r.staged ?? {}) as Record<string, any>;
    const details = (r.batch?.details ?? {}) as Record<string, any>;
    return {
      id: r.id,
      batchId: r.batchId,
      rowIndex: r.rowIndex,
      holdReason: r.holdReason,
      reviewStatus: r.reviewStatus,
      reason: r.reason,
      resolution: r.resolution ?? null,
      source: r.batch?.source ?? null,
      sourceFile: r.batch?.sourceFile ?? null,
      providerName: details.providerName ?? null,
      patientName: s.patient_name ?? "",
      carrierRaw: s.carrier_raw ?? "",
      claim: s.claim_number_raw ?? "",
      dosStart: s.dos_start ?? "",
      dosEnd: s.dos_end ?? "",
      amount: typeof s.claim_amount === "number" ? s.claim_amount : null,
    };
  });

  const byReason: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  for (const r of shaped) {
    if (r.holdReason) byReason[r.holdReason] = (byReason[r.holdReason] ?? 0) + 1;
    if (r.reviewStatus) byStatus[r.reviewStatus] = (byStatus[r.reviewStatus] ?? 0) + 1;
  }

  // Distinct unmatched carriers (for the carrier dialog) with counts.
  const carrierGroups: Record<string, number> = {};
  for (const r of shaped) {
    if (r.holdReason === "carrier_unmatched" && r.reviewStatus === REVIEW_OPEN && r.carrierRaw) {
      carrierGroups[r.carrierRaw] = (carrierGroups[r.carrierRaw] ?? 0) + 1;
    }
  }

  return NextResponse.json({
    ok: true,
    count: shaped.length,
    byReason,
    byStatus,
    carrierGroups: Object.entries(carrierGroups)
      .map(([carrierRaw, count]) => ({ carrierRaw, count }))
      .sort((a, b) => b.count - a.count),
    rows: shaped,
  });
}
