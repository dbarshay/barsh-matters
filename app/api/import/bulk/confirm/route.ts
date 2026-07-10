import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { isImportEnabled, IMPORT_DISABLED_MESSAGE } from "@/lib/import/importConfig";
import { parseSheetToObjects } from "@/lib/import/xlsxParse";
import { mapBulkRows, bulkExtraFields, type BulkMapping, type BulkFixed, type StagedBulkMatter } from "@/lib/import/bulkAdapter";
import { resolveBulkCarrier } from "@/lib/import/bulkCarrierResolution";
import { resolveReferenceEntity } from "@/lib/referenceResolution";
import { patientMatchKey, toFirstLastProperCase } from "@/lib/patientResolution";
import { createMattersFromStaged, type CreatableRow } from "@/lib/import/createMatters";
import { buildMasterIdAt } from "@/lib/buildMasterId";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const IMPORT_BATCH_TAG = "nf-legacy";
const PATIENT_CHUNK = 2000;
const MATTER_CHUNK = 1000;

// Bulk-load CONFIRM (write). One-time NF closed-file load. Design (all bulk-only shortcuts — the live
// Dow/Carisk/Other importers and matter/lawsuit code are untouched):
//  - NUMBERS by ORIGINAL year: matters BRL_{445YY}, lawsuits {445-PKTYY}.MM.NNNNN.
//  - Row = matter; a PKT with >=2 members = a Lawsuit (dotted). Singletons stay standalone BRL_.
//  - CARRIER + PROVIDER + DEFENDANT resolve leniently (registry -> record raw string); never held.
//  - PATIENTS clustered by accident key; pre-2025 clusters quarantined (matchable=false).
//  - FINANCIALS seeded directly (no receipt ledger): claim_amount, balance_presuit=Suit Balance,
//    payment = Collection when aggregated (rolls up to the lawsuit's "Payments") else Voluntary+Collection.
//  - LAWSUIT-LEVEL fields (Defendant->adversaryAttorney, Court->venue, Index/AAA, Date Filed) go on the
//    lawsuit when there's a PKT; on a standalone matter they go into the matter's NOTES (description),
//    alongside Date Bill Sent + Date Opened.
//  - Everything imports CLOSED (record-only). LAZY Clio (no matter/folder created here).
// Processes the whole file in one request — run locally; `maxRows` does a trial run first.
export async function POST(request: Request) {
  if (!isImportEnabled()) return NextResponse.json({ ok: false, error: IMPORT_DISABLED_MESSAGE }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const fileBase64 = String(body?.fileBase64 || "");
  const mapping = (body?.mapping ?? {}) as BulkMapping;
  const fixed = (body?.fixed ?? {}) as BulkFixed;
  const actorName = String(body?.actorName || "").trim() || "Barsh Matters Bulk Import";
  const sourceFile = String(body?.sourceFile || "").trim() || null;
  const maxRows = Number.isFinite(Number(body?.maxRows)) && Number(body?.maxRows) > 0 ? Math.floor(Number(body?.maxRows)) : 0;
  if (!fileBase64) return NextResponse.json({ ok: false, error: "fileBase64 is required." }, { status: 400 });

  // Provider is resolved PER ROW; a fixed pick is only an optional fallback for rows with no provider.
  let fixedProvider: { id: string; displayName: string } | null = null;
  if (fixed.providerEntityId) {
    const p = await prisma.referenceEntity.findUnique({ where: { id: fixed.providerEntityId }, select: { id: true, displayName: true, type: true } });
    if (p && p.type === "provider_client") fixedProvider = { id: p.id, displayName: p.displayName };
  }

  let rawRows: Record<string, unknown>[];
  try {
    rawRows = parseSheetToObjects(fileBase64);
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: `Could not parse spreadsheet: ${error?.message || String(error)}` }, { status: 400 });
  }

  let staged = mapBulkRows(rawRows, mapping, fixed);
  if (maxRows) staged = staged.slice(0, maxRows);
  const creatable = staged.filter((s) => !s.errors.length);
  const skippedMissing = staged.length - creatable.length;

  // ---- 1) Patient clusters (accident key + name). matchable = any 2025+ occurrence.
  const clusterMatchable = new Map<string, boolean>();
  const clusterName = new Map<string, string>();
  for (const s of creatable) {
    clusterMatchable.set(s.patient_cluster, (clusterMatchable.get(s.patient_cluster) ?? false) || !s.is_pre2025);
    if (!clusterName.has(s.patient_cluster)) clusterName.set(s.patient_cluster, s.patient_name);
  }
  const clusterPatientId = new Map<string, string>();
  const patientRows: { id: string; name: string; normalizedName: string; source: string; matchable: boolean }[] = [];
  for (const [cluster, matchable] of clusterMatchable) {
    const id = randomUUID();
    const name = toFirstLastProperCase(clusterName.get(cluster) || "");
    clusterPatientId.set(cluster, id);
    patientRows.push({ id, name, normalizedName: patientMatchKey(name), source: IMPORT_BATCH_TAG, matchable });
  }
  for (let i = 0; i < patientRows.length; i += PATIENT_CHUNK) {
    await prisma.patient.createMany({ data: patientRows.slice(i, i + PATIENT_CHUNK) });
  }
  const patientsMatchable = patientRows.filter((p) => p.matchable).length;

  // ---- 2) Lenient distinct resolution: carrier, provider, defendant (matched -> canonical; else raw).
  const lenient = async (raw: string, type: "provider_client" | "adversary_attorney") => {
    if (!raw.trim()) return { entityId: null as string | null, name: "" };
    const r = await resolveReferenceEntity(raw, type);
    return r.status === "matched" ? { entityId: r.entityId, name: r.displayName } : { entityId: null, name: raw.trim() };
  };
  const carrierByRaw = new Map<string, { entityId: string | null; displayName: string }>();
  for (const c of new Set(creatable.map((s) => s.carrier_raw).filter(Boolean))) carrierByRaw.set(c, await resolveBulkCarrier(c));
  const providerByRaw = new Map<string, { entityId: string | null; name: string }>();
  for (const p of new Set(creatable.map((s) => s.provider_raw).filter(Boolean))) providerByRaw.set(p, await lenient(p, "provider_client"));
  const defendantByRaw = new Map<string, { entityId: string | null; name: string }>();
  for (const d of new Set(creatable.map((s) => s.defendant).filter(Boolean))) defendantByRaw.set(d, await lenient(d, "adversary_attorney"));

  // ---- 3) Aggregation: a matter is in a lawsuit only if its packet has >=2 members.
  const packetSize = new Map<string, number>();
  for (const s of creatable) if (s.packet_key) packetSize.set(s.packet_key, (packetSize.get(s.packet_key) ?? 0) + 1);
  const isAggregated = (s: StagedBulkMatter) => !!s.packet_key && (packetSize.get(s.packet_key) ?? 0) >= 2;

  const notesFor = (s: StagedBulkMatter, aggregated: boolean): string => {
    const parts: string[] = [];
    if (s.date_bill_sent) parts.push(`Date Bill Sent: ${s.date_bill_sent}`);
    if (s.opened_date) parts.push(`Date Opened: ${s.opened_date}`);
    if (!aggregated) {
      // lawsuit-level values on a standalone matter (no PKT) land in notes
      if (s.defendant) parts.push(`Defendant: ${defendantByRaw.get(s.defendant)?.name || s.defendant}`);
      if (s.court_venue) parts.push(`Court: ${s.court_venue}`);
      if (s.index_aaa_number) parts.push(`Index/AAA: ${s.index_aaa_number}`);
      if (s.date_aaa_arb_filed) parts.push(`Date Filed: ${s.date_aaa_arb_filed}`);
    }
    return parts.join(" | ");
  };

  // ---- 4) Build creatable rows (financials seeded; per-row provider; carrier/notes/status).
  const toCreate: CreatableRow[] = creatable.map((s, i) => {
    const car = carrierByRaw.get(s.carrier_raw);
    const prov = s.provider_raw ? providerByRaw.get(s.provider_raw) : null;
    const providerName = prov?.name || fixedProvider?.displayName || null;
    const providerId = prov?.entityId || fixedProvider?.id || null;
    const aggregated = isAggregated(s);
    const payment = aggregated ? (s.collection_payment ?? 0) : ((s.voluntary_payment ?? 0) + (s.collection_payment ?? 0));
    return {
      key: i,
      staged: s,
      carrierEntityId: car?.entityId ?? null,
      patientId: clusterPatientId.get(s.patient_cluster) ?? null,
      providerEntityId: providerId,
      providerDisplayName: providerName,
      extra: {
        ...bulkExtraFields(s),
        insurer_name: car?.displayName || s.carrier_raw || null,
        payment_voluntary: payment,
        payment_amount: payment,
        balance_amount: s.suit_balance ?? s.claim_amount ?? null,
        settled_with: s.settled_with || null,
        final_status: "Closed",
        close_reason: s.close_reason || null,
        // Closed historical files skip the live intake pipeline — leave the workflow stage BLANK rather
        // than the default "PRE-LIT NEW COLLECTIONS INTAKE" the shared creator stamps on new matters.
        matter_stage_name: null,
        description: notesFor(s, aggregated) || null,
      },
    };
  });

  // ---- 5) Create matters grouped by ORIGINAL year (BRL_{445YY}); collect matter ids.
  const yearOf = (s: StagedBulkMatter) => s.matter_year ?? s.opened_year ?? new Date().getFullYear();
  const byYear = new Map<number, CreatableRow[]>();
  for (const r of toCreate) {
    const y = yearOf(r.staged as StagedBulkMatter);
    (byYear.get(y) ?? byYear.set(y, []).get(y)!).push(r);
  }
  let created = 0;
  const matterIdByRowKey = new Map<number, number>();
  for (const [year, rowsForYear] of byYear) {
    for (let i = 0; i < rowsForYear.length; i += MATTER_CHUNK) {
      const res = await createMattersFromStaged(rowsForYear.slice(i, i + MATTER_CHUNK), undefined, { importBatch: IMPORT_BATCH_TAG, whenYear: year });
      for (const c of res) matterIdByRowKey.set(Number(c.key), c.matterId);
      created += res.length;
    }
  }

  // ---- 6) Packets with >=2 members -> Lawsuit (dotted, ORIGINAL year from 445-PKTYY).
  type PacketGroup = { rows: StagedBulkMatter[]; matterIds: number[] };
  const packets = new Map<string, PacketGroup>();
  creatable.forEach((s, i) => {
    if (!s.packet_key) return;
    const mid = matterIdByRowKey.get(i);
    if (!mid) return;
    const g = packets.get(s.packet_key) ?? { rows: [], matterIds: [] };
    g.rows.push(s); g.matterIds.push(mid);
    packets.set(s.packet_key, g);
  });

  const firstNonEmpty = (rows: StagedBulkMatter[], pick: (s: StagedBulkMatter) => string) => {
    for (const s of rows) { const v = pick(s); if (v) return v; }
    return "";
  };
  const monthOf = (d: string) => { const n = Number(String(d || "").slice(5, 7)); return n >= 1 && n <= 12 ? n : 1; };

  let lawsuitsCreated = 0;
  let mattersAggregated = 0;
  for (const [packetId, g] of packets) {
    if (g.matterIds.length < 2) continue; // old system: PKT = 2+ aggregated; singletons stay standalone
    const year = g.rows.find((s) => s.lawsuit_year)?.lawsuit_year ?? g.rows.find((s) => s.matter_year)?.matter_year ?? new Date().getFullYear();
    const month = Math.min(...g.rows.map((s) => monthOf(s.opened_date))); // earliest member opened month
    const masterLawsuitId = await buildMasterIdAt(year, month || 1);
    const lawsuitMatters = Array.from(new Set(g.matterIds)).sort((a, b) => a - b).join(",");
    const defRaw = firstNonEmpty(g.rows, (s) => s.defendant);
    const defResolved = defRaw ? defendantByRaw.get(defRaw) : null;
    await prisma.lawsuit.create({
      data: {
        masterLawsuitId,
        oldLawsuitNumber: firstNonEmpty(g.rows, (s) => s.old_lawsuit_number || s.packet_id) || packetId,
        claimNumber: firstNonEmpty(g.rows, (s) => s.claim_number_raw) || null,
        lawsuitMatters,
        sharedFolderPath: "",
        venue: firstNonEmpty(g.rows, (s) => s.court_venue) || null, // Court Name
        indexAaaNumber: firstNonEmpty(g.rows, (s) => s.index_aaa_number) || null,
        amountSoughtMode: "balance_presuit",
        amountSought: g.rows.reduce((sum, s) => sum + (s.balance_presuit ?? 0), 0),
        lawsuitOptions: {
          source: "nf-bulk-import",
          importBatch: IMPORT_BATCH_TAG,
          packetId,
          matterCount: g.matterIds.length,
          adversaryAttorney: defResolved?.name || defRaw || null, // Defendant -> adversary attorney
          selectedAdversaryAttorneyDetails: defResolved?.entityId ? { id: defResolved.entityId, displayName: defResolved.name } : null,
          dateFiled: firstNonEmpty(g.rows, (s) => s.date_aaa_arb_filed) || null, // Date AAA Arb Filed
          // Historical closed-file load: the lawsuit is born CLOSED (same fields the close route writes),
          // matching its member matters. closedAt unknown for legacy records.
          finalStatus: "Closed",
          final_status: "Closed",
          closeReason: firstNonEmpty(g.rows, (s) => s.close_reason) || "Legacy closed file (bulk import)",
          closedAt: null,
          createsClioDocumentShell: false,
          clioLazyCreate: true,
        },
        clioMasterMatterId: null,
        clioMasterDisplayNumber: null,
        clioMasterMatterDescription: null,
        clioMasterMappedAt: null,
        clioMasterMappingSource: "none-nf-bulk-import",
      },
    });
    for (let j = 0; j < g.matterIds.length; j += MATTER_CHUNK) {
      await prisma.claimIndex.updateMany({
        where: { matter_id: { in: g.matterIds.slice(j, j + MATTER_CHUNK) }, master_lawsuit_id: null },
        data: { master_lawsuit_id: masterLawsuitId },
      });
    }
    lawsuitsCreated += 1;
    mattersAggregated += g.matterIds.length;
  }

  const summary = {
    totalRows: staged.length,
    created,
    skippedMissingField: skippedMissing,
    patientsCreated: patientRows.length,
    patientsMatchable2025Plus: patientsMatchable,
    patientsQuarantinedPre2025: patientRows.length - patientsMatchable,
    distinctCarriers: carrierByRaw.size,
    carrierRecordedRaw: Array.from(carrierByRaw.values()).filter((c) => !c.entityId).length,
    distinctProviders: providerByRaw.size,
    lawsuitsCreated,
    mattersAggregatedIntoLawsuits: mattersAggregated,
    standaloneMatters: created - mattersAggregated,
    importBatch: IMPORT_BATCH_TAG,
  };

  const batch = await prisma.importBatch.create({
    data: {
      source: "bulk", sourceFile, actorName, status: "committed",
      totalRows: summary.totalRows, createdCount: summary.created, rejectedCount: summary.skippedMissingField,
      details: { ...summary, fixedProviderFallback: fixedProvider?.displayName ?? null },
    },
  });

  return NextResponse.json({ ok: true, source: "bulk", writes: true, batchId: batch.id, summary });
}
