import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isImportEnabled, IMPORT_DISABLED_MESSAGE } from "@/lib/import/importConfig";
import { parseSheetToObjects } from "@/lib/import/xlsxParse";
import {
  mapCariskRows,
  cariskExtraFields,
  normalizeTin,
  CARISK_STATUS_CREATE,
  CARISK_STATUS_IGNORE,
  CARISK_STATUS_REPORT,
  type StagedCariskMatter,
} from "@/lib/import/cariskAdapter";
import { resolveCarrier, resolveProvider, type ReferenceResolution } from "@/lib/referenceResolution";
import { resolvePatient } from "@/lib/patientResolution";
import { createMattersFromStaged, type CreatableRow } from "@/lib/import/createMatters";
import {
  HOLD_CARRIER_UNMATCHED,
  HOLD_PROVIDER_UNMATCHED,
  HOLD_CASE_TYPE_UNKNOWN,
  HOLD_PATIENT_AMBIGUOUS,
  HOLD_TIN_MISMATCH,
  HOLD_DATA_QUALITY,
  REVIEW_OPEN,
  dataQualityHold,
} from "@/lib/import/holdReasons";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Carisk import CONFIRM (write). Re-parses the sheet server-side, applies Status routing + CIC# dedup,
// resolves carrier/provider(per-row)/patient, creates matters for clean rows, and HOLDS rows needing an
// operator decision (with a sub-reason + persisted staged payload for the reconcile page). Records a
// full per-row ImportBatch for audit + guarded undo. Gated behind BARSH_IMPORT_ENABLED.

export async function POST(request: Request) {
  if (!isImportEnabled()) {
    return NextResponse.json({ ok: false, error: IMPORT_DISABLED_MESSAGE }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const fileBase64 = String(body?.fileBase64 || "");
  const actorName = String(body?.actorName || "").trim() || "Barsh Matters Import";
  const actorEmail = String(body?.actorEmail || "").trim();
  const sourceFile = String(body?.sourceFile || "").trim() || null;
  if (!fileBase64) return NextResponse.json({ ok: false, error: "fileBase64 is required." }, { status: 400 });

  let rows: Record<string, unknown>[];
  try {
    rows = parseSheetToObjects(fileBase64);
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: `Could not parse spreadsheet: ${error?.message || String(error)}` }, { status: 400 });
  }
  const staged = mapCariskRows(rows);

  // Distinct resolutions.
  const carrierMap = new Map<string, ReferenceResolution>();
  for (const c of new Set(staged.map((s) => s.carrier_raw).filter(Boolean))) carrierMap.set(c, await resolveCarrier(c));
  const providerMap = new Map<string, ReferenceResolution>();
  for (const p of new Set(staged.map((s) => s.provider_raw).filter(Boolean))) providerMap.set(p, await resolveProvider(p));

  const cics = Array.from(new Set(staged.map((s) => s.cic_number).filter(Boolean)));
  const existing = cics.length
    ? await prisma.claimIndex.findMany({ where: { cic_number: { in: cics } }, select: { cic_number: true, matter_id: true, display_number: true } })
    : [];
  const existingCics = new Set(existing.map((e) => e.cic_number ?? ""));
  const existingByCic = new Map(existing.map((e) => [e.cic_number ?? "", e]));

  const matchedProviderIds = Array.from(new Set([...providerMap.values()].filter((r) => r.status === "matched").map((r) => (r as any).entityId)));
  const providerInfos = matchedProviderIds.length
    ? await prisma.providerClientInfo.findMany({ where: { referenceEntityId: { in: matchedProviderIds } }, select: { referenceEntityId: true, tin: true } })
    : [];
  const canonicalTin = new Map(providerInfos.map((p) => [p.referenceEntityId, p.tin ? normalizeTin(p.tin) : ""]));

  type Action = {
    rowIndex: number;
    outcome: "created" | "error" | "duplicate" | "held" | "ignored" | "to_report";
    holdReason?: string;
    reason?: string;
    s: StagedCariskMatter;
    carrierEntityId?: string;
    providerEntityId?: string;
    providerDisplayName?: string;
    patientId?: string | null;
  };

  // First pass: routing + error/duplicate + carrier/provider/case-type. Patient resolved in a 2nd pass.
  const seenCic = new Set<string>();
  const actions: Action[] = [];
  const patientStage: Action[] = [];

  for (let rowIndex = 0; rowIndex < staged.length; rowIndex++) {
    const s = staged[rowIndex];
    const dupInFile = s.cic_number ? seenCic.has(s.cic_number) : false;
    if (s.cic_number) seenCic.add(s.cic_number);

    if (s.errors.length) { actions.push({ rowIndex, outcome: "error", reason: s.errors.join(" "), s }); continue; }
    if (s.status === CARISK_STATUS_IGNORE) { actions.push({ rowIndex, outcome: "ignored", reason: "Status 'Submitted'.", s }); continue; }
    if (s.status === CARISK_STATUS_REPORT) { actions.push({ rowIndex, outcome: "to_report", reason: "Status 'Saved Incomplete' — Carisk Management Report.", s }); continue; }
    if (s.status !== CARISK_STATUS_CREATE) { actions.push({ rowIndex, outcome: "error", reason: `Unrecognized Status: "${s.status || "(blank)"}".`, s }); continue; }
    if (s.cic_number && existingCics.has(s.cic_number)) {
      const m = existingByCic.get(s.cic_number);
      actions.push({ rowIndex, outcome: "duplicate", reason: `CIC# already exists as matter ${m?.display_number ?? m?.matter_id}.`, s });
      continue;
    }
    if (dupInFile) { actions.push({ rowIndex, outcome: "duplicate", reason: "Duplicate CIC# within this file.", s }); continue; }

    const carrier = carrierMap.get(s.carrier_raw);
    if (!carrier || carrier.status !== "matched") { actions.push({ rowIndex, outcome: "held", holdReason: HOLD_CARRIER_UNMATCHED, reason: `Carrier not in registry: "${s.carrier_raw}".`, s }); continue; }
    const provider = providerMap.get(s.provider_raw);
    if (!provider || provider.status !== "matched") { actions.push({ rowIndex, outcome: "held", holdReason: HOLD_PROVIDER_UNMATCHED, reason: `Provider not in registry: "${s.provider_raw}".`, s }); continue; }
    if (s.case_type_unknown) { actions.push({ rowIndex, outcome: "held", holdReason: HOLD_CASE_TYPE_UNKNOWN, reason: `Unknown ClaimType: "${s.case_type_raw}".`, s }); continue; }

    // Passed carrier/provider/case-type — patient + tin + data-quality checked next.
    patientStage.push({
      rowIndex,
      outcome: "created",
      s,
      carrierEntityId: (carrier as any).entityId,
      providerEntityId: (provider as any).entityId,
      providerDisplayName: (provider as any).displayName,
    });
  }

  // Patient resolution (distinct) for survivors.
  const patientCache = new Map<string, Awaited<ReturnType<typeof resolvePatient>>>();
  for (const a of patientStage) {
    let pr = patientCache.get(a.s.patient_name);
    if (!pr) { pr = await resolvePatient(a.s.patient_name); patientCache.set(a.s.patient_name, pr); }
    if (pr.status === "suggest") { actions.push({ ...a, outcome: "held", holdReason: HOLD_PATIENT_AMBIGUOUS, reason: "Patient close-matches an existing patient." }); continue; }

    const canon = canonicalTin.get(a.providerEntityId!) || "";
    if (canon && a.s.provider_tin && normalizeTin(canon) !== normalizeTin(a.s.provider_tin)) {
      actions.push({ ...a, outcome: "held", holdReason: HOLD_TIN_MISMATCH, reason: `Provider TIN ${a.s.provider_tin} differs from registry ${canon}.` });
      continue;
    }
    const dq = dataQualityHold(a.s);
    if (dq) { actions.push({ ...a, outcome: "held", holdReason: HOLD_DATA_QUALITY, reason: dq }); continue; }

    actions.push({ ...a, outcome: "created", patientId: pr.status === "exact" ? pr.patientId : null });
  }
  actions.sort((x, y) => x.rowIndex - y.rowIndex);

  // Create clean rows via the shared creator (per-row provider + Carisk extra columns).
  const toCreate: CreatableRow[] = actions
    .filter((a) => a.outcome === "created")
    .map((a) => ({
      key: a.rowIndex,
      staged: a.s,
      carrierEntityId: a.carrierEntityId ?? null,
      patientId: a.patientId ?? null,
      providerEntityId: a.providerEntityId ?? null,
      providerDisplayName: a.providerDisplayName ?? null,
      extra: cariskExtraFields(a.s),
    }));
  const createdResults = await createMattersFromStaged(toCreate);
  const matterIdByRow = new Map<number, number>();
  for (const c of createdResults) matterIdByRow.set(Number(c.key), c.matterId);

  const held = actions.filter((a) => a.outcome === "held");
  const counts = {
    total: staged.length,
    created: createdResults.length,
    duplicates: actions.filter((a) => a.outcome === "duplicate").length,
    errors: actions.filter((a) => a.outcome === "error").length,
    ignored: actions.filter((a) => a.outcome === "ignored").length,
    toReport: actions.filter((a) => a.outcome === "to_report").length,
    held: held.length,
    heldCarrier: held.filter((a) => a.holdReason === HOLD_CARRIER_UNMATCHED).length,
    heldProvider: held.filter((a) => a.holdReason === HOLD_PROVIDER_UNMATCHED).length,
    heldCaseType: held.filter((a) => a.holdReason === HOLD_CASE_TYPE_UNKNOWN).length,
    heldPatient: held.filter((a) => a.holdReason === HOLD_PATIENT_AMBIGUOUS).length,
    heldTin: held.filter((a) => a.holdReason === HOLD_TIN_MISMATCH).length,
    heldDataQuality: held.filter((a) => a.holdReason === HOLD_DATA_QUALITY).length,
  };

  const batch = await prisma.importBatch.create({
    data: {
      source: "carisk",
      sourceFile,
      actorName,
      actorEmail: actorEmail || null,
      status: "committed",
      totalRows: counts.total,
      createdCount: counts.created,
      rejectedCount: counts.duplicates + counts.errors,
      ignoredCount: counts.ignored,
      reportCount: counts.toReport,
      details: {
        held: counts.held,
        heldUnmatchedCarrier: counts.heldCarrier,
        heldProvider: counts.heldProvider,
        heldCaseType: counts.heldCaseType,
        heldPatientAmbiguous: counts.heldPatient,
        heldTin: counts.heldTin,
        heldDataQuality: counts.heldDataQuality,
      },
    },
  });

  await prisma.importRow.createMany({
    data: actions.map((a) => ({
      batchId: batch.id,
      rowIndex: a.rowIndex,
      outcome: a.outcome === "to_report" ? "to_report" : a.outcome,
      reason: a.reason ?? null,
      holdReason: a.outcome === "held" ? a.holdReason ?? null : null,
      reviewStatus: a.outcome === "held" ? REVIEW_OPEN : null,
      staged: a.outcome === "held" ? (a.s as any) : undefined,
      matterId: matterIdByRow.get(a.rowIndex) ?? null,
      fingerprint: a.s.cic_number || a.s.fingerprint || null,
    })),
  });

  return NextResponse.json({
    ok: true,
    source: "carisk",
    writes: true,
    batchId: batch.id,
    summary: counts,
    undoHint: `POST /api/import/undo { "batchId": "${batch.id}" } to reverse this import.`,
  });
}
