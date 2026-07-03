import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isImportEnabled, IMPORT_DISABLED_MESSAGE } from "@/lib/import/importConfig";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// READ-ONLY import history. Lists recent ImportBatch records (any source) with their stored counts
// and status so the /admin/import page can show existing/previously-imported data alongside the
// new-import workflow. Gated behind BARSH_IMPORT_ENABLED.

export async function GET(request: Request) {
  if (!isImportEnabled()) {
    return NextResponse.json({ ok: false, error: IMPORT_DISABLED_MESSAGE }, { status: 403 });
  }

  const url = new URL(request.url);
  const takeRaw = Number(url.searchParams.get("take") || "25");
  const take = Number.isFinite(takeRaw) ? Math.min(Math.max(takeRaw, 1), 100) : 25;

  const batches = await prisma.importBatch.findMany({
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      source: true,
      sourceFile: true,
      actorName: true,
      status: true,
      totalRows: true,
      createdCount: true,
      rejectedCount: true,
      reportCount: true,
      ignoredCount: true,
      details: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    ok: true,
    count: batches.length,
    batches: batches.map((b) => {
      const details = (b.details ?? {}) as Record<string, unknown>;
      // Total held across ALL sub-reasons. New batches store details.held; older ones only stored the
      // carrier count, so fall back to the sum of whatever sub-reason counts are present.
      const carrierHeld = Number(details.heldUnmatchedCarrier ?? 0) || 0;
      const patientHeld = Number(details.heldPatientAmbiguous ?? 0) || 0;
      const dataHeld = Number(details.heldDataQuality ?? 0) || 0;
      const held = Number(details.held ?? carrierHeld + patientHeld + dataHeld) || 0;
      // "Other" catches any rows not otherwise accounted for so the columns always reconcile to totalRows.
      const other = Math.max(0, b.totalRows - b.createdCount - b.rejectedCount - b.reportCount - b.ignoredCount - held);
      const { details: _drop, ...rest } = b;
      void _drop;
      return { ...rest, held, other, createdAt: b.createdAt.toISOString() };
    }),
  });
}
