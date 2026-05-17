import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function cleanText(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeText(value: unknown): string {
  return cleanText(value).toLowerCase().replace(/\s+/g, " ");
}

function normalizeType(value: unknown): string {
  const raw = normalizeText(value);

  if (!raw || raw === "all" || raw === "any") return "";
  if (raw === "person" || raw === "people" || raw === "individuals") return "individual";
  if (raw === "company" || raw === "companies" || raw === "business") return "insurer";

  return raw;
}

function contactTypeLabel(type: string): string {
  const normalized = normalizeText(type);

  if (normalized === "individual") return "Person";
  if (normalized === "provider" || normalized === "client") return "Company";
  if (normalized === "insurer" || normalized === "company") return "Company";
  if (normalized === "attorney" || normalized === "adversary_attorney") return "Person";

  return normalized ? normalized.replace(/_/g, " ") : "Reference";
}

function detailsObject(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
    } catch {
      return {};
    }
  }

  return {};
}

function detailsText(details: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = cleanText(details[key]);
    if (value) return value;
  }

  return "";
}

export async function GET(req: NextRequest) {
  try {
    const query = cleanText(req.nextUrl.searchParams.get("q") || req.nextUrl.searchParams.get("query"));
    const normalizedQuery = normalizeText(query);
    const requestedType = normalizeType(req.nextUrl.searchParams.get("type"));
    const limitRaw = Number(req.nextUrl.searchParams.get("limit") || 20);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 50) : 20;

    if (query.length < 2) {
      return NextResponse.json(
        { ok: false, error: "Enter at least 2 characters to search local contacts." },
        { status: 400 }
      );
    }

    const searchableTypes = requestedType
      ? [requestedType]
      : [
          "individual",
          "provider",
          "client",
          "insurer",
          "company",
          "attorney",
          "adversary_attorney",
        ];

    const entities = await prisma.referenceEntity.findMany({
      where: {
        active: true,
        type: { in: searchableTypes },
        OR: [
          { displayName: { contains: query, mode: "insensitive" } },
          { normalizedName: { contains: normalizedQuery, mode: "insensitive" } },
          {
            aliases: {
              some: {
                OR: [
                  { alias: { contains: query, mode: "insensitive" } },
                  { normalizedAlias: { contains: normalizedQuery, mode: "insensitive" } },
                ],
              },
            },
          },
        ],
      },
      include: {
        aliases: {
          orderBy: { alias: "asc" },
          take: 5,
        },
      },
      orderBy: [{ type: "asc" }, { displayName: "asc" }],
      take: limit,
    });

    const contacts = entities.map((entity: any) => {
      const details = detailsObject(entity.details);
      const email = detailsText(details, ["email", "Email", "e-mail", "E-mail"]);
      const phone = detailsText(details, ["phone", "Phone", "telephone", "Telephone"]);
      const address = detailsText(details, ["address", "Address", "mailingAddress", "Mailing Address"]);
      const contactType = contactTypeLabel(entity.type);

      return {
        id: `reference:${entity.id}`,
        referenceEntityId: entity.id,
        name: entity.displayName,
        type: contactType,
        referenceType: entity.type,
        email,
        phone,
        address,
        source: "local-reference-data",
        aliases: Array.isArray(entity.aliases)
          ? entity.aliases.map((alias: any) => alias.alias).filter(Boolean)
          : [],
        details,
        metadata: details,
      };
    });

    return NextResponse.json({
      ok: true,
      source: "local-reference-data",
      query,
      type: requestedType || "all",
      count: contacts.length,
      contacts,
      results: contacts,
      safety: {
        clioRead: false,
        clioWrite: false,
        sourceOfTruth: "ReferenceEntity/local Barsh Matters data",
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || String(error),
      },
      { status: 500 }
    );
  }
}
