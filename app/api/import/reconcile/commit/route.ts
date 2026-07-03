import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isImportEnabled, IMPORT_DISABLED_MESSAGE } from "@/lib/import/importConfig";
import { resolveCarrier, resolveProvider } from "@/lib/referenceResolution";
import { resolvePatient } from "@/lib/patientResolution";
import { createMattersFromStaged, type CreatableRow, type StagedForCreate } from "@/lib/import/createMatters";
import { cariskExtraFields, normalizeTin, type StagedCariskMatter } from "@/lib/import/cariskAdapter";
import { missingStagedFields } from "@/lib/import/validation";
import {
  REVIEW_READY,
  REVIEW_OPEN,
  REVIEW_COMMITTED,
  HOLD_MISSING_FIELD,
  HOLD_CARRIER_UNMATCHED,
  HOLD_PROVIDER_UNMATCHED,
  HOLD_CASE_TYPE_UNKNOWN,
  HOLD_PATIENT_AMBIGUOUS,
  HOLD_TIN_MISMATCH,
  HOLD_DATA_QUALITY,
  dataQualityHold,
} from "@/lib/import/holdReasons";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Commit fixed ("ready") held rows into matters in-place (no re-upload). Source-aware:
//   - Dow: provider is the one the operator picked for the batch (batch.details.providerEntityId).
//   - Carisk: provider is resolved per-row from the sheet; carisk-specific columns are merged; the
//     resolved case_type / accepted TIN are applied.
// Every row is re-validated so the original safety invariants hold: carrier (and Carisk provider)
// must still resolve; an ambiguous patient with no decision is re-held; a still-flagged case-type,
// TIN, or data-quality row with no acceptance is re-held. Flag-gated.

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
    select: { id: true, batchId: true, staged: true, holdReason: true, resolution: true, batch: { select: { source: true, details: true } } },
  });

  if (ready.length === 0) {
    return NextResponse.json({ ok: true, created: 0, note: "No ready rows to commit.", reheld: 0, skipped: 0 });
  }

  // Batch-level provider: Dow (always) and Other batches where the operator picked a fixed provider.
  const batchProviderIdByBatch = new Map<string, string>();
  for (const r of ready) {
    const det = (r.batch?.details ?? {}) as any;
    if (r.batch?.source === "dow" || (r.batch?.source === "other" && det.fixedProvider)) {
      batchProviderIdByBatch.set(r.batchId, String(det.providerEntityId || ""));
    }
  }
  const batchProviderIds = Array.from(new Set([...batchProviderIdByBatch.values()].filter(Boolean)));
  const batchProviders = batchProviderIds.length
    ? await prisma.referenceEntity.findMany({ where: { id: { in: batchProviderIds }, type: "provider_client" }, select: { id: true, displayName: true } })
    : [];
  const batchProviderById = new Map(batchProviders.map((p) => [p.id, p]));

  const canonicalTinCache = new Map<string, string>(); // providerEntityId -> normalized canonical TIN

  let reheld = 0;
  let skipped = 0;
  const creatables: { rowId: string; batchId: string; create: CreatableRow }[] = [];

  const rehold = async (id: string, holdReason: string, reason: string) => {
    await prisma.importRow.update({ where: { id }, data: { holdReason, reviewStatus: REVIEW_OPEN, reason } });
    reheld++;
  };

  for (const r of ready) {
    const source = r.batch?.source ?? "dow";
    const staged = (r.staged ?? {}) as StagedForCreate & Partial<StagedCariskMatter> & { carrier_raw?: string; patient_name: string };
    const res = (r.resolution ?? {}) as any;

    // 0) Required fields must all be present (missing_field rows are patched via resolve-missing).
    const stillMissing = missingStagedFields(staged as Record<string, unknown>, source);
    if (stillMissing.length) { await rehold(r.id, HOLD_MISSING_FIELD, `Still missing: ${stillMissing.map((m) => m.label).join(", ")}.`); continue; }

    // 1) Carrier must resolve.
    const carrier = await resolveCarrier(String(staged.carrier_raw ?? ""));
    if (carrier.status !== "matched") { await rehold(r.id, HOLD_CARRIER_UNMATCHED, "Carrier still not in registry."); continue; }

    // 2) Provider: batch-level (Dow, or Other with a fixed provider) vs per-row resolve (Carisk, or
    // Other without a fixed provider — resolve from the row's mapped provider name).
    let providerEntityId: string | null = null;
    let providerDisplayName: string | null = null;
    const batchPid = batchProviderIdByBatch.get(r.batchId) || "";
    if (batchPid) {
      const p = batchProviderById.get(batchPid);
      if (!p) { skipped++; continue; }
      providerEntityId = p.id;
      providerDisplayName = p.displayName;
    } else {
      const prov = await resolveProvider(String(staged.provider_raw ?? ""));
      if (prov.status !== "matched") { await rehold(r.id, HOLD_PROVIDER_UNMATCHED, "Provider still not in registry."); continue; }
      providerEntityId = (prov as any).entityId;
      providerDisplayName = (prov as any).displayName;
    }

    // 3) Case type — unknown-value resolution (Carisk ClaimType / Other mapped case type).
    let caseTypeOverride: string | undefined;
    if ((source === "carisk" || source === "other") && (staged as any).case_type_unknown) {
      const chosen = String(res.caseType || "");
      if (!chosen) { await rehold(r.id, HOLD_CASE_TYPE_UNKNOWN, "Case type still unresolved."); continue; }
      caseTypeOverride = chosen;
    }

    // 4) Patient.
    let patientId: string | null = null;
    if (res.patient === "link" && res.patientId) patientId = String(res.patientId);
    else if (res.patient === "new") patientId = null;
    else {
      const pr = await resolvePatient(staged.patient_name);
      if (pr.status === "exact") patientId = pr.patientId;
      else if (pr.status === "new") patientId = null;
      else { await rehold(r.id, HOLD_PATIENT_AMBIGUOUS, "Patient became ambiguous — confirm same person or new."); continue; }
    }

    // 5) TIN mismatch (Carisk) — unless operator accepted.
    if (source === "carisk" && res.tin !== "accept" && providerEntityId && staged.provider_tin) {
      let canon = canonicalTinCache.get(providerEntityId);
      if (canon === undefined) {
        const info = await prisma.providerClientInfo.findUnique({ where: { referenceEntityId: providerEntityId }, select: { tin: true } });
        canon = info?.tin ? normalizeTin(info.tin) : "";
        canonicalTinCache.set(providerEntityId, canon);
      }
      if (canon && normalizeTin(String(staged.provider_tin)) !== canon) {
        await rehold(r.id, HOLD_TIN_MISMATCH, `Provider TIN ${staged.provider_tin} differs from registry ${canon}.`);
        continue;
      }
    }

    // 6) Data quality — unless operator accepted.
    if (res.dataQuality !== "accept") {
      const dq = dataQualityHold(staged);
      if (dq) { await rehold(r.id, HOLD_DATA_QUALITY, dq); continue; }
    }

    const extra = source === "carisk"
      ? { ...cariskExtraFields(staged as StagedCariskMatter), ...(caseTypeOverride ? { case_type: caseTypeOverride } : {}) }
      : undefined;

    creatables.push({
      rowId: r.id,
      batchId: r.batchId,
      create: { key: r.id, staged, carrierEntityId: carrier.entityId, patientId, providerEntityId, providerDisplayName, extra },
    });
  }

  // Create all (each row carries its own provider) in one allocation, then mark committed + bump counts.
  let created = 0;
  if (creatables.length) {
    const results = await createMattersFromStaged(creatables.map((c) => c.create));
    const matterByRowId = new Map(results.map((res) => [String(res.key), res.matterId]));
    const createdPerBatch = new Map<string, number>();
    for (const c of creatables) {
      const matterId = matterByRowId.get(c.rowId) ?? null;
      await prisma.importRow.update({
        where: { id: c.rowId },
        data: { outcome: "created", reviewStatus: REVIEW_COMMITTED, holdReason: null, matterId, reason: null },
      });
      createdPerBatch.set(c.batchId, (createdPerBatch.get(c.batchId) ?? 0) + 1);
    }
    created = creatables.length;
    for (const [batchId, n] of createdPerBatch) {
      await prisma.importBatch.update({ where: { id: batchId }, data: { createdCount: { increment: n } } });
    }
  }

  return NextResponse.json({
    ok: true,
    created,
    reheld,
    skipped,
    note: "Committed ready rows into matters. Any rows that failed re-validation were returned to the queue.",
  });
}
