import { prisma } from "@/lib/prisma";

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function objectValue(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, any>) : {};
}

function displayVenue(lawsuit: any): string {
  return (
    text(lawsuit?.venue) ||
    text(lawsuit?.venueSelection) ||
    text(lawsuit?.venueOther)
  );
}

function parseMatterIdsFromLawsuitMatters(value: unknown): number[] {
  return Array.from(
    new Set(
      String(value ?? "")
        .match(/\d+/g)
        ?.map((item) => Number(item))
        .filter((item) => Number.isFinite(item) && item > 0) || []
    )
  );
}

export async function attachLocalLawsuitMetadataToClaimRows<T extends Record<string, any>>(rows: T[]): Promise<T[]> {
  if (!Array.isArray(rows) || rows.length === 0) return rows;

  const masterIds = Array.from(
    new Set(rows.map((row) => text(row.master_lawsuit_id ?? row.masterLawsuitId)).filter(Boolean))
  );

  const matterIds = Array.from(
    new Set(
      rows
        .map((row) => Number(row.matter_id ?? row.matterId ?? row.id))
        .filter((item) => Number.isFinite(item) && item > 0)
    )
  );

  if (!masterIds.length && !matterIds.length) return rows;

  const whereClauses: any[] = [];

  if (masterIds.length) {
    whereClauses.push({ masterLawsuitId: { in: masterIds } });
  }

  for (const matterId of matterIds) {
    whereClauses.push({ lawsuitMatters: { contains: String(matterId) } });
  }

  const lawsuits = await prisma.lawsuit.findMany({
    where: { OR: whereClauses },
    select: {
      masterLawsuitId: true,
      lawsuitMatters: true,
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

  const byMasterId = new Map<string, any>();
  const byMatterId = new Map<number, any>();

  for (const lawsuit of lawsuits) {
    const masterId = text(lawsuit.masterLawsuitId);
    if (masterId) byMasterId.set(masterId, lawsuit);

    for (const matterId of parseMatterIdsFromLawsuitMatters(lawsuit.lawsuitMatters)) {
      byMatterId.set(matterId, lawsuit);
    }
  }

  return rows.map((row) => {
    const lawsuit =
      byMasterId.get(text(row.master_lawsuit_id ?? row.masterLawsuitId)) ||
      byMatterId.get(Number(row.matter_id ?? row.matterId ?? row.id));

    if (!lawsuit) return row;

    const lawsuitOptions = objectValue(lawsuit.lawsuitOptions);
    const courtVenue = displayVenue(lawsuit);
    const lawsuitIndexNumber = text(lawsuit.indexAaaNumber);

    return {
      ...row,
      master_lawsuit_id: row.master_lawsuit_id || lawsuit.masterLawsuitId || null,
      masterLawsuitId: row.masterLawsuitId || lawsuit.masterLawsuitId || null,

      court_venue: courtVenue || row.court_venue || row.courtVenue || row.court || null,
      courtVenue: courtVenue || row.courtVenue || row.court_venue || row.court || null,
      court: courtVenue || row.court || row.courtVenue || row.court_venue || null,

      lawsuit_index_aaa_number: row.lawsuit_index_aaa_number || lawsuitIndexNumber || null,
      indexAaaNumber: row.indexAaaNumber || row.index_aaa_number || lawsuitIndexNumber || null,
      index_aaa_number: row.index_aaa_number || lawsuitIndexNumber || null,

      clioMasterMatterId: row.clioMasterMatterId || lawsuit.clioMasterMatterId || null,
      clio_master_matter_id: row.clio_master_matter_id || lawsuit.clioMasterMatterId || null,
      clioMasterDisplayNumber: row.clioMasterDisplayNumber || lawsuit.clioMasterDisplayNumber || null,
      clio_master_display_number: row.clio_master_display_number || lawsuit.clioMasterDisplayNumber || null,
      clioMasterMatterDescription:
        row.clioMasterMatterDescription || lawsuit.clioMasterMatterDescription || null,
      clio_master_matter_description:
        row.clio_master_matter_description || lawsuit.clioMasterMatterDescription || null,

      adversary_attorney: lawsuitOptions.adversaryAttorney || row.adversary_attorney || null,
      adversaryAttorney: lawsuitOptions.adversaryAttorney || row.adversaryAttorney || null,
      selected_adversary_attorney_details:
        lawsuitOptions.selectedAdversaryAttorneyDetails || row.selected_adversary_attorney_details || null,
      selectedAdversaryAttorneyDetails:
        lawsuitOptions.selectedAdversaryAttorneyDetails || row.selectedAdversaryAttorneyDetails || null,
    } as T;
  });
}
