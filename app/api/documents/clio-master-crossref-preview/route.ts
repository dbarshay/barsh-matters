import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clioFetch } from "@/lib/clio";
import { MATTER_CF } from "@/lib/clioFields";

type CFV = {
  id?: number | string;
  value?: unknown;
  custom_field?: { id?: number | string; name?: string };
};

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function numberOrNull(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function cfId(cfv: CFV): number {
  return Number(cfv?.custom_field?.id || 0);
}

function findCfv(matter: any, fieldId: number): CFV | null {
  const rows = Array.isArray(matter?.custom_field_values) ? matter.custom_field_values : [];
  return rows.find((row: CFV) => cfId(row) === Number(fieldId)) || null;
}

function parseLawsuitMatters(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(clean).filter(Boolean);
  }

  const raw = clean(value);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map(clean).filter(Boolean);
  } catch {
    // Fall back to comma/space parsing.
  }

  return raw
    .split(/[,;\n]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

async function readClioMatter(matterId: number) {
  const fields = [
    "id",
    "etag",
    "display_number",
    "description",
    "custom_field_values{id,value,custom_field}",
  ].join(",");

  const res = await clioFetch(
    `/api/v4/matters/${encodeURIComponent(String(matterId))}.json?fields=${encodeURIComponent(fields)}`
  );

  const bodyText = await res.text();
  let json: any = {};

  try {
    json = bodyText ? JSON.parse(bodyText) : {};
  } catch {
    json = { raw: bodyText };
  }

  if (!res.ok) {
    throw new Error(`Could not read Clio matter ${matterId}: status ${res.status}; body ${bodyText || "(empty)"}`);
  }

  return json?.data || null;
}

function buildPlannedFieldValue(params: {
  matter: any;
  fieldId: number;
  fieldLabel: string;
  nextValue: string;
}) {
  const existing = findCfv(params.matter, params.fieldId);

  return {
    fieldId: params.fieldId,
    fieldLabel: params.fieldLabel,
    existingCustomFieldValueId: existing?.id || null,
    currentValue: existing?.value ?? null,
    nextValue: params.nextValue,
    writable: Boolean(existing?.id),
    blockingReason: existing?.id ? "" : `${params.fieldLabel} custom field value record does not exist on this Clio matter.`,
  };
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const masterLawsuitId = clean(url.searchParams.get("masterLawsuitId")) || "2026.05.00001";

    const lawsuit = await prisma.lawsuit.findUnique({
      where: { masterLawsuitId },
    });

    if (!lawsuit) {
      return NextResponse.json(
        {
          ok: false,
          action: "clio-master-crossref-preview",
          previewOnly: true,
          clioRecordsChanged: false,
          databaseRecordsChanged: false,
          error: `No local Lawsuit row found for ${masterLawsuitId}.`,
        },
        { status: 404 }
      );
    }

    const childDisplayNumbers = parseLawsuitMatters(lawsuit.lawsuitMatters);
    const claimIndexRows = await prisma.claimIndex.findMany({
      where: { master_lawsuit_id: masterLawsuitId },
      select: {
        matter_id: true,
        display_number: true,
      },
      orderBy: [{ display_number: "asc" }],
      take: 100,
    });

    const childRows = claimIndexRows.filter((row) =>
      childDisplayNumbers.length
        ? childDisplayNumbers.includes(clean(row.display_number))
        : clean(row.display_number) !== clean(lawsuit.clioMasterDisplayNumber)
    );

    const masterMatterId = numberOrNull(lawsuit.clioMasterMatterId);
    const childMatterIds = childRows
      .map((row) => numberOrNull(row.matter_id))
      .filter((id): id is number => Boolean(id));

    const targetMatterIds = Array.from(new Set([
      ...childMatterIds,
      ...(masterMatterId ? [masterMatterId] : []),
    ]));

    const lawsuitMattersValue = childRows
      .map((row) => clean(row.display_number))
      .filter(Boolean)
      .join(", ");

    const masterLawsuitDisplayValue = clean(lawsuit.clioMasterDisplayNumber)
      ? `${masterLawsuitId} / ${clean(lawsuit.clioMasterDisplayNumber)}`
      : masterLawsuitId;

    const blockingWarnings: string[] = [];

    if (!masterMatterId) {
      blockingWarnings.push("No local Clio master matter mapping exists on the Lawsuit row.");
    }

    if (!targetMatterIds.length) {
      blockingWarnings.push("No target Clio matters were found for cross-reference preview.");
    }

    if (!lawsuitMattersValue) {
      blockingWarnings.push("No child lawsuit matter BRL numbers were resolved.");
    }

    const targets = [];

    for (const matterId of targetMatterIds) {
      try {
        const matter = await readClioMatter(matterId);
        const displayNumber = clean(matter?.display_number);

        const plannedFields = [
          buildPlannedFieldValue({
            matter,
            fieldId: MATTER_CF.MASTER_LAWSUIT_ID,
            fieldLabel: "MASTER LAWSUIT ID",
            nextValue: masterLawsuitDisplayValue,
          }),
          buildPlannedFieldValue({
            matter,
            fieldId: MATTER_CF.LAWSUIT_MATTERS,
            fieldLabel: "LAWSUIT MATTERS",
            nextValue: lawsuitMattersValue,
          }),
          buildPlannedFieldValue({
            matter,
            fieldId: MATTER_CF.LAWSUIT_MATTER_BRL_NUMBERS,
            fieldLabel: "LAWSUIT MATTERS (BRL NUMBERS)",
            nextValue: lawsuitMattersValue,
          }),
        ];

        const missing = plannedFields.filter((field) => !field.writable);

        targets.push({
          ok: true,
          matterId,
          displayNumber,
          description: clean(matter?.description),
          isMasterClioMatter: matterId === masterMatterId,
          etag: matter?.etag || null,
          plannedFields,
          writable: missing.length === 0,
          blockingReasons: missing.map((field) => field.blockingReason).filter(Boolean),
        });
      } catch (error: any) {
        targets.push({
          ok: false,
          matterId,
          writable: false,
          error: error?.message || "Could not read target Clio matter.",
        });
      }
    }

    const targetBlockingReasons = targets.flatMap((target: any) =>
      Array.isArray(target.blockingReasons) ? target.blockingReasons : target.error ? [target.error] : []
    );

    return NextResponse.json({
      ok: true,
      action: "clio-master-crossref-preview",
      previewOnly: true,
      clioRecordsChanged: false,
      databaseRecordsChanged: false,
      masterLawsuitId,
      localMapping: {
        clioMasterMatterId: lawsuit.clioMasterMatterId || null,
        clioMasterDisplayNumber: lawsuit.clioMasterDisplayNumber || null,
        clioMasterMatterDescription: lawsuit.clioMasterMatterDescription || null,
      },
      resolvedValues: {
        childDisplayNumbers,
        lawsuitMattersValue,
        masterLawsuitDisplayValue,
        childMatterIds,
        masterMatterId,
        targetMatterIds,
      },
      targets,
      blockingWarnings,
      targetBlockingReasons,
      readyForConfirm:
        blockingWarnings.length === 0 &&
        targetBlockingReasons.length === 0 &&
        targets.length > 0 &&
        targets.every((target: any) => target.ok && target.writable),
      requirementsForConfirmRoute: {
        typedConfirmationRequired: `WRITE CLIO CROSSREF ${masterLawsuitId}`,
        writesOnlyReferenceFields: true,
        fields: [
          "MASTER LAWSUIT ID",
          "LAWSUIT MATTERS",
          "LAWSUIT MATTERS (BRL NUMBERS)",
        ],
      },
      note:
        "Preview only.  This route plans Clio cross-reference custom-field updates for child and master Clio matters.  It does not write to Clio or Barsh Matters.",
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        action: "clio-master-crossref-preview",
        previewOnly: true,
        clioRecordsChanged: false,
        databaseRecordsChanged: false,
        error: error?.message || "Clio master cross-reference preview failed.",
      },
      { status: 500 }
    );
  }
}
