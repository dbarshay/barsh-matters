import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isImportEnabled, IMPORT_DISABLED_MESSAGE } from "@/lib/import/importConfig";
import { parseSheetToObjects } from "@/lib/import/xlsxParse";
import { mapDowRows } from "@/lib/import/dowAdapter";
import { resolveCarrier, type ReferenceResolution } from "@/lib/referenceResolution";
import { resolvePatient, createPatient } from "@/lib/patientResolution";
import { allocateMatterNumbers } from "@/lib/matterNumbering";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Dow import CONFIRM (write). Re-parses the sheet server-side (never trusts client-sent staged data),
// re-runs mapping/resolution, and creates matters for "ready" rows only. Records a full per-row
// ImportBatch for audit + guarded undo. Gated behind BARSH_IMPORT_ENABLED.
//
// Row routing:
//   error (validation)            -> skipped, outcome "error"
//   duplicate (existing / in-file)-> skipped, outcome "duplicate"
//   carrier not in registry       -> HELD, outcome "held" (Owner must add the carrier first)
//   otherwise                     -> created
//
// Patient: exact -> link; no-match/new -> create; ambiguous (suggest) -> create NEW (safe default;
// never a wrong auto-link — duplicates can be merged later). Not wrapped in one giant transaction
// (would exceed Prisma's interactive-tx timeout on large files); the batch record + undo cover recovery.

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

  // Resolve distinct carriers + patients once.
  const carrierMap = new Map<string, ReferenceResolution>();
  for (const c of new Set(staged.map((s) => s.carrier_raw).filter(Boolean))) carrierMap.set(c, await resolveCarrier(c));

  // Existing-fingerprint duplicates (batch query) + fetch matched carrier display names.
  const fingerprints = Array.from(new Set(staged.map((s) => s.fingerprint).filter(Boolean)));
  const existing = fingerprints.length
    ? await prisma.claimIndex.findMany({ where: { fingerprint: { in: fingerprints } }, select: { fingerprint: true } })
    : [];
  const existingFps = new Set(existing.map((e) => e.fingerprint ?? ""));

  const carrierNameById = new Map<string, string>();
  {
    const ids = Array.from(new Set([...carrierMap.values()].filter((r) => r.status === "matched").map((r) => (r as any).entityId)));
    if (ids.length) {
      const ents = await prisma.referenceEntity.findMany({ where: { id: { in: ids } }, select: { id: true, displayName: true } });
      for (const e of ents) carrierNameById.set(e.id, e.displayName);
    }
  }

  // Decide each row's action.
  type Action = { rowIndex: number; outcome: string; reason?: string; s: (typeof staged)[number]; carrierEntityId?: string };
  const seen = new Set<string>();
  const actions: Action[] = staged.map((s, rowIndex) => {
    if (s.errors.length) return { rowIndex, outcome: "error", reason: s.errors.join(" "), s };
    if (s.fingerprint && existingFps.has(s.fingerprint)) return { rowIndex, outcome: "duplicate", reason: "Matches an existing matter (fingerprint).", s };
    if (s.fingerprint && seen.has(s.fingerprint)) return { rowIndex, outcome: "duplicate", reason: "Duplicate within this file.", s };
    if (s.fingerprint) seen.add(s.fingerprint);
    const carrier = carrierMap.get(s.carrier_raw);
    if (!carrier || carrier.status !== "matched") return { rowIndex, outcome: "held", reason: "Carrier not in registry — Owner must add it.", s };
    return { rowIndex, outcome: "created", s, carrierEntityId: (carrier as any).entityId };
  });

  const toCreate = actions.filter((a) => a.outcome === "created");

  // Resolve/link patients for rows to create (distinct by canonical name).
  const patientIdByName = new Map<string, string>();
  for (const name of new Set(toCreate.map((a) => a.s.patient_name).filter(Boolean))) {
    const res = await resolvePatient(name);
    if (res.status === "exact") patientIdByName.set(name, res.patientId);
    else {
      const created = await createPatient(name, "dow-import");
      patientIdByName.set(name, created.id);
    }
  }

  // Batch-allocate numbers and create matters.
  let created = 0;
  const createdRowMatterId = new Map<number, number>();
  if (toCreate.length) {
    const nums = await allocateMatterNumbers(toCreate.length);
    const data = toCreate.map((a, i) => {
      createdRowMatterId.set(a.rowIndex, nums.matterIds[i]);
      return {
        matter_id: nums.matterIds[i],
        display_number: nums.displayNumbers[i],
        claim_number_raw: a.s.claim_number_raw,
        patient_name: a.s.patient_name,
        patient_id: patientIdByName.get(a.s.patient_name) ?? null,
        insurer_name: a.carrierEntityId ? carrierNameById.get(a.carrierEntityId) ?? null : null,
        client_name: provider.displayName,
        provider_name: provider.displayName,
        case_type: a.s.case_type,
        service_type: a.s.service_type,
        date_of_loss: a.s.date_of_loss,
        dos_start: a.s.dos_start,
        dos_end: a.s.dos_end,
        claim_amount: a.s.claim_amount,
        balance_presuit: a.s.balance_presuit,
        fingerprint: a.s.fingerprint,
        final_status: "Open",
        raw_json: JSON.stringify(a.s.raw ?? {}),
      };
    });
    const res = await prisma.claimIndex.createMany({ data });
    created = res.count;
  }

  const counts = {
    total: staged.length,
    created,
    duplicates: actions.filter((a) => a.outcome === "duplicate").length,
    errors: actions.filter((a) => a.outcome === "error").length,
    held: actions.filter((a) => a.outcome === "held").length,
  };

  // Full per-row batch record.
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
      details: { providerEntityId: provider.id, providerName: provider.displayName, heldUnmatchedCarrier: counts.held },
    },
  });
  await prisma.importRow.createMany({
    data: actions.map((a) => ({
      batchId: batch.id,
      rowIndex: a.rowIndex,
      outcome: a.outcome === "created" ? "created" : a.outcome,
      reason: a.reason ?? null,
      matterId: createdRowMatterId.get(a.rowIndex) ?? null,
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
