import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type IdentityFieldName =
  | "patient_name"
  | "client_name"
  | "insurer_name"
  | "claim_number_raw"
  | "treating_provider"
  | "date_of_loss";

type IdentityFieldConfig = {
  fieldName: IdentityFieldName;
  label: string;
  referenceType?: string;
};

const IDENTITY_FIELDS: Record<string, IdentityFieldConfig> = {
  patient_name: {
    fieldName: "patient_name",
    label: "Patient",
  },
  client_name: {
    fieldName: "client_name",
    label: "Provider",
    referenceType: "provider_client",
  },
  insurer_name: {
    fieldName: "insurer_name",
    label: "Insurer",
    referenceType: "insurer_company",
  },
  claim_number_raw: {
    fieldName: "claim_number_raw",
    label: "Claim Number",
  },
  date_of_loss: { fieldName: "date_of_loss", label: "Date of Loss" },
  treating_provider: {
    fieldName: "treating_provider",
    label: "Treating Provider",
    referenceType: "treating_provider",
  },
};

function textValue(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeName(value: unknown): string {
  return textValue(value).toLowerCase().replace(/\s+/g, " ");
}

function normalizeClaimNumber(value: unknown): string {
  return textValue(value).toUpperCase().replace(/[^A-Z0-9]/g, "");
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

function getFieldConfig(rawFieldName: unknown): IdentityFieldConfig | null {
  const fieldName = textValue(rawFieldName);
  return IDENTITY_FIELDS[fieldName] || null;
}

function claimIndexValue(claimIndex: any, fieldName: IdentityFieldName): string {
  if (fieldName === "date_of_loss") return textValue(claimIndex?.date_of_loss);

  if (fieldName === "patient_name") return textValue(claimIndex?.patient_name);
  if (fieldName === "client_name") return textValue(claimIndex?.client_name);
  if (fieldName === "insurer_name") return textValue(claimIndex?.insurer_name);
  if (fieldName === "claim_number_raw") {
    return textValue(claimIndex?.claim_number_raw || claimIndex?.claim_number_normalized);
  }
  if (fieldName === "treating_provider") return textValue(claimIndex?.treating_provider);
  return "";
}

async function findActiveReferenceEntity(config: IdentityFieldConfig, fieldValueId: string, fieldValue: string) {
  if (!config.referenceType) return null;

  if (fieldValueId) {
    const byId = await prisma.referenceEntity.findFirst({
      where: {
        id: fieldValueId,
        type: config.referenceType,
        active: true,
      },
      select: {
        id: true,
        type: true,
        displayName: true,
        normalizedName: true,
        active: true,
        details: true,
      },
    });

    if (byId) return byId;
  }

  if (!fieldValue) return null;

  const candidates = await prisma.referenceEntity.findMany({
    where: {
      type: config.referenceType,
      active: true,
    },
    select: {
      id: true,
      type: true,
      displayName: true,
      normalizedName: true,
      active: true,
      details: true,
    },
    orderBy: {
      displayName: "asc",
    },
    take: 5000,
  });

  const normalizedValue = normalizeName(fieldValue);

  return (
    candidates.find((candidate) => normalizeName(candidate.displayName) === normalizedValue) ||
    candidates.find((candidate) => normalizeName(candidate.normalizedName) === normalizedValue) ||
    null
  );
}

function updateDataForField(config: IdentityFieldConfig, nextValue: string) {
  if (config.fieldName === "date_of_loss") {
    return {
      date_of_loss: nextValue || null,
      indexed_at: new Date(),
    };
  }

  if (config.fieldName === "patient_name") {
    return {
      patient_name: nextValue,
      indexed_at: new Date(),
    };
  }

  if (config.fieldName === "client_name") {
    return {
      client_name: nextValue,
      provider_name: nextValue,
      indexed_at: new Date(),
    };
  }

  if (config.fieldName === "insurer_name") {
    return {
      insurer_name: nextValue,
      indexed_at: new Date(),
    };
  }

  if (config.fieldName === "claim_number_raw") {
    return {
      claim_number_raw: nextValue,
      claim_number_normalized: normalizeClaimNumber(nextValue) || nextValue,
      indexed_at: new Date(),
    };
  }

  if (config.fieldName === "treating_provider") {
    return {
      treating_provider: nextValue,
      indexed_at: new Date(),
    };
  }

  return {
    indexed_at: new Date(),
  };
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const matterId = Number(url.searchParams.get("matterId"));
    const config = getFieldConfig(url.searchParams.get("fieldName"));

    if (!Number.isFinite(matterId) || matterId <= 0) {
      return jsonError("A valid matterId is required.");
    }

    if (!config) {
      return jsonError("Unsupported identity field.");
    }

    const claimIndex = await prisma.claimIndex.findUnique({
      where: {
        matter_id: matterId,
      },
      select: {
        matter_id: true,
        display_number: true,
        patient_name: true,
        client_name: true,
        provider_name: true,
        insurer_name: true,
        claim_number_raw: true,
        claim_number_normalized: true,
        date_of_loss: true,
        treating_provider: true,
        master_lawsuit_id: true,
      },
    });

    if (!claimIndex) {
      return jsonError("No local matter index row exists for this matter.", 404, {
        matterId,
        fieldName: config.fieldName,
      });
    }

    const fieldValue = claimIndexValue(claimIndex, config.fieldName);
    const referenceEntity = config.referenceType
      ? await findActiveReferenceEntity(config, "", fieldValue)
      : null;

    return NextResponse.json({
      ok: true,
      source: "claimindex",
      noClioWrite: true,
      noClioRead: true,
      matterId: claimIndex.matter_id,
      matterDisplayNumber: claimIndex.display_number || "",
      field: {
        fieldName: config.fieldName,
        label: config.label,
        fieldValue,
        fieldValueId: referenceEntity?.id || "",
        referenceType: config.referenceType || "",
      },
      claimIndex,
    });
  } catch (err: any) {
    return jsonError(err?.message || "ClaimIndex identity-field read failed.", 500);
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));

    const matterId = Number(body?.matterId);
    const matterDisplayNumberFromBody = textValue(body?.matterDisplayNumber);
    const config = getFieldConfig(body?.fieldName);
    const fieldValueId = textValue(body?.fieldValueId);
    const submittedValue = textValue(body?.fieldValue);
    const actorName = textValue(body?.actorName) || "Barsh Matters User";
    const actorEmail = textValue(body?.actorEmail);

    if (!Number.isFinite(matterId) || matterId <= 0) {
      return jsonError("A valid matterId is required.");
    }

    if (!config) {
      return jsonError("Unsupported identity field.");
    }

    if (!fieldValueId && !submittedValue) {
      return jsonError(`${config.label} is required.`);
    }

    const referenceEntity = config.referenceType
      ? await findActiveReferenceEntity(config, fieldValueId, submittedValue)
      : null;

    if (config.referenceType && !referenceEntity) {
      return jsonError(`${config.label} must match an active local reference-data record.`, 422, {
        fieldName: config.fieldName,
        referenceType: config.referenceType,
      });
    }

    const nextValue = textValue(referenceEntity?.displayName || submittedValue);

    if (!nextValue) {
      return jsonError(`${config.label} is required.`);
    }

    const existing = await prisma.claimIndex.findUnique({
      where: {
        matter_id: matterId,
      },
      select: {
        matter_id: true,
        display_number: true,
        patient_name: true,
        client_name: true,
        provider_name: true,
        insurer_name: true,
        claim_number_raw: true,
        claim_number_normalized: true,
        date_of_loss: true,
        treating_provider: true,
        master_lawsuit_id: true,
      },
    });

    if (!existing) {
      return jsonError("No local matter index row exists for this matter. Import or locally create the matter before saving local identity fields.", 404, {
        matterId,
        fieldName: config.fieldName,
      });
    }

    const priorValue = claimIndexValue(existing, config.fieldName);

    if (priorValue === nextValue) {
      return NextResponse.json({
        ok: true,
        source: "claimindex",
        noClioWrite: true,
        noClioRead: true,
        unchanged: true,
        matterId,
        matterDisplayNumber: existing.display_number || matterDisplayNumberFromBody || "",
        field: {
          fieldName: config.fieldName,
          label: config.label,
          fieldValue: nextValue,
          fieldValueId: referenceEntity?.id || "",
          referenceType: config.referenceType || "",
        },
        safety: {
          clioWrite: false,
          clioRead: false,
          storage: "ClaimIndex",
          auditLogCreated: false,
        },
      });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const claimIndex = await tx.claimIndex.update({
        where: {
          matter_id: matterId,
        },
        data: updateDataForField(config, nextValue),
        select: {
          matter_id: true,
          display_number: true,
          patient_name: true,
          client_name: true,
          provider_name: true,
          insurer_name: true,
          claim_number_raw: true,
          claim_number_normalized: true,
          date_of_loss: true,
          treating_provider: true,
          master_lawsuit_id: true,
        },
      });

      await tx.auditLog.create({
        data: {
          action: "claimindex-identity-field-update",
          summary: `${config.label} changed from ${priorValue || "—"} to ${nextValue || "—"}.`,
          entityType: "matter",
          fieldName: config.fieldName,
          priorValue: {
            fieldName: config.fieldName,
            value: priorValue || null,
          },
          newValue: {
            fieldName: config.fieldName,
            value: nextValue || null,
            referenceEntityId: referenceEntity?.id || null,
          },
          details: {
            source: "claimindex-identity-field-route",
            storage: "ClaimIndex",
            referenceType: config.referenceType || null,
            referenceEntityId: referenceEntity?.id || null,
            noClioWrite: true,
            noClioRead: true,
          },
          affectedMatterIds: [matterId],
          matterId,
          matterDisplayNumber: claimIndex.display_number || matterDisplayNumberFromBody || null,
          masterLawsuitId: claimIndex.master_lawsuit_id || null,
          sourcePage: "direct-matter",
          workflow: "local-identity",
          actorName,
          actorEmail: actorEmail || null,
        },
      });

      return claimIndex;
    });

    const updatedValue = claimIndexValue(updated, config.fieldName);

    return NextResponse.json({
      ok: true,
      source: "claimindex",
      noClioWrite: true,
      noClioRead: true,
      matterId: updated.matter_id,
      matterDisplayNumber: updated.display_number || matterDisplayNumberFromBody || "",
      field: {
        fieldName: config.fieldName,
        label: config.label,
        fieldValue: updatedValue,
        fieldValueId: referenceEntity?.id || "",
        referenceType: config.referenceType || "",
      },
      claimIndex: updated,
      safety: {
        clioWrite: false,
        clioRead: false,
        storage: "ClaimIndex",
        auditLogCreated: true,
      },
    });
  } catch (err: any) {
    return jsonError(err?.message || "ClaimIndex identity-field update failed.", 500);
  }
}
