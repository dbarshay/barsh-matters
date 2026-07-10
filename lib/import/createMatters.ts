import { prisma } from "@/lib/prisma";
import { allocateMatterNumbers } from "@/lib/matterNumbering";
import { createPatient } from "@/lib/patientResolution";
import { BARSH_IMPORT_DEFAULT_MATTER_STATUS } from "@/lib/matterStatusOptions";

// Shared matter-creation used by BOTH the Dow confirm route and the reconcile-commit route, so
// created matters are identical regardless of path. Given already-resolved rows (carrier entity +
// patient decision), it allocates BRL numbers and inserts ClaimIndex rows. It does NOT classify or
// dedupe — callers decide which rows are creatable. final_status is always "Open" (closed only via
// the UI close dialog); matter_stage_name defaults to the import intake stage.

export type StagedForCreate = {
  claim_number_raw: string;
  patient_name: string;
  date_of_loss: string;
  dos_start: string;
  dos_end: string;
  claim_amount: number | null;
  balance_presuit: number | null;
  service_type: string;
  case_type: string;
  fingerprint: string;
  raw?: Record<string, unknown> | null;
};

export type CreatableRow = {
  key: string | number; // caller's row key (rowIndex or ImportRow id) to map results back
  staged: StagedForCreate;
  carrierEntityId: string | null; // resolved carrier entity (null allowed but normally set)
  patientId: string | null; // null => create a NEW patient from staged.patient_name
  // Per-row provider (Carisk resolves provider from the sheet). Falls back to the fn-level provider
  // (Dow, where the operator picks one provider for the whole import).
  providerEntityId?: string | null;
  providerDisplayName?: string | null;
  // Source-specific ClaimIndex columns (e.g. Carisk cic_number, status, place_of_service_*). Merged
  // last, so a source can override defaults where it needs to.
  extra?: Record<string, unknown>;
};

export type CreatedResult = { key: string | number; matterId: number; displayNumber: string; patientId: string | null }[];

export async function createMattersFromStaged(
  rows: CreatableRow[],
  provider?: { id: string; displayName: string },
  opts?: { importBatch?: string; whenYear?: number }
): Promise<CreatedResult> {
  if (!rows.length) return [];

  // Carrier display names for denormalization onto the matter.
  const carrierIds = Array.from(new Set(rows.map((r) => r.carrierEntityId).filter((x): x is string => !!x)));
  const carrierNameById = new Map<string, string>();
  if (carrierIds.length) {
    const ents = await prisma.referenceEntity.findMany({ where: { id: { in: carrierIds } }, select: { id: true, displayName: true } });
    for (const e of ents) carrierNameById.set(e.id, e.displayName);
  }

  // Create NEW patients for rows without a linked patient (dedupe by canonical name within this call).
  const patientIdByName = new Map<string, string>();
  const namesToCreate = Array.from(new Set(rows.filter((r) => !r.patientId).map((r) => r.staged.patient_name).filter(Boolean)));
  for (const name of namesToCreate) {
    const p = await createPatient(name, "dow-import");
    patientIdByName.set(name, p.id);
  }

  // whenYear lets the bulk load number legacy matters under their ORIGINAL file year (from Case_Id
  // 445YY), not the import year. One call = one year, so callers group rows by year.
  const nums = await allocateMatterNumbers(rows.length, opts?.whenYear);
  const resolvedPatientId = (r: CreatableRow) => r.patientId ?? patientIdByName.get(r.staged.patient_name) ?? null;
  const providerNameFor = (r: CreatableRow) => r.providerDisplayName ?? provider?.displayName ?? null;

  const data = rows.map((r, i) => ({
    matter_id: nums.matterIds[i],
    display_number: nums.displayNumbers[i],
    claim_number_raw: r.staged.claim_number_raw,
    patient_name: r.staged.patient_name,
    patient_id: resolvedPatientId(r),
    insurer_name: r.carrierEntityId ? carrierNameById.get(r.carrierEntityId) ?? null : null,
    client_name: providerNameFor(r),
    provider_name: providerNameFor(r),
    case_type: r.staged.case_type,
    service_type: r.staged.service_type,
    date_of_loss: r.staged.date_of_loss,
    dos_start: r.staged.dos_start,
    dos_end: r.staged.dos_end,
    claim_amount: r.staged.claim_amount,
    balance_presuit: r.staged.balance_presuit,
    fingerprint: r.staged.fingerprint,
    final_status: "Open",
    matter_stage_name: BARSH_IMPORT_DEFAULT_MATTER_STATUS,
    import_batch: opts?.importBatch ?? null, // e.g. "nf-legacy" for the one-time bulk load; null otherwise
    raw_json: JSON.stringify(r.staged.raw ?? {}),
    ...(r.extra ?? {}), // source-specific columns (Carisk), merged last
  }));

  // `extra` carries source-specific typed columns; cast past the strict createMany input shape.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await prisma.claimIndex.createMany({ data: data as any });

  return rows.map((r, i) => ({
    key: r.key,
    matterId: nums.matterIds[i],
    displayNumber: nums.displayNumbers[i],
    patientId: resolvedPatientId(r),
  }));
}
