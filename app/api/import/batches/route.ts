import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isImportEnabled, IMPORT_DISABLED_MESSAGE } from "@/lib/import/importConfig";
import { REVIEW_DISMISSED } from "@/lib/import/holdReasons";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// READ-ONLY import history. Lists recent ImportBatch records with counts computed LIVE from the
// current ImportRow states, so the totals stay accurate after reconcile actions move rows from held
// -> created (or dismissed). Columns always reconcile to totalRows. Gated behind BARSH_IMPORT_ENABLED.

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
    select: { id: true, source: true, sourceFile: true, actorName: true, status: true, totalRows: true, createdAt: true },
  });

  const ids = batches.map((b) => b.id);

  // Live per-batch, per-outcome counts (self-healing after reconcile-commit / dismiss).
  const grouped = ids.length
    ? await prisma.importRow.groupBy({ by: ["batchId", "outcome"], where: { batchId: { in: ids } }, _count: { _all: true } })
    : [];
  const byBatchOutcome = new Map<string, number>();
  for (const g of grouped) byBatchOutcome.set(`${g.batchId}::${g.outcome}`, g._count._all);

  // Dismissed held rows shouldn't count as "held" (operator chose not to import them).
  const dismissed = ids.length
    ? await prisma.importRow.groupBy({ by: ["batchId"], where: { batchId: { in: ids }, reviewStatus: REVIEW_DISMISSED }, _count: { _all: true } })
    : [];
  const dismissedByBatch = new Map<string, number>();
  for (const d of dismissed) dismissedByBatch.set(d.batchId, d._count._all);

  const n = (batchId: string, outcome: string) => byBatchOutcome.get(`${batchId}::${outcome}`) ?? 0;

  return NextResponse.json({
    ok: true,
    count: batches.length,
    batches: batches.map((b) => {
      const created = n(b.id, "created");
      const dismissedCount = dismissedByBatch.get(b.id) ?? 0;
      // "Held" = rows still needing action or ready to commit (exclude dismissed). Dismissed rows fall
      // into "Other" so the columns always reconcile: Rows = Created + Held + Rejected + Other.
      const held = Math.max(0, n(b.id, "held") - dismissedCount);
      const rejectedCount = n(b.id, "duplicate") + n(b.id, "error");
      const other = Math.max(0, b.totalRows - created - held - rejectedCount);
      return {
        id: b.id,
        source: b.source,
        sourceFile: b.sourceFile,
        actorName: b.actorName,
        status: b.status,
        totalRows: b.totalRows,
        createdCount: created,
        held,
        rejectedCount,
        dismissedCount,
        other,
        createdAt: b.createdAt.toISOString(),
      };
    }),
  });
}
