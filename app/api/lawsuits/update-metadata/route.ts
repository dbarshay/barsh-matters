import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const costEntryMetadataFields = [
  "filingFee",
  "indexFee",
  "filingFeeEntryDate",
  "filingFeeEntryAmount",
  "filingFeeEntryHistory",
  "serviceFee",
  "serviceFeeEntryDate",
  "serviceFeeEntryAmount",
  "serviceFeeEntryHistory",
  "otherCourtCosts",
  "otherCourtFees",
  "otherCourtCostsEntryDate",
  "otherCourtCostsEntryAmount",
  "otherCourtCostsEntryHistory",
];

function costEntryMetadataFromBody(body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of costEntryMetadataFields) {
    if (field in body) out[field] = body[field];
  }
  return out;
}

function text(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const cleaned = String(value).replace(/[$,\s]/g, "");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseMatterIds(lawsuitMatters: string | null | undefined): number[] {
  return String(lawsuitMatters || "")
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isFinite(value) && value > 0);
}

function amountForMode(row: any, mode: string): number {
  const value = mode === "claim_amount" ? row.claim_amount : row.balance_presuit;
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}



async function computeLocalAmountSought(params: {
  lawsuitMatters: string;
  mode: string;
  customAmountSought: number | null;
}) {
  const matterIds = parseMatterIds(params.lawsuitMatters);

  if (params.mode === "custom") {
    return {
      amountSought: params.customAmountSought,
      breakdown: {
        mode: "custom",
        amountSought: params.customAmountSought,
        customAmountSought: params.customAmountSought,
        sourceField: "custom",
        selectedMatterCount: matterIds.length,
        components: matterIds.map((matterId) => ({
          matterId,
          amount: null,
        })),
      },
    };
  }

  const rows =
    matterIds.length > 0
      ? await prisma.claimIndex.findMany({
          where: {
            matter_id: {
              in: matterIds,
            },
          },
          orderBy: [{ display_number: "asc" }],
        })
      : [];

  const sourceField = params.mode === "claim_amount" ? "claim_amount" : "balance_presuit";
  const components = rows.map((row) => ({
    matterId: Number(row.matter_id),
    displayNumber: row.display_number || String(row.matter_id),
    amount: amountForMode(row, params.mode),
    sourceField,
  }));

  const amountSought = components.reduce((sum, item) => sum + item.amount, 0);

  return {
    amountSought,
    breakdown: {
      mode: params.mode,
      amountSought,
      customAmountSought: null,
      sourceField,
      selectedMatterCount: rows.length,
      components,
      missingMatterIds: matterIds.filter(
        (matterId) => !rows.some((row) => Number(row.matter_id) === matterId)
      ),
    },
  };
}

export async function GET(req: NextRequest) {
  try {
    const masterLawsuitId = text(req.nextUrl.searchParams.get("masterLawsuitId"));

    if (!masterLawsuitId) {
      return NextResponse.json(
        { ok: false, error: "masterLawsuitId is required." },
        { status: 400 }
      );
    }

    const lawsuit = await prisma.lawsuit.findUnique({
      where: { masterLawsuitId },
    });

    if (!lawsuit) {
      return NextResponse.json(
        {
          ok: false,
          error: `No local Lawsuit row found for MASTER_LAWSUIT_ID ${masterLawsuitId}.`,
          sourceOfTruth: "local-lawsuit-schema",
          noClioRead: true,
          noClioWrite: true,
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      action: "local-lawsuit-metadata-read",
      sourceOfTruth: "local-lawsuit-schema",
      noClioRead: true,
      noClioWrite: true,
      noClaimIndexHydration: true,
      lawsuit,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Failed to read local lawsuit metadata.",
        sourceOfTruth: "local-lawsuit-schema",
        noClioRead: true,
        noClioWrite: true,
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    const masterLawsuitId = text(body?.masterLawsuitId);
    if (!masterLawsuitId) {
      return NextResponse.json(
        { ok: false, error: "masterLawsuitId is required." },
        { status: 400 }
      );
    }

    const existing = await prisma.lawsuit.findUnique({
      where: { masterLawsuitId },
    });

    if (!existing) {
      return NextResponse.json(
        {
          ok: false,
          error: `No local Lawsuit row found for MASTER_LAWSUIT_ID ${masterLawsuitId}.`,
          sourceOfTruth: "local-lawsuit-schema",
          noClioRead: true,
          noClioWrite: true,
        },
        { status: 404 }
      );
    }

    const amountSoughtModeRaw = text(body?.amountSoughtMode || existing.amountSoughtMode || "balance_presuit");
    const amountSoughtMode =
      amountSoughtModeRaw === "claim_amount" || amountSoughtModeRaw === "custom"
        ? amountSoughtModeRaw
        : "balance_presuit";

    const customAmountSought =
      amountSoughtMode === "custom"
        ? numberOrNull(body?.customAmountSought)
        : null;

    if (amountSoughtMode === "custom" && customAmountSought === null) {
      return NextResponse.json(
        {
          ok: false,
          error: "customAmountSought is required when amountSoughtMode is custom.",
          sourceOfTruth: "local-lawsuit-schema",
          noClioRead: true,
          noClioWrite: true,
        },
        { status: 400 }
      );
    }

    const computed = await computeLocalAmountSought({
      lawsuitMatters: existing.lawsuitMatters,
      mode: amountSoughtMode,
      customAmountSought,
    });

    const existingOptions =
      existing.lawsuitOptions && typeof existing.lawsuitOptions === "object" && !Array.isArray(existing.lawsuitOptions)
        ? (existing.lawsuitOptions as Record<string, any>)
        : {};

    const nextStatus = text(
      body?.status ||
        body?.matterStatus ||
        body?.matter_status ||
        existingOptions.status ||
        existingOptions.matterStatus ||
        existingOptions.matter_status ||
        existingOptions.workflowStatus ||
        existingOptions.workflow_status
    );

    const lawsuitOptions = {
      ...existingOptions,
      source: "local-lawsuit-metadata-update",
      ...costEntryMetadataFromBody(body),
      noClioRead: true,
      noClioWrite: true,
      status: nextStatus,
      matterStatus: nextStatus,
      matter_status: nextStatus,
      workflowStatus: nextStatus,
      workflow_status: nextStatus,
      venue: text(body?.venue),
      venueSelection: text(body?.venueSelection),
      venueOther: text(body?.venueOther),
      amountSoughtMode,
      customAmountSought,
      indexAaaNumber: text(body?.indexAaaNumber),
      adversaryAttorney: text(body?.adversaryAttorney),
      // Present-key check so master-info edits can clear it, while other save
      // payloads (e.g. cost-entry saves) that omit the key preserve it.
      adversaryAttorneyFileNo:
        "adversaryAttorneyFileNo" in body
          ? text(body.adversaryAttorneyFileNo)
          : text(existingOptions.adversaryAttorneyFileNo),
      dateFiled: text(body?.dateFiled || existingOptions.dateFiled),
      dateServed:
        "dateServed" in body
          ? text(body.dateServed)
          : text(existingOptions.dateServed),
      dateServiceComplete:
        "dateServiceComplete" in body
          ? text(body.dateServiceComplete)
          : text(existingOptions.dateServiceComplete),
      dateAnswerReceived:
        "dateAnswerReceived" in body
          ? text(body.dateAnswerReceived)
          : text(existingOptions.dateAnswerReceived),
      selectedAdversaryAttorneyDetails:
        body?.selectedAdversaryAttorneyDetails && typeof body.selectedAdversaryAttorneyDetails === "object"
          ? body.selectedAdversaryAttorneyDetails
          : null,
      notes: text(body?.lawsuitNotes || body?.notes),
    };

    const lawsuit = await prisma.lawsuit.update({
      where: { masterLawsuitId },
      data: {
        venue: text(body?.venue) || null,
        venueSelection: text(body?.venueSelection) || null,
        venueOther: text(body?.venueOther) || null,
        indexAaaNumber: text(body?.indexAaaNumber) || null,
        lawsuitNotes: text(body?.lawsuitNotes || body?.notes) || null,
        lawsuitOptions,
        amountSoughtMode,
        amountSought: computed.amountSought,
        customAmountSought,
        amountSoughtBreakdown: computed.breakdown,
      },
    });


    return NextResponse.json({
      ok: true,
      action: "local-lawsuit-metadata-update",
      sourceOfTruth: "local-lawsuit-schema",
      noClioRead: true,
      noClioWrite: true,
      noClaimIndexHydration: true,
      lawsuit,
      amountSought: computed.amountSought,
      amountSoughtBreakdown: computed.breakdown,
      clioPostFilingWrite: {
        ok: false,
        skipped: true,
        reason: "Clio post-filing writeback removed from update-metadata route.  Use a separately approved explicit document-shell sync workflow if needed.",
        clioWriteAttempted: false,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Failed to update local lawsuit metadata.",
        sourceOfTruth: "local-lawsuit-schema",
        noClioRead: true,
        noClioWrite: true,
      },
      { status: 500 }
    );
  }
}
