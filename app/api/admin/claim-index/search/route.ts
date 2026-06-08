import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

type SortField =
  | "matter_id"
  | "display_number"
  | "patient_name"
  | "provider_name"
  | "insurer_name"
  | "claim_number_raw"
  | "status"
  | "final_status"
  | "close_reason"
  | "master_lawsuit_id"
  | "indexed_at";

const SORT_FIELDS = new Set<SortField>([
  "matter_id",
  "display_number",
  "patient_name",
  "provider_name",
  "insurer_name",
  "claim_number_raw",
  "status",
  "final_status",
  "close_reason",
  "master_lawsuit_id",
  "indexed_at",
]);

const CLAIM_INDEX_ADMIN_SELECT = {
  matter_id: true,
  display_number: true,
  description: true,
  claim_number_raw: true,
  claim_number_normalized: true,
  patient_name: true,
  client_name: true,
  insurer_name: true,
  provider_name: true,
  treating_provider: true,
  claim_amount: true,
  payment_amount: true,
  balance_amount: true,
  bill_number: true,
  dos_start: true,
  dos_end: true,
  denial_reason: true,
  service_type: true,
  policy_number: true,
  date_of_loss: true,
  master_lawsuit_id: true,
  status: true,
  close_reason: true,
  final_status: true,
  matter_stage_name: true,
  index_aaa_number: true,
  indexed_at: true,
} satisfies Prisma.ClaimIndexSelect;

function clean(value: string | null): string {
  return String(value || "").trim();
}

function contains(field: keyof Prisma.ClaimIndexWhereInput, value: string): Prisma.ClaimIndexWhereInput {
  return {
    [field]: {
      contains: value,
      mode: "insensitive",
    },
  } as Prisma.ClaimIndexWhereInput;
}

function equalsOrContains(field: keyof Prisma.ClaimIndexWhereInput, value: string): Prisma.ClaimIndexWhereInput {
  return {
    OR: [
      { [field]: value } as Prisma.ClaimIndexWhereInput,
      contains(field, value),
    ],
  };
}

function numberFilter(field: keyof Prisma.ClaimIndexWhereInput, value: string): Prisma.ClaimIndexWhereInput | null {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return { [field]: numeric } as Prisma.ClaimIndexWhereInput;
}

function buildWhere(params: URLSearchParams): Prisma.ClaimIndexWhereInput {
  const q = clean(params.get("q"));
  const displayNumber = clean(params.get("displayNumber"));
  const matterId = clean(params.get("matterId"));
  const patient = clean(params.get("patient"));
  const provider = clean(params.get("provider"));
  const insurer = clean(params.get("insurer"));
  const claimNumber = clean(params.get("claimNumber"));
  const status = clean(params.get("status"));
  const finalStatus = clean(params.get("finalStatus"));
  const closedReason = clean(params.get("closedReason"));
  const masterLawsuitId = clean(params.get("masterLawsuitId"));

  const and: Prisma.ClaimIndexWhereInput[] = [];

  if (q) {
    const qMatterId = numberFilter("matter_id", q);
    and.push({
      OR: [
        ...(qMatterId ? [qMatterId] : []),
        contains("display_number", q),
        contains("description", q),
        contains("claim_number_raw", q),
        contains("claim_number_normalized", q),
        contains("patient_name", q),
        contains("client_name", q),
        contains("provider_name", q),
        contains("treating_provider", q),
        contains("insurer_name", q),
        contains("status", q),
        contains("final_status", q),
        contains("close_reason", q),
        contains("master_lawsuit_id", q),
        contains("index_aaa_number", q),
      ],
    });
  }

  if (displayNumber) and.push(equalsOrContains("display_number", displayNumber));
  if (matterId) {
    const matterIdFilter = numberFilter("matter_id", matterId);
    if (matterIdFilter) and.push(matterIdFilter);
  }
  if (patient) and.push(contains("patient_name", patient));
  if (provider) {
    and.push({
      OR: [
        contains("provider_name", provider),
        contains("treating_provider", provider),
        contains("client_name", provider),
      ],
    });
  }
  if (insurer) and.push(contains("insurer_name", insurer));
  if (claimNumber) {
    and.push({
      OR: [
        contains("claim_number_raw", claimNumber),
        contains("claim_number_normalized", claimNumber),
      ],
    });
  }
  if (status) and.push(contains("status", status));
  if (finalStatus) {
    and.push({
      OR: [
        contains("final_status", finalStatus),
        contains("matter_stage_name", finalStatus),
      ],
    });
  }
  if (closedReason) and.push(contains("close_reason", closedReason));
  if (masterLawsuitId) and.push(equalsOrContains("master_lawsuit_id", masterLawsuitId));

  return and.length ? { AND: and } : {};
}

function sortField(value: string | null): SortField {
  const candidate = clean(value) as SortField;
  return SORT_FIELDS.has(candidate) ? candidate : "display_number";
}

function sortDirection(value: string | null): Prisma.SortOrder {
  return clean(value).toLowerCase() === "desc" ? "desc" : "asc";
}

function limitValue(value: string | null): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 250;
  return Math.min(Math.max(Math.trunc(parsed), 1), 500);
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const where = buildWhere(url.searchParams);
    const sort = sortField(url.searchParams.get("sort"));
    const direction = sortDirection(url.searchParams.get("direction"));
    const limit = limitValue(url.searchParams.get("limit"));

    const [rows, total] = await Promise.all([
      prisma.claimIndex.findMany({
        where,
        select: CLAIM_INDEX_ADMIN_SELECT,
        orderBy: [{ [sort]: direction }, { matter_id: "asc" }],
        take: limit,
      }),
      prisma.claimIndex.count({ where }),
    ]);

    return NextResponse.json({
      ok: true,
      rows,
      total,
      limit,
      returned: rows.length,
      sort,
      direction,
      sourceOfTruth: "ClaimIndex/local Barsh Matters",
      readOnly: true,
      safety:
        "Read-only Admin ClaimIndex search. This route only reads prisma.claimIndex and does not update ClaimIndex, restore data, call Clio, generate documents, send email, print, queue, or write the database.",
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        error: err?.message || "Admin ClaimIndex search failed.",
        readOnly: true,
      },
      { status: 500 }
    );
  }
}
