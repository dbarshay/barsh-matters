import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isImportEnabled, IMPORT_DISABLED_MESSAGE } from "@/lib/import/importConfig";
import { parseSheetToObjects } from "@/lib/import/xlsxParse";
import { mapBulkRows, type BulkMapping, type BulkFixed } from "@/lib/import/bulkAdapter";
import { resolveBulkCarrier } from "@/lib/import/bulkCarrierResolution";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Bulk-load PREVIEW (read-only). Because the file is huge (~264k rows), this returns AGGREGATE stats
// only — never per-row — so the operator can sanity-check before committing:
//   - creatable vs held-for-missing-fields
//   - distinct carriers: matched to registry vs recorded-raw (lenient — raw is fine for bulk)
//   - distinct patients after accident-key clustering, split matchable (2025+) vs quarantined (pre-2025)
//   - duplicate fingerprints within the file and against existing matters
export async function POST(request: Request) {
  if (!isImportEnabled()) return NextResponse.json({ ok: false, error: IMPORT_DISABLED_MESSAGE }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const fileBase64 = String(body?.fileBase64 || "");
  const mapping = (body?.mapping ?? {}) as BulkMapping;
  const fixed = (body?.fixed ?? {}) as BulkFixed;
  if (!fileBase64) return NextResponse.json({ ok: false, error: "fileBase64 is required." }, { status: 400 });

  let rawRows: Record<string, unknown>[];
  try {
    rawRows = parseSheetToObjects(fileBase64);
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: `Could not parse spreadsheet: ${error?.message || String(error)}` }, { status: 400 });
  }
  const staged = mapBulkRows(rawRows, mapping, fixed);

  // Carriers (distinct) — lenient resolution.
  const distinctCarriers = Array.from(new Set(staged.map((s) => s.carrier_raw).filter(Boolean)));
  let carrierMatched = 0, carrierLegacy = 0, carrierRaw = 0;
  const rawCarrierSamples: string[] = [];
  for (const c of distinctCarriers) {
    const r = await resolveBulkCarrier(c);
    if (r.entityId) { if (r.via === "legacy-map") carrierLegacy++; else carrierMatched++; }
    else { carrierRaw++; if (rawCarrierSamples.length < 25) rawCarrierSamples.push(c); }
  }

  // Patients (distinct accident-clusters) + pre-2025 quarantine split.
  const clusterPre2025 = new Map<string, boolean>(); // cluster -> is any 2025+ occurrence
  for (const s of staged) {
    if (s.errors.length) continue;
    const prev = clusterPre2025.get(s.patient_cluster);
    const matchable = !s.is_pre2025 || prev === true;
    clusterPre2025.set(s.patient_cluster, matchable);
  }
  let patientsMatchable = 0, patientsQuarantined = 0;
  for (const matchable of clusterPre2025.values()) matchable ? patientsMatchable++ : patientsQuarantined++;

  // Fingerprints.
  const fps = staged.map((s) => s.fingerprint).filter(Boolean);
  const fpSeen = new Set<string>(); let dupInFile = 0;
  for (const f of fps) { if (fpSeen.has(f)) dupInFile++; else fpSeen.add(f); }
  const distinctFps = Array.from(fpSeen);
  let dupExisting = 0;
  for (let i = 0; i < distinctFps.length; i += 5000) {
    const slice = distinctFps.slice(i, i + 5000);
    const found = await prisma.claimIndex.findMany({ where: { fingerprint: { in: slice } }, select: { fingerprint: true } });
    dupExisting += found.length;
  }

  const withErrors = staged.filter((s) => s.errors.length).length;
  return NextResponse.json({
    ok: true,
    source: "bulk",
    summary: {
      totalRows: staged.length,
      heldMissingField: withErrors,
      creatable: staged.length - withErrors,
      distinctCarriers: distinctCarriers.length,
      carrierMatchedToRegistry: carrierMatched,
      carrierViaLegacyMap: carrierLegacy,
      carrierRecordedRaw: carrierRaw,
      distinctPatients: clusterPre2025.size,
      patientsMatchable2025Plus: patientsMatchable,
      patientsQuarantinedPre2025: patientsQuarantined,
      duplicateWithinFile: dupInFile,
      duplicateAgainstExisting: dupExisting,
    },
    rawCarrierSamples,
  });
}
