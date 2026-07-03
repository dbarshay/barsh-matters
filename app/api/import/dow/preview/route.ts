import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isImportEnabled, IMPORT_DISABLED_MESSAGE } from "@/lib/import/importConfig";
import { parseSheetToObjects } from "@/lib/import/xlsxParse";
import { mapDowRows, type StagedDowMatter } from "@/lib/import/dowAdapter";
import { resolveCarrier, type ReferenceResolution } from "@/lib/referenceResolution";
import { resolvePatient, type PatientResolution } from "@/lib/patientResolution";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// READ-ONLY Dow import preview. Parses the sheet, maps + validates rows, resolves carrier/patient,
// and detects duplicates (existing matters + within-file) — WITHOUT writing anything. The confirm
// step performs the actual creation. Gated behind BARSH_IMPORT_ENABLED.

type PreviewRow = {
  rowIndex: number;
  outcome: "ready" | "error" | "duplicate_existing" | "duplicate_in_file";
  errors: string[];
  fingerprint: string;
  staged: Omit<StagedDowMatter, "raw" | "errors" | "fingerprint">;
  carrier: ReferenceResolution;
  patient: PatientResolution;
  existingMatterId: number | null;
  existingDisplayNumber: string | null;
};

export async function POST(request: Request) {
  if (!isImportEnabled()) {
    return NextResponse.json({ ok: false, error: IMPORT_DISABLED_MESSAGE }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const fileBase64 = String(body?.fileBase64 || "");
  if (!fileBase64) {
    return NextResponse.json({ ok: false, error: "fileBase64 is required." }, { status: 400 });
  }

  let rows: Record<string, unknown>[];
  try {
    rows = parseSheetToObjects(fileBase64);
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: `Could not parse spreadsheet: ${error?.message || String(error)}` },
      { status: 400 }
    );
  }

  const staged = mapDowRows(rows);

  // Resolve DISTINCT carriers and DISTINCT patient names once (not per row) to keep this fast.
  const distinctCarriers = Array.from(new Set(staged.map((s) => s.carrier_raw).filter(Boolean)));
  const carrierMap = new Map<string, ReferenceResolution>();
  for (const c of distinctCarriers) carrierMap.set(c, await resolveCarrier(c));

  const distinctPatients = Array.from(new Set(staged.map((s) => s.patient_name).filter(Boolean)));
  const patientMap = new Map<string, PatientResolution>();
  for (const p of distinctPatients) patientMap.set(p, await resolvePatient(p));

  // Existing-matter duplicate check by fingerprint (single batched query).
  const fingerprints = Array.from(new Set(staged.map((s) => s.fingerprint).filter(Boolean)));
  const existing = fingerprints.length
    ? await prisma.claimIndex.findMany({
        where: { fingerprint: { in: fingerprints } },
        select: { fingerprint: true, matter_id: true, display_number: true },
      })
    : [];
  const existingByFp = new Map(existing.map((e) => [e.fingerprint ?? "", e]));

  const seenInFile = new Set<string>();
  const previewRows: PreviewRow[] = staged.map((s, i) => {
    const existingMatch = s.fingerprint ? existingByFp.get(s.fingerprint) : undefined;
    const dupInFile = s.fingerprint ? seenInFile.has(s.fingerprint) : false;
    if (s.fingerprint) seenInFile.add(s.fingerprint);

    let outcome: PreviewRow["outcome"];
    if (s.errors.length) outcome = "error";
    else if (existingMatch) outcome = "duplicate_existing";
    else if (dupInFile) outcome = "duplicate_in_file";
    else outcome = "ready";

    const { raw, errors, fingerprint, ...stagedVisible } = s;
    return {
      rowIndex: i,
      outcome,
      errors,
      fingerprint,
      staged: stagedVisible,
      carrier: carrierMap.get(s.carrier_raw) ?? { status: "unmatched", normalizedTried: [] },
      patient: patientMap.get(s.patient_name) ?? { status: "new" },
      existingMatterId: existingMatch?.matter_id ?? null,
      existingDisplayNumber: existingMatch?.display_number ?? null,
    };
  });

  const summary = {
    total: previewRows.length,
    ready: previewRows.filter((r) => r.outcome === "ready").length,
    errors: previewRows.filter((r) => r.outcome === "error").length,
    duplicatesExisting: previewRows.filter((r) => r.outcome === "duplicate_existing").length,
    duplicatesInFile: previewRows.filter((r) => r.outcome === "duplicate_in_file").length,
    unmatchedCarriers: previewRows.filter((r) => r.carrier.status === "unmatched").length,
    newPatients: previewRows.filter((r) => r.patient.status === "new").length,
    patientsToConfirm: previewRows.filter((r) => r.patient.status === "suggest").length,
  };

  return NextResponse.json({
    ok: true,
    source: "dow",
    writes: false,
    caseTypeForAll: "No-Fault",
    note: "Provider is operator-selected once at confirm (Dow sheets don't name the provider).",
    summary,
    rows: previewRows,
  });
}
