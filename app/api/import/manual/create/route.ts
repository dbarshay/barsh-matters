import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isImportEnabled, IMPORT_DISABLED_MESSAGE } from "@/lib/import/importConfig";
import { parseMoney, toDateOnly } from "@/lib/import/parse";
import { computeBillFingerprint } from "@/lib/import/fingerprint";
import { toFirstLastProperCase, patientMatchKey, resolvePatient } from "@/lib/patientResolution";
import { createMattersFromStaged } from "@/lib/import/createMatters";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Manual (Intake Path #3) single-matter creation. Hand-keyed form; controlled dropdowns supply entity
// IDs (operators SELECT existing registry values — never create them, patient excepted). All 12 fields
// required except the Claim#/Policy# alternation (at least one). Dedup uses the same fingerprint as the
// imports; a match is WARNED (return duplicate) unless the operator sends override:true. Patient
// follows suggest-and-confirm (never auto-links on a fuzzy name). Creates via the shared creator and
// records a 1-row source="manual" batch for audit + guarded undo. Flag-gated.

const CASE_TYPES = new Set(["No-Fault", "Workers Compensation"]);

async function displayNameOf(id: string, type: string): Promise<string | null> {
  if (!id) return null;
  const e = await prisma.referenceEntity.findUnique({ where: { id }, select: { displayName: true, type: true } });
  return e && e.type === type ? e.displayName : null;
}

export async function POST(request: Request) {
  if (!isImportEnabled()) return NextResponse.json({ ok: false, error: IMPORT_DISABLED_MESSAGE }, { status: 403 });

  const b = await request.json().catch(() => ({}));
  const claimNumber = String(b?.claimNumber || "").trim();
  const policyNumber = String(b?.policyNumber || "").trim();
  const patientNameRaw = String(b?.patientName || "").trim();
  const providerEntityId = String(b?.providerEntityId || "").trim();
  const insurerEntityId = String(b?.insurerEntityId || "").trim();
  const denialReasonId = String(b?.denialReasonId || "").trim();
  const serviceTypeId = String(b?.serviceTypeId || "").trim();
  const caseType = String(b?.caseType || "").trim();
  const treatingPhysician = toFirstLastProperCase(b?.treatingPhysician);
  const doi = toDateOnly(b?.dateOfInjury);
  const dosStart = toDateOnly(b?.dosStart);
  const dosEnd = toDateOnly(b?.dosEnd) || dosStart;
  const grossAmount = parseMoney(b?.grossClaimAmount);
  const patientId = String(b?.patientId || "").trim();
  const createNewPatient = b?.createNewPatient === true;
  const override = b?.override === true;

  // Validation — all required except the claim/policy alternation.
  const errors: string[] = [];
  if (!claimNumber && !policyNumber) errors.push("Claim Number or Policy Number is required.");
  if (!patientNameRaw) errors.push("Patient is required.");
  if (!providerEntityId) errors.push("Provider/Client is required.");
  if (!insurerEntityId) errors.push("Insurer/Carrier is required.");
  if (!denialReasonId) errors.push("Denial Reason is required.");
  if (!serviceTypeId) errors.push("Service Type is required.");
  if (!CASE_TYPES.has(caseType)) errors.push("Case Type must be No-Fault or Workers Compensation.");
  if (!treatingPhysician) errors.push("Treating Physician is required.");
  if (!doi) errors.push("Date of Injury is required/invalid.");
  if (!dosStart) errors.push("Date(s) of Service is required/invalid.");
  if (grossAmount === null) errors.push("Gross Claim Amount is required/invalid.");
  if (errors.length) return NextResponse.json({ ok: false, error: errors.join(" "), errors }, { status: 400 });

  // Resolve controlled values to their canonical display names (verifies they are the right type).
  const [provider, insurerName, denialReason, serviceType] = await Promise.all([
    prisma.referenceEntity.findUnique({ where: { id: providerEntityId }, select: { id: true, displayName: true, type: true } }),
    displayNameOf(insurerEntityId, "insurer_company"),
    displayNameOf(denialReasonId, "denial_reason"),
    displayNameOf(serviceTypeId, "service_type"),
  ]);
  if (!provider || provider.type !== "provider_client") return NextResponse.json({ ok: false, error: "Invalid provider." }, { status: 400 });
  if (!insurerName) return NextResponse.json({ ok: false, error: "Invalid insurer." }, { status: 400 });
  if (!denialReason) return NextResponse.json({ ok: false, error: "Invalid denial reason." }, { status: 400 });
  if (!serviceType) return NextResponse.json({ ok: false, error: "Invalid service type." }, { status: 400 });

  const patientName = toFirstLastProperCase(patientNameRaw);

  // Dedup — same fingerprint as the imports.
  const fingerprint = computeBillFingerprint({
    claimOrPolicy: claimNumber || policyNumber,
    patientKey: patientMatchKey(patientName),
    dosStart,
    dosEnd,
    grossAmount,
  });
  if (!override) {
    const dup = await prisma.claimIndex.findFirst({ where: { fingerprint }, select: { matter_id: true, display_number: true, patient_name: true } });
    if (dup) {
      return NextResponse.json({
        ok: false,
        duplicate: { matterId: dup.matter_id, displayNumber: dup.display_number, patientName: dup.patient_name },
        error: `Likely duplicate of matter ${dup.display_number ?? dup.matter_id} (${dup.patient_name ?? ""}). Confirm to create anyway.`,
      }, { status: 409 });
    }
  }

  // Patient: explicit link/new, else resolve (exact -> link; new -> create; suggest -> ask operator).
  let resolvedPatientId: string | null = null;
  if (patientId) {
    const p = await prisma.patient.findUnique({ where: { id: patientId }, select: { id: true } });
    if (!p) return NextResponse.json({ ok: false, error: "Selected patient not found." }, { status: 404 });
    resolvedPatientId = patientId;
  } else if (!createNewPatient) {
    const pr = await resolvePatient(patientName);
    if (pr.status === "exact") resolvedPatientId = pr.patientId;
    else if (pr.status === "suggest") {
      return NextResponse.json({ ok: false, needPatientChoice: true, candidates: pr.candidates, error: "Patient may match an existing person — choose one or confirm new." }, { status: 409 });
    }
    // status "new" -> resolvedPatientId stays null; the shared creator will create a new patient.
  }

  const staged = {
    claim_number_raw: claimNumber,
    patient_name: patientName,
    date_of_loss: doi,
    dos_start: dosStart,
    dos_end: dosEnd,
    claim_amount: grossAmount,
    balance_presuit: grossAmount,
    service_type: serviceType,
    case_type: caseType,
    fingerprint,
    raw: { source: "manual", ...b },
  };

  const results = await createMattersFromStaged(
    [{
      key: 0,
      staged,
      carrierEntityId: insurerEntityId,
      patientId: resolvedPatientId,
      providerEntityId: provider.id,
      providerDisplayName: provider.displayName,
      extra: {
        policy_number: policyNumber || null,
        denial_reason: denialReason,
        treating_provider: treatingPhysician,
        insurer_name: insurerName,
      },
    }],
  );
  const created = results[0];

  const batch = await prisma.importBatch.create({
    data: {
      source: "manual",
      sourceFile: null,
      actorName: String(b?.actorName || "").trim() || "Barsh Matters Manual",
      status: "committed",
      totalRows: 1,
      createdCount: 1,
      details: { manual: true, providerEntityId: provider.id, providerName: provider.displayName },
    },
  });
  await prisma.importRow.create({
    data: { batchId: batch.id, rowIndex: 0, outcome: "created", matterId: created.matterId, fingerprint },
  });

  return NextResponse.json({ ok: true, source: "manual", matterId: created.matterId, displayNumber: created.displayNumber, batchId: batch.id });
}
