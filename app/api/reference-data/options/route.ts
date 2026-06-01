import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TYPE_ALIASES: Record<string, string> = {
  insurer: "insurer_company",
  insurers: "insurer_company",
  insurer_company: "insurer_company",
  insurer_companies: "insurer_company",
  insurance_company: "insurer_company",
  insurance_companies: "insurer_company",
  company: "insurer_company",
  companies: "insurer_company",

  provider: "provider_client",
  providers: "provider_client",
  provider_client: "provider_client",
  provider_clients: "provider_client",
  client: "provider_client",
  clients: "provider_client",

  treating_provider: "treating_provider",
  treating_providers: "treating_provider",
  treating: "treating_provider",
  rendering_provider: "treating_provider",
  rendering_providers: "treating_provider",

  court: "court_venue",
  courts: "court_venue",
  venue: "court_venue",
  venues: "court_venue",
  court_venue: "court_venue",
  court_venues: "court_venue",

  service_type: "service_type",
  service_types: "service_type",
  service: "service_type",
  services: "service_type",

  denial_reason: "denial_reason",
  denial_reasons: "denial_reason",
  denial: "denial_reason",
  denials: "denial_reason",

  closed_reason: "closed_reason",
  closed_reasons: "closed_reason",
  close_reason: "closed_reason",
  close_reasons: "closed_reason",
  final_status: "closed_reason",
  final_statuses: "closed_reason",

  transaction_type: "transaction_type",
  transaction_types: "transaction_type",
  transaction: "transaction_type",
  transactions: "transaction_type",

  transaction_status: "transaction_status",
  transaction_statuses: "transaction_status",
  payment_status: "transaction_status",
  payment_statuses: "transaction_status",
};

const TYPE_LABELS: Record<string, string> = {
  insurer_company: "Insurers / Companies",
  provider_client: "Providers / Clients",
  treating_provider: "Treating Providers",
  court_venue: "Courts / Venues",
  service_type: "Service Types",
  denial_reason: "Denial Reasons",
  closed_reason: "Closed Reasons / Final Statuses",
  transaction_type: "Transaction Types",
  transaction_status: "Transaction Statuses",
};

function textValue(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeType(value: unknown): string {
  const raw = textValue(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return TYPE_ALIASES[raw] || "";
}

function courtDistrictNumber(name: string): number {
  const match = String(name || "").match(/\((\d+)(?:st|nd|rd|th)\)/i);
  return match ? Number(match[1]) : 999;
}

function courtSortGroup(name: string): number {
  const normalized = String(name || "").toLowerCase();

  if (normalized.includes("suffolk")) return 0;
  if (normalized.includes("ny city civil") || normalized.includes("civil court of the city of new york")) return 1;
  if (normalized.includes("nassau")) return 2;

  return 3;
}

function sortReferenceOptions(type: string, options: any[]): any[] {
  if (type !== "court_venue") return options;

  return [...options].sort((a, b) => {
    const aName = String(a?.displayName || a?.label || "");
    const bName = String(b?.displayName || b?.label || "");
    const aGroup = courtSortGroup(aName);
    const bGroup = courtSortGroup(bName);

    if (aGroup !== bGroup) return aGroup - bGroup;

    if (aGroup === 0 || aGroup === 2) {
      const numberDelta = courtDistrictNumber(aName) - courtDistrictNumber(bName);
      if (numberDelta !== 0) return numberDelta;
    }

    return aName.localeCompare(bName);
  });
}

function jsonError(message: string, status = 400, details: Record<string, unknown> = {}) {
  return NextResponse.json(
    {
      ok: false,
      error: message,
      ...details,
    },
    { status }
  );
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const rawType = textValue(url.searchParams.get("type"));
    const activeOnly = textValue(url.searchParams.get("activeOnly") || "true").toLowerCase() !== "false";
    const limitRaw = Number(url.searchParams.get("limit") || 5000);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(Math.floor(limitRaw), 10000) : 5000;

    const type = normalizeType(rawType);

    if (!type) {
      return jsonError("A valid reference-data type is required.", 400, {
        rawType,
        supportedTypes: Object.keys(TYPE_LABELS),
      });
    }

    const entities = await prisma.referenceEntity.findMany({
      where: {
        type,
        ...(activeOnly ? { active: true } : {}),
      },
      select: {
        id: true,
        type: true,
        displayName: true,
        normalizedName: true,
        active: true,
        notes: true,
        details: true,
      },
      orderBy: [
        {
          displayName: "asc",
        },
        {
          id: "asc",
        },
      ],
      take: limit,
    });

    return NextResponse.json({
      ok: true,
      source: "reference-entity",
      noClioWrite: true,
      noClioRead: true,
      type,
      label: TYPE_LABELS[type] || type,
      activeOnly,
      count: entities.length,
      options: sortReferenceOptions(
        type,
        entities.map((entity) => ({
          id: entity.id,
          type: entity.type,
          displayName: entity.displayName,
          normalizedName: entity.normalizedName,
          active: entity.active,
          notes: entity.notes || "",
          details: entity.details || null,
          value: entity.id,
          label: entity.displayName,
        }))
      ),
      safety: {
        clioWrite: false,
        clioRead: false,
        storage: "ReferenceEntity",
      },
    });
  } catch (err: any) {
    return jsonError(err?.message || "Reference-data options lookup failed.", 500);
  }
}
