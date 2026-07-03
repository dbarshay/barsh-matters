import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isImportEnabled, IMPORT_DISABLED_MESSAGE } from "@/lib/import/importConfig";
import { parseSheetToObjects } from "@/lib/import/xlsxParse";
import { mapOtherRows, type OtherMapping, type OtherFixed } from "@/lib/import/otherAdapter";
import { resolveCarrier, type ReferenceResolution } from "@/lib/referenceResolution";
import { resolvePatient, type PatientResolution } from "@/lib/patientResolution";
import {
  HOLD_MISSING_FIELD, HOLD_CARRIER_UNMATCHED, HOLD_CASE_TYPE_UNKNOWN,
  HOLD_PATIENT_AMBIGUOUS, HOLD_DATA_QUALITY, dataQualityHold,
} from "@/lib/import/holdReasons";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// READ-ONLY generic-spreadsheet preview. Maps rows with the operator's mapping + fixed picks, resolves
// carrier/provider(per-row unless fixed)/patient, dedups on fingerprint, and classifies each row with
// a sub-reason hold. Writes nothing. Flag-gated.

export async function POST(request: Request) {
  if (!isImportEnabled()) return NextResponse.json({ ok: false, error: IMPORT_DISABLED_MESSAGE }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const fileBase64 = String(body?.fileBase64 || "");
  const mapping = (body?.mapping ?? {}) as OtherMapping;
  const fixed = (body?.fixed ?? {}) as OtherFixed;
  if (!fileBase64) return NextResponse.json({ ok: false, error: "fileBase64 is required." }, { status: 400 });
  if (!fixed.providerEntityId) return NextResponse.json({ ok: false, error: "Pick a Provider/Client (Import OTHERS never parses the provider)." }, { status: 400 });

  let rows: Record<string, unknown>[];
  try {
    rows = parseSheetToObjects(fileBase64);
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: `Could not parse spreadsheet: ${error?.message || String(error)}` }, { status: 400 });
  }

  const staged = mapOtherRows(rows, mapping, fixed);

  const carrierMap = new Map<string, ReferenceResolution>();
  for (const c of new Set(staged.map((s) => s.carrier_raw).filter(Boolean))) carrierMap.set(c, await resolveCarrier(c));
  const patientMap = new Map<string, PatientResolution>();
  for (const p of new Set(staged.map((s) => s.patient_name).filter(Boolean))) patientMap.set(p, await resolvePatient(p));

  const fingerprints = Array.from(new Set(staged.map((s) => s.fingerprint).filter(Boolean)));
  const existing = fingerprints.length
    ? await prisma.claimIndex.findMany({ where: { fingerprint: { in: fingerprints } }, select: { fingerprint: true, matter_id: true, display_number: true } })
    : [];
  const existingByFp = new Map(existing.map((e) => [e.fingerprint ?? "", e]));

  const seen = new Set<string>();
  const previewRows = staged.map((s, i) => {
    const carrier = carrierMap.get(s.carrier_raw) ?? ({ status: "unmatched", normalizedTried: [] } as ReferenceResolution);
    const patient = patientMap.get(s.patient_name) ?? ({ status: "new" } as PatientResolution);

    const existingMatch = s.fingerprint ? existingByFp.get(s.fingerprint) : undefined;
    const dupInFile = s.fingerprint ? seen.has(s.fingerprint) : false;
    if (s.fingerprint) seen.add(s.fingerprint);

    // Provider is the operator's fixed pick — never a hold here.
    let outcome: string;
    let holdReason: string | null = null;
    if (s.errors.length) { outcome = "held"; holdReason = HOLD_MISSING_FIELD; }
    else if (existingMatch) outcome = "duplicate_existing";
    else if (dupInFile) outcome = "duplicate_in_file";
    else if (carrier.status !== "matched") { outcome = "held"; holdReason = HOLD_CARRIER_UNMATCHED; }
    else if (s.case_type_unknown) { outcome = "held"; holdReason = HOLD_CASE_TYPE_UNKNOWN; }
    else if (patient.status === "suggest") { outcome = "held"; holdReason = HOLD_PATIENT_AMBIGUOUS; }
    else if (dataQualityHold(s)) { outcome = "held"; holdReason = HOLD_DATA_QUALITY; }
    else outcome = "ready";

    const { raw, errors, ...stagedVisible } = s;
    return {
      rowIndex: i, outcome, holdReason,
      reason: s.errors.join(" "),
      staged: stagedVisible, carrier, patient,
      existingDisplayNumber: existingMatch?.display_number ?? null,
    };
  });

  const heldOf = (h: string) => previewRows.filter((r) => r.holdReason === h).length;
  const summary = {
    total: previewRows.length,
    ready: previewRows.filter((r) => r.outcome === "ready").length,
    held: previewRows.filter((r) => r.outcome === "held").length,
    heldMissing: heldOf(HOLD_MISSING_FIELD),
    heldCarrier: heldOf(HOLD_CARRIER_UNMATCHED),
    heldCaseType: heldOf(HOLD_CASE_TYPE_UNKNOWN),
    heldPatient: heldOf(HOLD_PATIENT_AMBIGUOUS),
    heldDataQuality: heldOf(HOLD_DATA_QUALITY),
    errors: 0,
    duplicatesExisting: previewRows.filter((r) => r.outcome === "duplicate_existing").length,
    duplicatesInFile: previewRows.filter((r) => r.outcome === "duplicate_in_file").length,
  };

  return NextResponse.json({ ok: true, source: "other", writes: false, summary, rows: previewRows });
}
