import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TYPE_ALIASES: Record<string, string> = {
  insurer: "insurer",
  insurers: "insurer",
  insurance_company: "insurer",
  insurance_companies: "insurer",
  company: "insurer",
  companies: "insurer",

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
};

const TYPE_LABELS: Record<string, string> = {
  insurer: "Insurers / Companies",
  provider_client: "Providers / Clients",
  treating_provider: "Treating Providers",
  court_venue: "Courts / Venues",
  service_type: "Service Types",
  denial_reason: "Denial Reasons",
  closed_reason: "Closed Reasons / Final Statuses",
};

function textValue(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeType(value: unknown): string {
  const raw = textValue(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return TYPE_ALIASES[raw] || "";
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
      options: entities.map((entity) => ({
        id: entity.id,
        type: entity.type,
        displayName: entity.displayName,
        normalizedName: entity.normalizedName,
        active: entity.active,
        notes: entity.notes || "",
        details: entity.details || null,
        value: entity.id,
        label: entity.displayName,
      })),
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
