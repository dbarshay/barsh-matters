import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isImportEnabled, IMPORT_DISABLED_MESSAGE } from "@/lib/import/importConfig";
import { parseSheetToObjects } from "@/lib/import/xlsxParse";
import {
  mapCariskRows,
  normalizeTin,
  CARISK_STATUS_CREATE,
  CARISK_STATUS_IGNORE,
  CARISK_STATUS_REPORT,
  type StagedCariskMatter,
} from "@/lib/import/cariskAdapter";
import { resolveCarrier, resolveProvider, type ReferenceResolution } from "@/lib/referenceResolution";
import { resolvePatient, type PatientResolution } from "@/lib/patientResolution";
import {
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

// READ-ONLY Carisk import preview. Parses the sheet, maps + validates rows, applies Status-driven
// routing (Carrier Submission -> create-eligible; Submitted -> ignored; Saved Incomplete -> to_report),
// dedups on CIC# (existing matters + within-file), resolves carrier/provider/patient, and classifies
// each create-eligible row with a sub-reason hold where needed. Writes NOTHING. Gated behind the flag.

type Outcome = "ready" | "error" | "duplicate_existing" | "duplicate_in_file" | "held" | "ignored" | "to_report";

export async function POST(request: Request) {
  if (!isImportEnabled()) {
    return NextResponse.json({ ok: false, error: IMPORT_DISABLED_MESSAGE }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const fileBase64 = String(body?.fileBase64 || "");
  if (!fileBase64) return NextResponse.json({ ok: false, error: "fileBase64 is required." }, { status: 400 });

  let rows: Record<string, unknown>[];
  try {
    rows = parseSheetToObjects(fileBase64);
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: `Could not parse spreadsheet: ${error?.message || String(error)}` }, { status: 400 });
  }

  const staged = mapCariskRows(rows);

  // Distinct resolutions (once each).
  const carrierMap = new Map<string, ReferenceResolution>();
  for (const c of new Set(staged.map((s) => s.carrier_raw).filter(Boolean))) carrierMap.set(c, await resolveCarrier(c));
  const providerMap = new Map<string, ReferenceResolution>();
  for (const p of new Set(staged.map((s) => s.provider_raw).filter(Boolean))) providerMap.set(p, await resolveProvider(p));
  const patientMap = new Map<string, PatientResolution>();
  for (const p of new Set(staged.map((s) => s.patient_name).filter(Boolean))) patientMap.set(p, await resolvePatient(p));

  // CIC# duplicate check against existing matters (single batched query).
  const cics = Array.from(new Set(staged.map((s) => s.cic_number).filter(Boolean)));
  const existing = cics.length
    ? await prisma.claimIndex.findMany({ where: { cic_number: { in: cics } }, select: { cic_number: true, matter_id: true, display_number: true } })
    : [];
  const existingByCic = new Map(existing.map((e) => [e.cic_number ?? "", e]));

  // Canonical provider TIN (for mismatch check) — from the provider registry (ProviderClientInfo.tin).
  const matchedProviderIds = Array.from(new Set([...providerMap.values()].filter((r) => r.status === "matched").map((r) => (r as any).entityId)));
  const providerInfos = matchedProviderIds.length
    ? await prisma.providerClientInfo.findMany({ where: { referenceEntityId: { in: matchedProviderIds } }, select: { referenceEntityId: true, tin: true } })
    : [];
  const canonicalTinByProvider = new Map(providerInfos.map((p) => [p.referenceEntityId, p.tin ? normalizeTin(p.tin) : ""]));

  const seenCic = new Set<string>();
  const previewRows = staged.map((s, i) => {
    const carrier = carrierMap.get(s.carrier_raw) ?? ({ status: "unmatched", normalizedTried: [] } as ReferenceResolution);
    const provider = providerMap.get(s.provider_raw) ?? ({ status: "unmatched", normalizedTried: [] } as ReferenceResolution);
    const patient = patientMap.get(s.patient_name) ?? ({ status: "new" } as PatientResolution);

    let outcome: Outcome;
    let holdReason: string | null = null;
    let reason = "";

    const existingMatch = s.cic_number ? existingByCic.get(s.cic_number) : undefined;
    const dupInFile = s.cic_number ? seenCic.has(s.cic_number) : false;
    if (s.cic_number) seenCic.add(s.cic_number);

    if (s.errors.length) {
      outcome = "held";
      holdReason = HOLD_MISSING_FIELD;
      reason = s.errors.join(" ");
    } else if (s.status === CARISK_STATUS_IGNORE) {
      outcome = "ignored";
      reason = "Status 'Submitted' — transient, not imported.";
    } else if (s.status === CARISK_STATUS_REPORT) {
      outcome = "to_report";
      reason = "Status 'Saved Incomplete' — routed to Carisk Management Report.";
    } else if (s.status !== CARISK_STATUS_CREATE) {
      outcome = "error";
      reason = `Unrecognized Status: "${s.status || "(blank)"}".`;
    } else if (existingMatch) {
      outcome = "duplicate_existing";
      reason = `CIC# already exists as matter ${existingMatch.display_number ?? existingMatch.matter_id}.`;
    } else if (dupInFile) {
      outcome = "duplicate_in_file";
      reason = "Duplicate CIC# within this file.";
    } else if (carrier.status !== "matched") {
      outcome = "held";
      holdReason = HOLD_CARRIER_UNMATCHED;
    } else if (provider.status !== "matched") {
      outcome = "held";
      holdReason = HOLD_PROVIDER_UNMATCHED;
    } else if (s.case_type_unknown) {
      outcome = "held";
      holdReason = HOLD_CASE_TYPE_UNKNOWN;
    } else if (patient.status === "suggest") {
      outcome = "held";
      holdReason = HOLD_PATIENT_AMBIGUOUS;
    } else if (tinMismatch(provider, s, canonicalTinByProvider)) {
      outcome = "held";
      holdReason = HOLD_TIN_MISMATCH;
    } else if (dataQualityHold(s)) {
      outcome = "held";
      holdReason = HOLD_DATA_QUALITY;
    } else {
      outcome = "ready";
    }

    const { raw, errors, ...stagedVisible } = s;
    return {
      rowIndex: i,
      outcome,
      holdReason,
      reason,
      staged: stagedVisible,
      carrier,
      provider,
      patient,
      existingMatterId: existingMatch?.matter_id ?? null,
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
    heldProvider: heldOf(HOLD_PROVIDER_UNMATCHED),
    heldCaseType: heldOf(HOLD_CASE_TYPE_UNKNOWN),
    heldPatient: heldOf(HOLD_PATIENT_AMBIGUOUS),
    heldTin: heldOf(HOLD_TIN_MISMATCH),
    heldDataQuality: heldOf(HOLD_DATA_QUALITY),
    errors: previewRows.filter((r) => r.outcome === "error").length,
    duplicatesExisting: previewRows.filter((r) => r.outcome === "duplicate_existing").length,
    duplicatesInFile: previewRows.filter((r) => r.outcome === "duplicate_in_file").length,
    ignored: previewRows.filter((r) => r.outcome === "ignored").length,
    toReport: previewRows.filter((r) => r.outcome === "to_report").length,
  };

  return NextResponse.json({ ok: true, source: "carisk", writes: false, summary, rows: previewRows });
}

function tinMismatch(provider: ReferenceResolution, s: StagedCariskMatter, canonical: Map<string, string>): boolean {
  if (provider.status !== "matched") return false;
  const cticket = canonical.get((provider as any).entityId) || "";
  if (!cticket || !s.provider_tin) return false; // no baseline set, or no incoming TIN
  return normalizeTin(cticket) !== normalizeTin(s.provider_tin);
}
