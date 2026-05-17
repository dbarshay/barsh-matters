import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function cleanText(value: unknown): string {
  return String(value ?? "").trim();
}

function parseMatterId(value: unknown): number | null {
  const cleaned = cleanText(value);
  if (!cleaned) return null;

  const withoutPrefix = cleaned.replace(/^BRL/i, "").trim();
  const parsed = Number(withoutPrefix);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function firstText(...values: unknown[]): string {
  for (const value of values) {
    const cleaned = cleanText(value);
    if (cleaned) return cleaned;
  }

  return "";
}

function safeRawJson(row: any): any {
  const raw = cleanText(row?.raw_json);
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function shapeMatter(row: any) {
  const raw = safeRawJson(row);
  const providerName = firstText(row?.provider_name, row?.client_name, raw?.provider?.name, raw?.client?.name);
  const patientName = firstText(row?.patient_name, raw?.patient?.name, raw?.patient);
  const insurerName = firstText(row?.insurer_name, raw?.insurer?.name, raw?.insuranceCompany?.name);
  const claimNumber = firstText(row?.claim_number_raw, row?.claim_number_normalized, raw?.claimNumber);

  const matterStageName = firstText(row?.matter_stage_name, row?.status, raw?.matterStage?.name, raw?.matter_stage?.name);

  return {
    ...(raw && typeof raw === "object" ? raw : {}),
    id: row.matter_id,
    matterId: row.matter_id,
    displayNumber: firstText(row.display_number, `BRL${row.matter_id}`),
    display_number: firstText(row.display_number, `BRL${row.matter_id}`),

    description: firstText(row.description, raw?.description),

    patient: patientName ? { name: patientName } : raw?.patient || null,
    patientName,

    client: providerName ? { name: providerName } : raw?.client || null,
    provider: providerName ? { name: providerName } : raw?.provider || null,
    providerName,
    clientName: firstText(row?.client_name, providerName),

    insurer: insurerName ? { name: insurerName } : raw?.insurer || null,
    insuranceCompany: insurerName ? { name: insurerName } : raw?.insuranceCompany || null,
    insurerName,

    claimNumber,
    claim_number: claimNumber,

    claimAmount: row.claim_amount ?? raw?.claimAmount ?? raw?.claim_amount ?? 0,
    settledAmount: row.settled_amount ?? raw?.settledAmount ?? raw?.settled_amount ?? 0,

    dosStart: firstText(row.dos_start, raw?.dosStart, raw?.dos_start),
    dosEnd: firstText(row.dos_end, raw?.dosEnd, raw?.dos_end),
    denialReason: firstText(row.denial_reason, raw?.denialReason, raw?.denial_reason),

    matterStage: matterStageName ? { name: matterStageName } : raw?.matterStage || raw?.matter_stage || null,
    matter_stage: matterStageName ? { name: matterStageName } : raw?.matter_stage || raw?.matterStage || null,
    status: firstText(row.status, matterStageName, raw?.status),

    closeReason: firstText(row.close_reason, raw?.closeReason, raw?.close_reason),
    close_reason: firstText(row.close_reason, raw?.closeReason, raw?.close_reason),

    serviceType: firstText(row.service_type, raw?.serviceType, raw?.service_type),
    policyNumber: firstText(row.policy_number, raw?.policyNumber, raw?.policy_number),
    dateOfLoss: firstText(row.date_of_loss, raw?.dateOfLoss, raw?.date_of_loss),

    indexAaaNumber: firstText(row.index_aaa_number, raw?.indexAaaNumber, raw?.index_aaa_number),
    masterLawsuitId: firstText(row.master_lawsuit_id, raw?.masterLawsuitId, raw?.master_lawsuit_id),

    paymentVoluntary: row.payment_voluntary ?? raw?.paymentVoluntary ?? raw?.payment_voluntary ?? 0,
    balancePresuit: row.balance_presuit ?? raw?.balancePresuit ?? raw?.balance_presuit ?? row.balance_amount ?? 0,
    balanceAmount: row.balance_amount ?? raw?.balanceAmount ?? raw?.balance_amount ?? 0,

    rawJson: row.raw_json || "",
    indexedAt: row.indexed_at,
  };
}

export async function GET(req: NextRequest) {
  const matterParam =
    req.nextUrl.searchParams.get("matterId") ||
    req.nextUrl.searchParams.get("matter") ||
    req.nextUrl.searchParams.get("id") ||
    "";

  const matterId = parseMatterId(matterParam);

  if (!matterId) {
    return NextResponse.json(
      { ok: false, error: "Valid matterId or matter is required." },
      { status: 400 }
    );
  }

  const normalizedDisplayNumber = cleanText(matterParam).toUpperCase().startsWith("BRL")
    ? cleanText(matterParam).toUpperCase()
    : `BRL${matterId}`;

  const row =
    (await prisma.claimIndex.findFirst({
      where: {
        OR: [
          { matter_id: matterId },
          { display_number: normalizedDisplayNumber },
          { display_number: { equals: normalizedDisplayNumber, mode: "insensitive" } },
        ],
      },
    })) ||
    (await prisma.claimIndex.findFirst({
      where: {
        display_number: {
          contains: String(matterId),
          mode: "insensitive",
        },
      },
      orderBy: { indexed_at: "desc" },
    }));

  if (!row) {
    return NextResponse.json(
      {
        ok: false,
        error: `${normalizedDisplayNumber} was not found in ClaimIndex.`,
        searched: {
          matterId,
          displayNumber: normalizedDisplayNumber,
        },
      },
      { status: 404 }
    );
  }

  return NextResponse.json({
    ok: true,
    source: "claimIndex",
    matterId,
    displayNumber: row.display_number || `BRL${matterId}`,
    matter: shapeMatter(row),
    row,
    safety: {
      clioHydration: false,
      clioWriteback: false,
      sourceOfTruth: "ClaimIndex/local Barsh Matters data",
    },
  });
}
