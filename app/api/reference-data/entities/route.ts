import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { createMatterAuditLogEntry } from "@/lib/auditLog";
import { prisma } from "@/lib/prisma";
import {
  cleanReferenceText,
  findReferenceEntityById,
  normalizeReferenceEntityType,
  normalizeReferenceText,
  parseActiveFilter,
  referenceTypeOptions,
  safeLimit,
} from "@/lib/referenceData";

export const runtime = "nodejs";

function safetyLocalReferenceData() {
  return {
    localBarshMattersReferenceData: true,
    clioData: false,
    noClioRecordsChanged: true,
    noDocumentsGenerated: true,
    noPrintQueueRecordsChanged: true,
    hardDeleteSupported: false,
  };
}

function actorFromBody(body: any) {
  return {
    actorName: cleanReferenceText(body?.actorName) || "Barsh Matters User",
    actorEmail: cleanReferenceText(body?.actorEmail) || null,
  };
}

function parseDetails(value: unknown): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return Prisma.JsonNull;

  if (typeof value === "string") {
    const cleaned = value.trim();
    if (!cleaned) return Prisma.JsonNull;
    try {
      return JSON.parse(cleaned) as Prisma.InputJsonValue;
    } catch {
      throw new Error("Details must be valid JSON.");
    }
  }

  return value as Prisma.InputJsonValue;
}

function serializeEntity(entity: any) {
  return {
    ...entity,
    aliasCount: Array.isArray(entity?.aliases) ? entity.aliases.length : undefined,
  };
}

export async function GET(req: NextRequest) {
  try {
    const rawType = req.nextUrl.searchParams.get("type") || "individual";
    const type = normalizeReferenceEntityType(rawType);
    const query = cleanReferenceText(req.nextUrl.searchParams.get("q"));
    const normalizedQuery = normalizeReferenceText(query);
    const active = parseActiveFilter(req.nextUrl.searchParams.get("active"));
    const limit = safeLimit(req.nextUrl.searchParams.get("limit"), 50, 10000);

    const where: Prisma.ReferenceEntityWhereInput = { type };

    if (active !== undefined) {
      where.active = active;
    }

    if (normalizedQuery) {
      where.OR = [
        { normalizedName: { contains: normalizedQuery, mode: "insensitive" } },
        { displayName: { contains: query, mode: "insensitive" } },
        {
          aliases: {
            some: {
              normalizedAlias: { contains: normalizedQuery, mode: "insensitive" },
            },
          },
        },
      ];
    }

    const entities = await prisma.referenceEntity.findMany({
      where,
      include: { aliases: { orderBy: { alias: "asc" } } },
      orderBy: [{ active: "desc" }, { displayName: "asc" }],
      take: limit,
    });

    return NextResponse.json({
      ok: true,
      action: "reference-entity-search",
      type,
      typeOptions: referenceTypeOptions(),
      query,
      active: active === undefined ? "all" : active,
      count: entities.length,
      entities: entities.map(serializeEntity),
      safety: {
        ...safetyLocalReferenceData(),
        readOnly: true,
        noDatabaseRecordsChanged: true,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        action: "reference-entity-search",
        error: err?.message || "Unknown reference entity search error.",
        safety: safetyLocalReferenceData(),
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const type = normalizeReferenceEntityType(body?.type);
    const displayName = cleanReferenceText(body?.displayName);
    const normalizedName = normalizeReferenceText(displayName);
    const notes = cleanReferenceText(body?.notes) || null;
    const details = parseDetails(body?.details);
    const source = cleanReferenceText(body?.source) || "barsh-matters-local";

    if (!displayName) {
      return NextResponse.json(
        {
          ok: false,
          action: "reference-entity-create",
          error: "Display name is required.",
          safety: safetyLocalReferenceData(),
        },
        { status: 400 }
      );
    }

    const entity = await prisma.referenceEntity.create({
      data: {
        type,
        displayName,
        normalizedName,
        active: true,
        notes,
        details,
        source,
      },
      include: { aliases: { orderBy: { alias: "asc" } } },
    });

    const actor = actorFromBody(body);
    await createMatterAuditLogEntry({
      action: "reference_entity_created",
      summary: `Created ${type} reference record: ${displayName}`,
      entityType: "reference_entity",
      fieldName: "displayName",
      priorValue: null,
      newValue: { id: entity.id, type, displayName, notes, details: entity.details, source },
      details: { localReferenceData: true, clioData: false },
      sourcePage: "admin-reference-data",
      workflow: "reference-data",
      actorName: actor.actorName,
      actorEmail: actor.actorEmail,
    });

    return NextResponse.json({
      ok: true,
      action: "reference-entity-create",
      entity: serializeEntity(entity),
      safety: {
        ...safetyLocalReferenceData(),
        databaseRecordsChanged: true,
      },
    });
  } catch (err: any) {
    const status = err?.code === "P2002" ? 409 : 500;
    return NextResponse.json(
      {
        ok: false,
        action: "reference-entity-create",
        error:
          err?.code === "P2002"
            ? "A reference record with this type and normalized display name already exists."
            : err?.message || "Unknown reference entity create error.",
        safety: safetyLocalReferenceData(),
      },
      { status }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const id = cleanReferenceText(body?.id);
    const operation = cleanReferenceText(body?.operation || "update").toLowerCase();

    if (!id) {
      return NextResponse.json(
        {
          ok: false,
          action: "reference-entity-update",
          error: "Reference entity id is required.",
          safety: safetyLocalReferenceData(),
        },
        { status: 400 }
      );
    }

    const prior = await findReferenceEntityById(id);
    if (!prior) {
      return NextResponse.json(
        {
          ok: false,
          action: "reference-entity-update",
          error: "Reference entity not found.",
          safety: safetyLocalReferenceData(),
        },
        { status: 404 }
      );
    }

    const data: Prisma.ReferenceEntityUpdateInput = {};

    if (operation === "deactivate") {
      data.active = false;
    } else if (operation === "reactivate") {
      data.active = true;
    } else {
      if (body?.displayName !== undefined) {
        const displayName = cleanReferenceText(body.displayName);
        if (!displayName) {
          return NextResponse.json(
            {
              ok: false,
              action: "reference-entity-update",
              error: "Display name cannot be blank.",
              safety: safetyLocalReferenceData(),
            },
            { status: 400 }
          );
        }
        data.displayName = displayName;
        data.normalizedName = normalizeReferenceText(displayName);
      }

      if (body?.notes !== undefined) {
        data.notes = cleanReferenceText(body.notes) || null;
      }

      if (body?.details !== undefined) {
        data.details = parseDetails(body.details);
      }

      if (body?.source !== undefined) {
        data.source = cleanReferenceText(body.source) || "barsh-matters-local";
      }
    }

    const entity = await prisma.referenceEntity.update({
      where: { id },
      data,
      include: { aliases: { orderBy: { alias: "asc" } } },
    });

    const actor = actorFromBody(body);
    await createMatterAuditLogEntry({
      action:
        operation === "deactivate"
          ? "reference_entity_deactivated"
          : operation === "reactivate"
            ? "reference_entity_reactivated"
            : "reference_entity_updated",
      summary:
        operation === "deactivate"
          ? `Deactivated ${prior.type} reference record: ${prior.displayName}`
          : operation === "reactivate"
            ? `Reactivated ${prior.type} reference record: ${prior.displayName}`
            : `Updated ${prior.type} reference record: ${entity.displayName}`,
      entityType: "reference_entity",
      fieldName: operation,
      priorValue: {
        id: prior.id,
        type: prior.type,
        displayName: prior.displayName,
        active: prior.active,
        notes: prior.notes,
        details: prior.details,
        source: prior.source,
      },
      newValue: {
        id: entity.id,
        type: entity.type,
        displayName: entity.displayName,
        active: entity.active,
        notes: entity.notes,
        details: entity.details,
        source: entity.source,
      },
      details: { localReferenceData: true, clioData: false },
      sourcePage: "admin-reference-data",
      workflow: "reference-data",
      actorName: actor.actorName,
      actorEmail: actor.actorEmail,
    });

    return NextResponse.json({
      ok: true,
      action: "reference-entity-update",
      operation,
      entity: serializeEntity(entity),
      safety: {
        ...safetyLocalReferenceData(),
        databaseRecordsChanged: true,
        hardDeletePerformed: false,
      },
    });
  } catch (err: any) {
    const status = err?.code === "P2002" ? 409 : 500;
    return NextResponse.json(
      {
        ok: false,
        action: "reference-entity-update",
        error:
          err?.code === "P2002"
            ? "A reference record with this type and normalized display name already exists."
            : err?.message || "Unknown reference entity update error.",
        safety: safetyLocalReferenceData(),
      },
      { status }
    );
  }
}
