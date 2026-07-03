import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isImportEnabled, IMPORT_DISABLED_MESSAGE } from "@/lib/import/importConfig";
import { createPatient, patientMatchKey } from "@/lib/patientResolution";
import { REVIEW_READY, REVIEW_OPEN, HOLD_PATIENT_AMBIGUOUS } from "@/lib/import/holdReasons";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Record the operator's patient decision for a patient_ambiguous held row and mark it Ready to Commit.
// GROUP RESOLVE: the decision is applied to EVERY open patient-ambiguous row with the SAME patient
// name, so the operator fixes each distinct person once. For "new", the patient is created ONCE here
// and all same-name rows link to it (no duplicate patients). Touches only the Patient master + these
// ImportRows (not the reference registry). Flag-gated.
//   { rowId, decision: "link", patientId }  -> link all same-name rows to an existing patient
//   { rowId, decision: "new" }               -> create one new patient, link all same-name rows to it

export async function POST(request: Request) {
  if (!isImportEnabled()) {
    return NextResponse.json({ ok: false, error: IMPORT_DISABLED_MESSAGE }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const rowId = String(body?.rowId || "").trim();
  const decision = String(body?.decision || "").trim();
  let patientId = String(body?.patientId || "").trim();

  if (!rowId) return NextResponse.json({ ok: false, error: "rowId is required." }, { status: 400 });
  if (decision !== "link" && decision !== "new") {
    return NextResponse.json({ ok: false, error: "decision must be 'link' or 'new'." }, { status: 400 });
  }

  const row = await prisma.importRow.findUnique({ where: { id: rowId }, select: { id: true, outcome: true, holdReason: true, staged: true } });
  if (!row || row.outcome !== "held" || row.holdReason !== HOLD_PATIENT_AMBIGUOUS) {
    return NextResponse.json({ ok: false, error: "Row is not a patient-ambiguous hold." }, { status: 400 });
  }
  const targetName = String(((row.staged ?? {}) as Record<string, any>).patient_name ?? "");
  const targetKey = patientMatchKey(targetName);

  if (decision === "link") {
    if (!patientId) return NextResponse.json({ ok: false, error: "patientId is required to link." }, { status: 400 });
    const patient = await prisma.patient.findUnique({ where: { id: patientId }, select: { id: true } });
    if (!patient) return NextResponse.json({ ok: false, error: "patientId not found." }, { status: 404 });
  } else {
    // Create the new patient ONCE; all same-name rows link to it.
    const created = await createPatient(targetName, "dow-import-reconcile");
    patientId = created.id;
  }

  // Find every open patient-ambiguous row with the same normalized patient name.
  const openPatientHolds = await prisma.importRow.findMany({
    where: { outcome: "held", holdReason: HOLD_PATIENT_AMBIGUOUS, reviewStatus: REVIEW_OPEN, batch: { is: { status: { not: "undone" } } } },
    select: { id: true, staged: true },
  });
  const sameNameIds = openPatientHolds
    .filter((r) => patientMatchKey(String(((r.staged ?? {}) as Record<string, any>).patient_name ?? "")) === targetKey)
    .map((r) => r.id);

  await prisma.importRow.updateMany({
    where: { id: { in: sameNameIds.length ? sameNameIds : [rowId] } },
    data: { reviewStatus: REVIEW_READY, resolution: { patient: "link", patientId } },
  });

  return NextResponse.json({ ok: true, rowId, decision, patientId, appliedTo: sameNameIds.length || 1 });
}
