import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isImportEnabled, IMPORT_DISABLED_MESSAGE } from "@/lib/import/importConfig";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GUARDED UNDO of an import batch (any source). Removes ONLY matters that are still UNTOUCHED since
// import — not aggregated into a lawsuit and not closed/edited. Touched matters are kept and reported.
// Flag-gated (BARSH_IMPORT_ENABLED). NOTE: Owner/Admin enforcement will attach with the RBAC rollout;
// for now it is protected by the import kill-switch (used for test-data cleanup).

export async function POST(request: Request) {
  if (!isImportEnabled()) {
    return NextResponse.json({ ok: false, error: IMPORT_DISABLED_MESSAGE }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const batchId = String(body?.batchId || "");
  const actorName = String(body?.actorName || "").trim() || "Barsh Matters Import Undo";
  if (!batchId) return NextResponse.json({ ok: false, error: "batchId is required." }, { status: 400 });

  const batch = await prisma.importBatch.findUnique({ where: { id: batchId } });
  if (!batch) return NextResponse.json({ ok: false, error: "No such import batch." }, { status: 404 });
  if (batch.status === "undone") {
    return NextResponse.json({ ok: false, error: "This batch was already undone." }, { status: 409 });
  }

  // Matters this batch created.
  const createdRows = await prisma.importRow.findMany({
    where: { batchId, outcome: "created", matterId: { not: null } },
    select: { matterId: true },
  });
  const matterIds = createdRows.map((r) => r.matterId as number);

  if (matterIds.length === 0) {
    await prisma.importBatch.update({ where: { id: batchId }, data: { status: "undone", details: { ...(batch.details as object), undo: { removed: 0, kept: 0, actorName } } } });
    return NextResponse.json({ ok: true, batchId, removed: 0, kept: 0, note: "Batch created no matters." });
  }

  // Only remove UNTOUCHED matters: not aggregated (master_lawsuit_id null) and not closed.
  const current = await prisma.claimIndex.findMany({
    where: { matter_id: { in: matterIds } },
    select: { matter_id: true, master_lawsuit_id: true, final_status: true, close_reason: true },
  });

  const untouched: number[] = [];
  const kept: { matterId: number; reason: string }[] = [];
  for (const m of current) {
    const aggregated = !!(m.master_lawsuit_id && String(m.master_lawsuit_id).trim());
    const closed = String(m.final_status || "").toLowerCase() === "closed" || !!(m.close_reason && String(m.close_reason).trim());
    if (aggregated) kept.push({ matterId: m.matter_id, reason: "Aggregated into a lawsuit." });
    else if (closed) kept.push({ matterId: m.matter_id, reason: "Matter was closed/edited." });
    else untouched.push(m.matter_id);
  }

  let removed = 0;
  if (untouched.length) {
    const res = await prisma.claimIndex.deleteMany({ where: { matter_id: { in: untouched } } });
    removed = res.count;
  }

  await prisma.importBatch.update({
    where: { id: batchId },
    data: {
      status: "undone",
      details: { ...((batch.details as object) ?? {}), undo: { removed, kept: kept.length, keptDetail: kept, actorName, at: new Date().toISOString() } },
    },
  });

  return NextResponse.json({
    ok: true,
    batchId,
    removed,
    kept: kept.length,
    keptDetail: kept,
    note: kept.length ? "Kept matters that were aggregated or closed since import." : "All created matters were untouched and removed.",
  });
}
