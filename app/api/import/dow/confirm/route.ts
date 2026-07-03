import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isImportEnabled, IMPORT_DISABLED_MESSAGE } from "@/lib/import/importConfig";
import { parseSheetToObjects } from "@/lib/import/xlsxParse";
import { mapDowRows } from "@/lib/import/dowAdapter";
import { resolveCarrier, type ReferenceResolution } from "@/lib/referenceResolution";
import { resolvePatient } from "@/lib/patientResolution";
import { createMattersFromStaged, type CreatableRow } from "@/lib/import/createMatters";
import {
  HOLD_CARRIER_UNMATCHED,
  HOLD_PATIENT_AMBIGUOUS,
  HOLD_DATA_QUALITY,
  REVIEW_OPEN,
  dataQualityHold,
} from "@/lib/import/holdReasons";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Dow import CONFIRM (write). Re-parses the sheet server-side (never trusts client-sent staged data),
// re-runs mapping/resolution, and creates matters for clean rows only. Rows that need an operator
// decision are HELD (with a sub-reason) and persisted with their staged payload so they can be fixed
// and created later on the reconcile page. Records a full per-row ImportBatch for audit + guarded undo.
// Gated behind BARSH_IMPORT_ENABLED.
//
// Row routing (in order):
//   error (validation)            -> skipped, outcome "error"
//   duplicate (existing / in-file)-> skipped, outcome "duplicate"
//   carrier not in registry       -> HELD (carrier_unmatched)
//   patient ambiguous (fuzzy)     -> HELD (patient_ambiguous)   [never auto-links, never auto-creates]
//   data-quality flag             -> HELD (data_quality)
//   otherwise                     -> created

export async function POST(request: Request) {
  if (!isImportEnabled()) {
    return NextResponse.json({ ok: false, error: IMPORT_DISABLED_MESSAGE }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const fileBase64 = String(body?.fileBase64 || "");
  const providerEntityId = String(body?.providerEntityId || "");
  const actorName = String(body?.actorName || "").trim() || "Barsh Matters Import";
  const actorEmail = String(body?.actorEmail || "").trim();
  const sourceFile = String(body?.sourceFile || "").trim() || null;

  if (!fileBase64) return NextResponse.json({ ok: false, error: "fileBase64 is required." }, { status: 400 });
  if (!providerEntityId) {
    return NextResponse.json({ ok: false, error: "providerEntityId is required (select the provider)." }, { status: 400 });
  }

  const provider = await prisma.referenceEntity.findUnique({
    where: { id: providerEntityId },
    select: { id: true, displayName: true, type: true },
  });
  if (!provider || provider.type !== "provider_client") {
    return NextResponse.json({ ok: false, error: "providerEntityId is not a valid provider_client entity." }, { status: 400 });
  }

  let rows: Record<string, unknown>[];
  try {
    rows = parseSheetToObjects(fileBase64);
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: `Could not parse spreadsheet: ${error?.message || String(error)}` }, { status: 400 });
  }
  const staged = mapDowRows(rows);

  // Resolve distinct carriers once.
  const carrierMap = new Map<string, ReferenceResolution>();
  for (const c of new Set(staged.map((s) => s.carrier_raw).filter(Boolean))) carrierMap.set(c, await resolveCarrier(c));

  // Existing-fingerprint duplicates (batch query).
  const fingerprints = Array.from(new Set(staged.map((s) => s.fingerprint).filter(Boolean)));
  const existing = fingerprints.length
    ? await prisma.claimIndex.findMany({ where: { fingerprint: { in: fingerprints } }, select: { fingerprint: true } })
    : [];
  const existingFps = new Set(existing.map((e) => e.fingerprint ?? ""));

  // Pass 1: error / duplicate / carrier. Rows that survive reach the patient + data-quality stage.
  type Action = {
    rowIndex: number;
    outcome: "created" | "error" | "duplicate" | "held";
    holdReason?: string;
    reason?: string;
    s: (typeof staged)[number];
    carrierEntityId?: string | null;
    patientId?: string | null;
  };
  const seen = new Set<string>();
  const actions: Action[] = [];
  const patientStage: { rowIndex: number; s: (typeof staged)[number]; carrierEntityId: string }[] = [];

  staged.forEach((s, rowIndex) => {
    if (s.errors.length) return void actions.push({ rowIndex, outcome: "error", reason: s.errors.join(" "), s });
    if (s.fingerprint && existingFps.has(s.fingerprint)) return void actions.push({ rowIndex, outcome: "duplicate", reason: "Matches an existing matter (fingerprint).", s });
    if (s.fingerprint && seen.has(s.fingerprint)) return void actions.push({ rowIndex, outcome: "duplicate", reason: "Duplicate within this file.", s });
    if (s.fingerprint) seen.add(s.fingerprint);
    const carrier = carrierMap.get(s.carrier_raw);
    if (!carrier || carrier.status !== "matched") {
      return void actions.push({ rowIndex, outcome: "held", holdReason: HOLD_CARRIER_UNMATCHED, reason: `Carrier not in registry: "${s.carrier_raw}".`, s });
    }
    patientStage.push({ rowIndex, s, carrierEntityId: carrier.entityId });
  });

  // Resolve distinct patient names once for the surviving rows.
  const patientResById = new Map<number, Awaited<ReturnType<typeof resolvePatient>>>();
  {
    const cache = new Map<string, Awaited<ReturnType<typeof resolvePatient>>>();
    for (const p of patientStage) {
      let res = cache.get(p.s.patient_name);
      if (!res) {
        res = await resolvePatient(p.s.patient_name);
        cache.set(p.s.patient_name, res);
      }
      patientResById.set(p.rowIndex, res);
    }
  }

  // Pass 2: patient -> data-quality -> created.
  for (const p of patientStage) {
    const pr = patientResById.get(p.rowIndex)!;
    if (pr.status === "suggest") {
      actions.push({ rowIndex: p.rowIndex, outcome: "held", holdReason: HOLD_PATIENT_AMBIGUOUS, reason: "Patient name is a close match to an existing patient — confirm same person or new.", s: p.s, carrierEntityId: p.carrierEntityId });
      continue;
    }
    const dq = dataQualityHold(p.s);
    if (dq) {
      actions.push({ rowIndex: p.rowIndex, outcome: "held", holdReason: HOLD_DATA_QUALITY, reason: dq, s: p.s, carrierEntityId: p.carrierEntityId });
      continue;
    }
    actions.push({
      rowIndex: p.rowIndex,
      outcome: "created",
      s: p.s,
      carrierEntityId: p.carrierEntityId,
      patientId: pr.status === "exact" ? pr.patientId : null, // null => create new patient
    });
  }
  actions.sort((a, b) => a.rowIndex - b.rowIndex);

  // Create matters for "created" rows via the shared helper.
  const toCreate: CreatableRow[] = actions
    .filter((a) => a.outcome === "created")
    .map((a) => ({ key: a.rowIndex, staged: a.s, carrierEntityId: a.carrierEntityId ?? null, patientId: a.patientId ?? null }));
  const createdResults = await createMattersFromStaged(toCreate, { id: provider.id, displayName: provider.displayName });
  const matterIdByRow = new Map<number, number>();
  for (const c of createdResults) matterIdByRow.set(Number(c.key), c.matterId);

  const counts = {
    total: staged.length,
    created: createdResults.length,
    duplicates: actions.filter((a) => a.outcome === "duplicate").length,
    errors: actions.filter((a) => a.outcome === "error").length,
    held: actions.filter((a) => a.outcome === "held").length,
    heldCarrier: actions.filter((a) => a.holdReason === HOLD_CARRIER_UNMATCHED).length,
    heldPatient: actions.filter((a) => a.holdReason === HOLD_PATIENT_AMBIGUOUS).length,
    heldDataQuality: actions.filter((a) => a.holdReason === HOLD_DATA_QUALITY).length,
  };

  // Full per-row batch record. Held rows persist their staged payload + sub-reason + review lifecycle.
  const batch = await prisma.importBatch.create({
    data: {
      source: "dow",
      sourceFile,
      actorName,
      actorEmail: actorEmail || null,
      status: "committed",
      totalRows: counts.total,
      createdCount: counts.created,
      rejectedCount: counts.duplicates + counts.errors,
      ignoredCount: 0,
      reportCount: 0,
      details: {
        providerEntityId: provider.id,
        providerName: provider.displayName,
        heldUnmatchedCarrier: counts.heldCarrier,
        heldPatientAmbiguous: counts.heldPatient,
        heldDataQuality: counts.heldDataQuality,
        held: counts.held,
      },
    },
  });

  await prisma.importRow.createMany({
    data: actions.map((a) => ({
      batchId: batch.id,
      rowIndex: a.rowIndex,
      outcome: a.outcome,
      reason: a.reason ?? null,
      holdReason: a.outcome === "held" ? a.holdReason ?? null : null,
      reviewStatus: a.outcome === "held" ? REVIEW_OPEN : null,
      staged: a.outcome === "held" ? (a.s as any) : undefined,
      matterId: matterIdByRow.get(a.rowIndex) ?? null,
      fingerprint: a.s.fingerprint || null,
    })),
  });

  return NextResponse.json({
    ok: true,
    source: "dow",
    writes: true,
    batchId: batch.id,
    provider: provider.displayName,
    summary: counts,
    undoHint: `POST /api/import/undo { "batchId": "${batch.id}" } to reverse this import.`,
  });
}
