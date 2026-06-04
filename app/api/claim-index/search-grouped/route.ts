import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  buildClaimIndexWhere,
  CLAIM_INDEX_SELECT,
  type ClaimIndexSearchParams,
} from "@/lib/claimIndexQuery";
import { groupByClaim } from "@/lib/claimIndexGroup";

function clean(value: string | null) {
  return (value || "").trim();
}

function attachMasterFlags(rows: any[]) {
  const byMasterId = new Map<string, any[]>();

  for (const row of rows) {
    const key = String(row.master_lawsuit_id || "").trim();
    if (!key) continue;

    const group = byMasterId.get(key) || [];
    group.push(row);
    byMasterId.set(key, group);
  }

  for (const group of byMasterId.values()) {
    let maxId = 0;

    for (const row of group) {
      const id = Number(row.matter_id);
      if (id > maxId) maxId = id;
    }

    for (const row of group) {
      const isMaster = Number(row.matter_id) === maxId;
      row.isMaster = isMaster;
      row.is_master = isMaster;
    }
  }

  return rows;
}

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function objectValue(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, any>) : {};
}

function includesText(value: unknown, query: unknown) {
  const needle = cleanText(query).toLowerCase();
  if (!needle) return true;
  return cleanText(value).toLowerCase().includes(needle);
}

function displayVenue(lawsuit: any) {
  return (
    cleanText(lawsuit?.venue) ||
    cleanText(lawsuit?.venueSelection) ||
    cleanText(lawsuit?.venueOther)
  );
}

async function attachLocalLawsuitMetadata(rows: any[]) {
  const masterIds = Array.from(
    new Set(
      rows
        .map((row) => cleanText(row.master_lawsuit_id))
        .filter(Boolean)
    )
  );

  if (!masterIds.length) return rows;

  const lawsuits = await prisma.lawsuit.findMany({
    where: {
      masterLawsuitId: {
        in: masterIds,
      },
    },
    select: {
      masterLawsuitId: true,
      venue: true,
      venueSelection: true,
      venueOther: true,
      indexAaaNumber: true,
      clioMasterMatterId: true,
      clioMasterDisplayNumber: true,
      clioMasterMatterDescription: true,
      lawsuitOptions: true,
    },
  });

  const byMasterId = new Map(lawsuits.map((lawsuit) => [lawsuit.masterLawsuitId, lawsuit]));

  return rows.map((row) => {
    const lawsuit = byMasterId.get(cleanText(row.master_lawsuit_id));
    if (!lawsuit) return row;

    const lawsuitAny = lawsuit as any;
    const lawsuitOptions = objectValue(lawsuitAny.lawsuitOptions);

    const courtVenue = displayVenue(lawsuit);
    const lawsuitIndexNumber = cleanText(lawsuit.indexAaaNumber);

    return {
      ...row,
      court_venue: courtVenue || row.court_venue || row.courtVenue || row.court || null,
      courtVenue: courtVenue || row.courtVenue || row.court_venue || row.court || null,
      court: courtVenue || row.court || row.courtVenue || row.court_venue || null,
      lawsuit_index_aaa_number: lawsuitIndexNumber || null,
      indexAaaNumber: lawsuitIndexNumber || row.indexAaaNumber || row.index_aaa_number || null,
      index_aaa_number: row.index_aaa_number || lawsuitIndexNumber || null,
      clioMasterMatterId: lawsuit.clioMasterMatterId || null,
      clio_master_matter_id: lawsuit.clioMasterMatterId || null,
      clioMasterDisplayNumber: lawsuit.clioMasterDisplayNumber || null,
      clio_master_display_number: lawsuit.clioMasterDisplayNumber || null,
      clioMasterMatterDescription: lawsuit.clioMasterMatterDescription || null,
      clio_master_matter_description: lawsuit.clioMasterMatterDescription || null,
      adversary_attorney: lawsuitOptions.adversaryAttorney || null,
      adversaryAttorney: lawsuitOptions.adversaryAttorney || null,
      selected_adversary_attorney_details: lawsuitOptions.selectedAdversaryAttorneyDetails || null,
      selectedAdversaryAttorneyDetails: lawsuitOptions.selectedAdversaryAttorneyDetails || null,
    };
  });
}

export async function GET(req: NextRequest) {
  const params: ClaimIndexSearchParams = {
    matterId: clean(req.nextUrl.searchParams.get("matterId")),
    patient: clean(req.nextUrl.searchParams.get("patient")),
    provider: clean(req.nextUrl.searchParams.get("provider")),
    insurer: clean(req.nextUrl.searchParams.get("insurer")),
    claim: clean(req.nextUrl.searchParams.get("claim")),
    masterLawsuitId: clean(req.nextUrl.searchParams.get("masterLawsuitId")),
    indexAaaNumber: clean(req.nextUrl.searchParams.get("indexAaaNumber")),
  };

  const adversaryAttorneyFilter = clean(req.nextUrl.searchParams.get("adversaryAttorney"));
  const hasAnySelector = Object.values(params).some(Boolean) || Boolean(adversaryAttorneyFilter);

  if (!hasAnySelector) {
    return NextResponse.json(
      {
        ok: false,
        error: "At least one search parameter required.",
        sourceOfTruth: "ClaimIndex/local Barsh Matters",
        noClioRead: true,
        noClioWrite: true,
      },
      { status: 400 }
    );
  }

  const where = buildClaimIndexWhere(params);

  const claimIndexRows = await prisma.claimIndex.findMany({
    where,
    orderBy: { matter_id: "asc" },
    select: CLAIM_INDEX_SELECT,
  });

  const rowsWithMetadata = attachMasterFlags(await attachLocalLawsuitMetadata(claimIndexRows));
  const rows = adversaryAttorneyFilter
    ? rowsWithMetadata.filter((row: any) =>
        includesText(row.adversaryAttorney || row.adversary_attorney, adversaryAttorneyFilter)
      )
    : rowsWithMetadata;

  const groups = groupByClaim(rows);

  return NextResponse.json({
    ok: true,
    source: "claim-index-local-only",
    sourceOfTruth: "ClaimIndex/local Barsh Matters",
    noClioRead: true,
    noClioWrite: true,
    noClioHydration: true,
    count: rows.length,
    groupCount: groups.length,
    filters: params,
    refresh: {
      source: "none-local-only",
      rateLimited: 0,
      rateLimitedIds: [],
      refreshed: 0,
      refreshedMatterIds: [],
      skipped: 0,
      skippedMatterIds: [],
      errors: [],
    },
    expansion: null,
    groups,
  });
}
