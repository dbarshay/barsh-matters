import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { CLAIM_INDEX_SELECT } from "@/lib/claimIndexQuery";

export const dynamic = "force-dynamic";

function clean(v: any) {
  return String(v ?? "").trim();
}

function compact(v: any) {
  return clean(v).toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function objectValue(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, any>) : {};
}

function dateVariants(v: any) {
  const raw = clean(v);
  if (!raw) return [];

  const out = new Set<string>();
  out.add(raw);

  const iso = raw.match(/\d{4}-\d{2}-\d{2}/)?.[0];
  if (iso) {
    out.add(iso);
    const [yyyy, mm, dd] = iso.split("-");
    out.add(`${mm}/${dd}/${yyyy}`);
    out.add(`${mm}.${dd}.${yyyy}`);
  }

  const slash = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash) {
    const [, mm, dd, yyyy] = slash;
    out.add(`${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`);
  }

  return Array.from(out).filter(Boolean);
}

function includesText(value: unknown, query: unknown) {
  const needle = clean(query).toLowerCase();
  if (!needle) return true;
  return clean(value).toLowerCase().includes(needle);
}

function displayVenue(lawsuit: any) {
  return (
    clean(lawsuit?.venue) ||
    clean(lawsuit?.venueSelection) ||
    clean(lawsuit?.venueOther)
  );
}

function parseMatterIdsFromLawsuitMatters(value: unknown) {
  return Array.from(
    new Set(
      String(value ?? "")
        .match(/\d+/g)
        ?.map((item) => Number(item))
        .filter((item) => Number.isFinite(item) && item > 0) || []
    )
  );
}

function contains(field: string, value: string): Prisma.ClaimIndexWhereInput {
  return {
    [field]: {
      contains: value,
      mode: "insensitive",
    },
  } as Prisma.ClaimIndexWhereInput;
}

function equalsOrContains(field: string, value: string): Prisma.ClaimIndexWhereInput {
  return {
    OR: [
      { [field]: value } as Prisma.ClaimIndexWhereInput,
      contains(field, value),
    ],
  };
}

function appScopeWhere(): Prisma.ClaimIndexWhereInput {
  return {
    OR: [
      { display_number: { startsWith: "BRL3", mode: "insensitive" } },
      { display_number: { startsWith: "BRL4", mode: "insensitive" } },
      { display_number: { startsWith: "BRL5", mode: "insensitive" } },
      { display_number: { startsWith: "BRL6", mode: "insensitive" } },
      { display_number: { startsWith: "BRL7", mode: "insensitive" } },
      { display_number: { startsWith: "BRL8", mode: "insensitive" } },
      { display_number: { startsWith: "BRL9", mode: "insensitive" } },
    ],
  };
}

function picklistOptionValue(labelOrValue: string, options: Record<string, string>) {
  const q = clean(labelOrValue);
  if (!q) return "";

  if (options[q]) return q;

  const qCompact = compact(q);
  for (const [value, label] of Object.entries(options)) {
    if (compact(label) === qCompact) return value;
    if (compact(label).includes(qCompact)) return value;
    if (qCompact.includes(compact(label))) return value;
  }

  return q;
}

const CLOSE_REASON_LABELS: Record<string, string> = {
  "12497450": "AAA- DECISION- DISMISSED WITH PREJUDICE",
  "12497465": "AAA- VOLUNTARILY WITHDRAWN WITH PREJUDICE",
  "12497480": "DISCONTINUED WITH PREJUDICE",
  "12497495": "MOTION LOSS",
  "12497510": "OUT OF STATE CARRIER",
  "12497525": "PAID (DECISION)",
  "12497540": "PAID (JUDGMENT)",
  "12497555": "PAID (SETTLEMENT)",
  "12497570": "PAID (FEE SCHEDULE)",
  "12497585": "PAID (VOLUNTARY)",
  "12497600": "PER CLIENT",
  "12497615": "POLICY CANCELLED",
  "12497630": "POLICY EXHAUSTED/NO COVERAGE",
  "12497645": "PPO",
  "12497660": "SOL",
  "12497675": "TRIAL LOSS",
  "12497690": "WORKERS COMPENSATION",
  "12497825": "TRANSFERRED TO LB",
};

async function attachLocalLawsuitMetadata(rows: any[]) {
  const masterIds = Array.from(
    new Set(rows.map((row) => clean(row?.master_lawsuit_id ?? row?.masterLawsuitId)).filter(Boolean))
  );

  const matterIds = Array.from(
    new Set(
      rows
        .map((row) => Number(row?.matter_id ?? row?.matterId))
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
    where: {
      OR: whereClauses,
    },
    select: {
      masterLawsuitId: true,
      lawsuitMatters: true,
      venue: true,
      venueSelection: true,
      venueOther: true,
      lawsuitOptions: true,
    },
  });

  const byMasterId = new Map(lawsuits.map((lawsuit) => [clean(lawsuit.masterLawsuitId), lawsuit]));
  const byMatterId = new Map<number, any>();

  for (const lawsuit of lawsuits) {
    for (const matterId of parseMatterIdsFromLawsuitMatters(lawsuit.lawsuitMatters)) {
      byMatterId.set(matterId, lawsuit);
    }
  }

  return rows.map((row) => {
    const lawsuit =
      byMasterId.get(clean(row?.master_lawsuit_id ?? row?.masterLawsuitId)) ||
      byMatterId.get(Number(row?.matter_id ?? row?.matterId));

    if (!lawsuit) return row;

    const lawsuitAny = lawsuit as any;
    const lawsuitOptions = objectValue(lawsuitAny.lawsuitOptions);
    const courtVenue = displayVenue(lawsuit);

    return {
      ...row,
      master_lawsuit_id: row.master_lawsuit_id || lawsuit.masterLawsuitId || null,
      masterLawsuitId: row.masterLawsuitId || lawsuit.masterLawsuitId || null,
      court_venue: courtVenue || row.court_venue || row.courtVenue || row.court || null,
      courtVenue: courtVenue || row.courtVenue || row.court_venue || row.court || null,
      court: courtVenue || row.court || row.courtVenue || row.court_venue || null,
      adversary_attorney: lawsuitOptions.adversaryAttorney || row.adversary_attorney || null,
      adversaryAttorney: lawsuitOptions.adversaryAttorney || row.adversaryAttorney || null,
      selected_adversary_attorney_details:
        lawsuitOptions.selectedAdversaryAttorneyDetails || row.selected_adversary_attorney_details || null,
      selectedAdversaryAttorneyDetails:
        lawsuitOptions.selectedAdversaryAttorneyDetails || row.selectedAdversaryAttorneyDetails || null,
    };
  });
}

const DENIAL_REASON_LABELS: Record<string, string> = {
  "12497975": "Medical Necessity (IME)",
  "12497990": "Medical Necessity (Peer Review)",
  "12498035": "Medical Necessity (Causality)",
  "12498050": "Fee Schedule",
  "12498065": "No-Show (EUO)",
  "12498080": "No-Show (IME)",
  "12498095": "30 Day Rule (Late Notice of Claim)",
  "12498110": "45 Day Rule (Late Submission of Bill)",
  "12498125": "120 Day Rule- Failure to Provide Verification (OVR)",
  "12498140": "Alleged Fraud",
  "12498155": "No-Coverage (Wrong Carrier)",
  "12498170": "No Coverage (Policy Exhausted)",
  "12498185": "No Coverage (Policy Expired)",
  "12498200": "No Coverage (Motorcycle)",
  "12498215": "No Coverage (Out of State Carrier)",
  "12498230": "No Coverage (Not Eligible IP)",
};

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const limit = Math.min(Number(params.get("limit") || 250), 750);

  const patient = clean(params.get("patient"));
  const provider = clean(params.get("provider"));
  const insuranceCompany = clean(params.get("insuranceCompany"));
  const claim = clean(params.get("claim"));
  const indexAaaNumber = clean(params.get("indexAaaNumber"));
  const dateOpenedFrom = clean(params.get("dateOpenedFrom"));
  const dateOpenedTo = clean(params.get("dateOpenedTo"));
  const court = clean(params.get("court"));
  const adversaryAttorney = clean(params.get("adversaryAttorney"));
  const dosStart = clean(params.get("dosStart"));
  const dosEnd = clean(params.get("dosEnd"));
  const denialReason = clean(params.get("denialReason"));
  const serviceType = clean(params.get("serviceType"));
  const status = clean(params.get("status"));
  const closeReason = clean(params.get("closeReason"));
  const finalStatus = clean(params.get("finalStatus"));

  const and: Prisma.ClaimIndexWhereInput[] = [appScopeWhere()];

  if (patient) and.push(contains("patient_name", patient));

  if (provider) {
    and.push({
      OR: [
        contains("provider_name", provider),
        contains("client_name", provider),
      ],
    });
  }

  if (insuranceCompany) and.push(contains("insurer_name", insuranceCompany));
  if (claim) and.push(contains("claim_number_normalized", claim));
  if (indexAaaNumber) and.push(contains("index_aaa_number", indexAaaNumber));

  // Date Opened is intentionally not used for ClaimIndex candidate narrowing yet.
  // It should be added to the local schema/filter contract before it is enforced.
  void dateOpenedFrom;
  void dateOpenedTo;

  if (dosStart) {
    const variants = dateVariants(dosStart);
    and.push({
      OR: variants.map((value) => equalsOrContains("dos_start", value)),
    });
  }

  if (dosEnd) {
    const variants = dateVariants(dosEnd);
    and.push({
      OR: variants.map((value) => equalsOrContains("dos_end", value)),
    });
  }

  if (denialReason) {
    const value = picklistOptionValue(denialReason, DENIAL_REASON_LABELS);
    const label = DENIAL_REASON_LABELS[value] || denialReason;
    and.push({
      OR: [
        equalsOrContains("denial_reason", value),
        equalsOrContains("denial_reason", label),
      ],
    });
  }

  if (serviceType) {
    and.push({
      OR: [
        equalsOrContains("service_type", serviceType),
      ],
    });
  }

  if (status) {
    and.push({
      OR: [
        contains("matter_stage_name", status),
        contains("status", status),
      ],
    });
  }

  if (closeReason) {
    const value = picklistOptionValue(closeReason, CLOSE_REASON_LABELS);
    const label = CLOSE_REASON_LABELS[value] || closeReason;
    and.push({
      OR: [
        equalsOrContains("close_reason", value),
        equalsOrContains("close_reason", label),
      ],
    });
  }

  if (finalStatus) {
    and.push(equalsOrContains("status", finalStatus));
  }

  const rows = await prisma.claimIndex.findMany({
    where: { AND: and },
    select: CLAIM_INDEX_SELECT,
    take: limit,
    orderBy: {
      matter_id: "desc",
    },
  });

  const rowsWithMetadata = await attachLocalLawsuitMetadata(rows);
  let finalRows = rowsWithMetadata;

  if (court) {
    finalRows = finalRows.filter((row: any) =>
      includesText(row.court || row.courtVenue || row.court_venue, court)
    );
  }

  if (adversaryAttorney) {
    finalRows = finalRows.filter((row: any) =>
      includesText(row.adversaryAttorney || row.adversary_attorney, adversaryAttorney)
    );
  }

  return NextResponse.json({
    ok: true,
    action: "advanced-search-candidates",
    count: finalRows.length,
    rows: finalRows,
    source: "ClaimIndex/local Barsh Matters candidate narrowing.  Final display uses local data only.",
    safety: {
      readOnly: true,
      noClioRecordsChanged: true,
      noDatabaseRecordsChanged: true,
    },
  });
}
