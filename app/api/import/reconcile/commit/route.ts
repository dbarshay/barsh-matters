import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isImportEnabled, IMPORT_DISABLED_MESSAGE } from "@/lib/import/importConfig";
import { resolveCarrier } from "@/lib/referenceResolution";
import { resolvePatient } from "@/lib/patientResolution";
import { createMattersFromStaged, type CreatableRow, type StagedForCreate } from "@/lib/import/createMatters";
import {
  REVIEW_READY,
  REVIEW_OPEN,
  REVIEW_COMMITTED,
  HOLD_PATIENT_AMBIGUOUS,
  HOLD_DATA_QUALITY,
  dataQualityHold,
} from "@/lib/import/holdReasons";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Commit fixed ("ready") held rows into matters, in-place (no re-upload). Operator passes the specific
// rowIds to commit (or {all:true} for every ready row). Each row is re-validated at commit so the same
// safety invariants as the original import hold: carrier must still resolve; an ambiguous patient with
// no operator decision is re-held as patient_ambiguous (never auto-created); a still-flagged data-
// quality row with no acceptance is re-held as data_quality. Rows are grouped by their batch's provider
// so created matters keep the correct provider. Flag-gated.

export async function POST(request: Request) {
  if (!isImportEnabled()) {
    return NextResponse.json({ ok: false, error: IMPORT_DISABLED_MESSAGE }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const all = body?.all === true;
  const rowIds: string[] = Array.isArray(body?.rowIds) ? body.rowIds.map((x: unknown) => String(x)) : [];
  if (!all && rowIds.length === 0) {
    return NextResponse.json({ ok: false, error: "Provide rowIds[] or all:true." }, { status: 400 });
  }

  const ready = await prisma.importRow.findMany({
    where: {
      outcome: "held",
      reviewStatus: REVIEW_READY,
      ...(all ? {} : { id: { in: rowIds } }),
      batch: { is: { status: { not: "undone" } } },
    },
    select: { id: true, batchId: true, staged: true, holdReason: true, resolution: true },
  });
  type ReadyRow = (typeof ready)[number];

  if (ready.length === 0) {
    return NextResponse.json({ ok: true, created: 0, note: "No ready rows to commit.", movedToPatient: 0, movedToData: 0, skippedCarrier: 0 });
  }

  // Load each involved batch's provider once.
  const batchIds = Array.from(new Set(ready.map((r) => r.batchId)));
  const batches = await prisma.importBatch.findMany({ where: { id: { in: batchIds } }, select: { id: true, details: true } });
  const providerIdByBatch = new Map<string, string>();
  for (const b of batches) providerIdByBatch.set(b.id, String(((b.details ?? {}) as any).providerEntityId || ""));
  const providerEntityIds = Array.from(new Set([...providerIdByBatch.values()].filter(Boolean)));
  const providers = await prisma.referenceEntity.findMany({ where: { id: { in: providerEntityIds }, type: "provider_client" }, select: { id: true, displayName: true } });
  const providerById = new Map(providers.map((p) => [p.id, p]));

  let movedToPatient = 0;
  let movedToData = 0;
  let skippedCarrier = 0;

  // Bucket creatable rows per batch (each needs its own provider).
  const creatableByBatch = new Map<string, { row: ReadyRow; create: CreatableRow }[]>();

  for (const r of ready) {
    const staged = (r.staged ?? {}) as StagedForCreate & { carrier_raw?: string; patient_name?: string };
    const carrierRaw = String((staged as any).carrier_raw ?? "");

    // 1) Carrier must resolve now.
    const carrier = await resolveCarrier(carrierRaw);
    if (carrier.status !== "matched") {
      skippedCarrier++;
      continue; // stays ready; operator still needs to map the carrier
    }

    // 2) Patient decision.
    let patientId: string | null = null;
    const res = (r.resolution ?? {}) as any;
    if (res.patient === "link" && res.patientId) {
      patientId = String(res.patientId);
    } else if (res.patient === "new") {
      patientId = null; // create new at insert
    } else {
      // No explicit patient decision (carrier/data holds) -> re-resolve and never auto-create ambiguous.
      const pr = await resolvePatient(staged.patient_name);
      if (pr.status === "exact") patientId = pr.patientId;
      else if (pr.status === "new") patientId = null;
      else {
        // suggest -> re-hold for patient review
        await prisma.importRow.update({
          where: { id: r.id },
          data: { holdReason: HOLD_PATIENT_AMBIGUOUS, reviewStatus: REVIEW_OPEN, reason: "Patient became ambiguous — confirm same person or new.", resolution: undefined as any },
        });
        movedToPatient++;
        continue;
      }
    }

    // 3) Data-quality (skip if operator already accepted a data hold).
    const acceptedData = r.holdReason === HOLD_DATA_QUALITY && res.dataQuality === "accept";
    if (!acceptedData) {
      const dq = dataQualityHold(staged);
      if (dq) {
        await prisma.importRow.update({
          where: { id: r.id },
          data: { holdReason: HOLD_DATA_QUALITY, reviewStatus: REVIEW_OPEN, reason: dq },
        });
        movedToData++;
        continue;
      }
    }

    const create: CreatableRow = { key: r.id, staged, carrierEntityId: carrier.entityId, patientId };
    const list = creatableByBatch.get(r.batchId) ?? [];
    list.push({ row: r, create });
    creatableByBatch.set(r.batchId, list);
  }

  // Create per batch (correct provider), then mark rows committed + bump batch counts.
  let created = 0;
  const skippedNoProvider: string[] = [];
  for (const [batchId, items] of creatableByBatch) {
    const providerId = providerIdByBatch.get(batchId) || "";
    const provider = providerId ? providerById.get(providerId) : undefined;
    if (!provider) {
      skippedNoProvider.push(batchId);
      continue;
    }
    const results = await createMattersFromStaged(items.map((it) => it.create), { id: provider.id, displayName: provider.displayName });
    const matterByRowId = new Map(results.map((res) => [String(res.key), res.matterId]));
    for (const it of items) {
      const matterId = matterByRowId.get(it.row.id) ?? null;
      await prisma.importRow.update({
        where: { id: it.row.id },
        data: { outcome: "created", reviewStatus: REVIEW_COMMITTED, holdReason: null, matterId, reason: null },
      });
    }
    created += results.length;
    await prisma.importBatch.update({ where: { id: batchId }, data: { createdCount: { increment: results.length } } });
  }

  return NextResponse.json({
    ok: true,
    created,
    movedToPatient,
    movedToData,
    skippedCarrier,
    skippedNoProvider: skippedNoProvider.length,
    note: "Committed ready rows into matters. Any re-held rows returned to the reconcile queue.",
  });
}
