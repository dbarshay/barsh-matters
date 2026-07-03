import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isImportEnabled, IMPORT_DISABLED_MESSAGE } from "@/lib/import/importConfig";
import { parseSheetToObjects } from "@/lib/import/xlsxParse";
import { mapOtherRows, otherExtraFields, type OtherMapping, type OtherFixed, type StagedOtherMatter } from "@/lib/import/otherAdapter";
import { resolveCarrier, type ReferenceResolution } from "@/lib/referenceResolution";
import { resolvePatient } from "@/lib/patientResolution";
import { createMattersFromStaged, type CreatableRow } from "@/lib/import/createMatters";
import {
  HOLD_MISSING_FIELD, HOLD_CARRIER_UNMATCHED, HOLD_CASE_TYPE_UNKNOWN,
  HOLD_PATIENT_AMBIGUOUS, HOLD_DATA_QUALITY, REVIEW_OPEN, dataQualityHold,
} from "@/lib/import/holdReasons";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Generic-spreadsheet CONFIRM (write). Re-parses + re-maps server-side, resolves carrier/provider
// (per-row unless the operator picked a fixed provider)/patient, dedups on fingerprint, creates clean
// rows, and holds the rest with a sub-reason + persisted staged payload. Records a source="other"
// batch (storing the fixed provider, if any, for reconcile-commit). Flag-gated.

export async function POST(request: Request) {
  if (!isImportEnabled()) return NextResponse.json({ ok: false, error: IMPORT_DISABLED_MESSAGE }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const fileBase64 = String(body?.fileBase64 || "");
  const mapping = (body?.mapping ?? {}) as OtherMapping;
  const fixed = (body?.fixed ?? {}) as OtherFixed;
  const actorName = String(body?.actorName || "").trim() || "Barsh Matters Import";
  const sourceFile = String(body?.sourceFile || "").trim() || null;
  if (!fileBase64) return NextResponse.json({ ok: false, error: "fileBase64 is required." }, { status: 400 });

  // Provider is always operator-picked under Import OTHERS (never parsed).
  if (!fixed.providerEntityId) return NextResponse.json({ ok: false, error: "Pick a Provider/Client." }, { status: 400 });
  const p = await prisma.referenceEntity.findUnique({ where: { id: fixed.providerEntityId }, select: { id: true, displayName: true, type: true } });
  if (!p || p.type !== "provider_client") return NextResponse.json({ ok: false, error: "Picked provider is not a valid provider_client entity." }, { status: 400 });
  const fixedProvider = { id: p.id, displayName: p.displayName };

  let rows: Record<string, unknown>[];
  try {
    rows = parseSheetToObjects(fileBase64);
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: `Could not parse spreadsheet: ${error?.message || String(error)}` }, { status: 400 });
  }
  const staged = mapOtherRows(rows, mapping, { ...fixed, providerDisplayName: fixedProvider?.displayName });

  const carrierMap = new Map<string, ReferenceResolution>();
  for (const c of new Set(staged.map((s) => s.carrier_raw).filter(Boolean))) carrierMap.set(c, await resolveCarrier(c));

  const fingerprints = Array.from(new Set(staged.map((s) => s.fingerprint).filter(Boolean)));
  const existing = fingerprints.length
    ? await prisma.claimIndex.findMany({ where: { fingerprint: { in: fingerprints } }, select: { fingerprint: true } })
    : [];
  const existingFps = new Set(existing.map((e) => e.fingerprint ?? ""));

  type Action = {
    rowIndex: number; outcome: "created" | "duplicate" | "held"; holdReason?: string; reason?: string;
    s: StagedOtherMatter; carrierEntityId?: string; providerEntityId?: string; providerDisplayName?: string; patientId?: string | null;
  };
  const seen = new Set<string>();
  const actions: Action[] = [];
  const patientStage: Action[] = [];

  for (let rowIndex = 0; rowIndex < staged.length; rowIndex++) {
    const s = staged[rowIndex];
    const dupInFile = s.fingerprint ? seen.has(s.fingerprint) : false;
    if (s.fingerprint) seen.add(s.fingerprint);

    if (s.errors.length) { actions.push({ rowIndex, outcome: "held", holdReason: HOLD_MISSING_FIELD, reason: s.errors.join(" "), s }); continue; }
    if (s.fingerprint && existingFps.has(s.fingerprint)) { actions.push({ rowIndex, outcome: "duplicate", reason: "Matches an existing matter (fingerprint).", s }); continue; }
    if (dupInFile) { actions.push({ rowIndex, outcome: "duplicate", reason: "Duplicate within this file.", s }); continue; }

    const carrier = carrierMap.get(s.carrier_raw);
    if (!carrier || carrier.status !== "matched") { actions.push({ rowIndex, outcome: "held", holdReason: HOLD_CARRIER_UNMATCHED, reason: `Carrier not in registry: "${s.carrier_raw}".`, s }); continue; }
    if (s.case_type_unknown) { actions.push({ rowIndex, outcome: "held", holdReason: HOLD_CASE_TYPE_UNKNOWN, reason: `Unknown case type: "${s.case_type_raw}".`, s }); continue; }

    // Provider is the operator's fixed pick (Import OTHERS never parses it).
    patientStage.push({ rowIndex, outcome: "created", s, carrierEntityId: (carrier as any).entityId, providerEntityId: fixedProvider.id, providerDisplayName: fixedProvider.displayName });
  }

  const patientCache = new Map<string, Awaited<ReturnType<typeof resolvePatient>>>();
  for (const a of patientStage) {
    let pr = patientCache.get(a.s.patient_name);
    if (!pr) { pr = await resolvePatient(a.s.patient_name); patientCache.set(a.s.patient_name, pr); }
    if (pr.status === "suggest") { actions.push({ ...a, outcome: "held", holdReason: HOLD_PATIENT_AMBIGUOUS, reason: "Patient close-matches an existing patient." }); continue; }
    const dq = dataQualityHold(a.s);
    if (dq) { actions.push({ ...a, outcome: "held", holdReason: HOLD_DATA_QUALITY, reason: dq }); continue; }
    actions.push({ ...a, outcome: "created", patientId: pr.status === "exact" ? pr.patientId : null });
  }
  actions.sort((x, y) => x.rowIndex - y.rowIndex);

  const toCreate: CreatableRow[] = actions.filter((a) => a.outcome === "created").map((a) => ({
    key: a.rowIndex, staged: a.s, carrierEntityId: a.carrierEntityId ?? null, patientId: a.patientId ?? null,
    providerEntityId: a.providerEntityId ?? null, providerDisplayName: a.providerDisplayName ?? null, extra: otherExtraFields(a.s),
  }));
  const createdResults = await createMattersFromStaged(toCreate);
  const matterIdByRow = new Map<number, number>();
  for (const c of createdResults) matterIdByRow.set(Number(c.key), c.matterId);

  const held = actions.filter((a) => a.outcome === "held");
  const counts = {
    total: staged.length, created: createdResults.length,
    duplicates: actions.filter((a) => a.outcome === "duplicate").length,
    held: held.length,
    heldMissing: held.filter((a) => a.holdReason === HOLD_MISSING_FIELD).length,
    heldCarrier: held.filter((a) => a.holdReason === HOLD_CARRIER_UNMATCHED).length,
    heldCaseType: held.filter((a) => a.holdReason === HOLD_CASE_TYPE_UNKNOWN).length,
    heldPatient: held.filter((a) => a.holdReason === HOLD_PATIENT_AMBIGUOUS).length,
    heldDataQuality: held.filter((a) => a.holdReason === HOLD_DATA_QUALITY).length,
  };

  const batch = await prisma.importBatch.create({
    data: {
      source: "other", sourceFile, actorName, status: "committed",
      totalRows: counts.total, createdCount: counts.created, rejectedCount: counts.duplicates,
      details: {
        held: counts.held, heldMissing: counts.heldMissing, heldUnmatchedCarrier: counts.heldCarrier,
        heldCaseType: counts.heldCaseType, heldPatientAmbiguous: counts.heldPatient, heldDataQuality: counts.heldDataQuality,
        providerEntityId: fixedProvider.id, providerName: fixedProvider.displayName, fixedProvider: true,
      },
    },
  });

  await prisma.importRow.createMany({
    data: actions.map((a) => ({
      batchId: batch.id, rowIndex: a.rowIndex, outcome: a.outcome, reason: a.reason ?? null,
      holdReason: a.outcome === "held" ? a.holdReason ?? null : null,
      reviewStatus: a.outcome === "held" ? REVIEW_OPEN : null,
      staged: a.outcome === "held" ? (a.s as any) : undefined,
      matterId: matterIdByRow.get(a.rowIndex) ?? null,
      fingerprint: a.s.fingerprint || null,
    })),
  });

  return NextResponse.json({ ok: true, source: "other", writes: true, batchId: batch.id, summary: counts });
}
