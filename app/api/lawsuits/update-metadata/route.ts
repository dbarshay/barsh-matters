import { NextRequest, NextResponse } from "next/server";
import { clioFetch } from "@/lib/clio";
import { MATTER_CF } from "@/lib/clioFields";
import { prisma } from "@/lib/prisma";
import { upsertClaimIndexFromMatter } from "@/lib/claimIndexUpsert";

type CFV = {
  id: number | string;
  value: unknown;
  custom_field?: {
    id?: number | string;
  };
};

type ClioMatter = {
  id: number;
  etag?: string;
  display_number?: string;
  description?: string;
  custom_field_values?: CFV[];
};

const LIVE_FIELDS = [
  "id",
  "etag",
  "display_number",
  "description",
  "custom_field_values{id,value,custom_field}",
].join(",");

function text(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function parseMatterIds(value: unknown): number[] {
  return Array.from(
    new Set(
      text(value)
        .split(",")
        .map((v) => Number(v.trim()))
        .filter((n) => Number.isFinite(n) && n > 0)
    )
  );
}

function displayNumberList(matters: ClioMatter[]): string {
  return Array.from(
    new Set(
      matters
        .map((matter) => text(matter.display_number) || String(matter.id))
        .filter(Boolean)
    )
  )
    .sort((a, b) => a.localeCompare(b))
    .join(", ");
}

function amountNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const cleaned = String(value).replace(/[$,\s]/g, "");
  if (!cleaned) return null;

  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function normalizeAmountSoughtMode(value: unknown): "balance_presuit" | "claim_amount" | "custom" {
  const mode = text(value);

  if (mode === "claim_amount" || mode === "custom") {
    return mode;
  }

  return "balance_presuit";
}

function customFieldNumber(matter: ClioMatter, fieldId: number): number | null {
  return amountNumber(cfv(matter, fieldId)?.value);
}

function computeAmountSought(params: {
  liveMatters: ClioMatter[];
  amountSoughtMode: "balance_presuit" | "claim_amount" | "custom";
  customAmountSought: number | null;
}) {
  const mode = params.amountSoughtMode;
  const billMatters = params.liveMatters.filter((matter) => !isMasterMatter(matter));

  if (mode === "custom") {
    if (params.customAmountSought === null) {
      throw new Error("Custom Amount is required when Amount Sought is set to Custom Amount.");
    }

    return {
      mode,
      amountSought: params.customAmountSought,
      customAmountSought: params.customAmountSought,
      sourceField: "custom",
      selectedMatterCount: billMatters.length,
      excludedMasterMatterIds: params.liveMatters
        .filter((matter) => isMasterMatter(matter))
        .map((matter) => Number(matter.id)),
      components: billMatters.map((matter) => ({
        matterId: matter.id,
        displayNumber: matter.display_number || "",
        amount: null,
      })),
      missingAmountMatterIds: [],
    };
  }

  const fieldId =
    mode === "claim_amount"
      ? MATTER_CF.CLAIM_AMOUNT
      : MATTER_CF.BALANCE_PRESUIT;

  const sourceField =
    mode === "claim_amount" ? "CLAIM_AMOUNT" : "BALANCE_PRESUIT";

  const components = billMatters.map((matter) => {
    const amount = customFieldNumber(matter, fieldId);

    return {
      matterId: matter.id,
      displayNumber: matter.display_number || "",
      amount,
    };
  });

  const missingAmountMatterIds = components
    .filter((item) => item.amount === null)
    .map((item) => item.matterId);

  const amountSought = components.reduce(
    (sum, item) => sum + (item.amount ?? 0),
    0
  );

  return {
    mode,
    amountSought,
    customAmountSought: null,
    sourceField,
    selectedMatterCount: billMatters.length,
    excludedMasterMatterIds: params.liveMatters
      .filter((matter) => isMasterMatter(matter))
      .map((matter) => Number(matter.id)),
    components,
    missingAmountMatterIds,
  };
}

function cfv(matter: ClioMatter, fieldId: number): CFV | undefined {
  return matter.custom_field_values?.find(
    (item) => Number(item?.custom_field?.id) === Number(fieldId)
  );
}

function isMasterMatter(matter: ClioMatter): boolean {
  return text(matter.description).toUpperCase().startsWith("MASTER LAWSUIT");
}

async function readMatterLive(matterId: number): Promise<ClioMatter> {
  const res = await clioFetch(
    `/api/v4/matters/${matterId}.json?fields=${encodeURIComponent(LIVE_FIELDS)}`,
    {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    }
  );

  const body = await res.text();

  if (!res.ok) {
    throw new Error(
      `Failed to read matter ${matterId} from Clio: status ${res.status}; body ${body}`
    );
  }

  const matter = body ? JSON.parse(body)?.data : null;

  if (!matter?.id) {
    throw new Error(`Matter ${matterId} was not returned by Clio.`);
  }

  return matter;
}

async function writePostFilingFieldsToClioMatter(params: {
  matter: ClioMatter;
  indexAaaNumber: string;
  lawsuitMatterDisplayNumbers: string;
}) {
  const indexField = cfv(params.matter, MATTER_CF.INDEX_AAA_NUMBER);
  const brlNumbersField = cfv(params.matter, MATTER_CF.LAWSUIT_MATTER_BRL_NUMBERS);

  if (!indexField?.id) {
    throw new Error(
      `Matter ${params.matter.display_number || params.matter.id} is missing INDEX / AAA NUMBER custom field value.`
    );
  }

  if (!params.matter.etag) {
    throw new Error(
      `Matter ${params.matter.display_number || params.matter.id} is missing an ETag and cannot be safely updated.`
    );
  }

  const customFieldValues: Array<{
    id: number | string;
    custom_field: { id: number };
    value: string;
  }> = [
    {
      id: indexField.id,
      custom_field: { id: MATTER_CF.INDEX_AAA_NUMBER },
      value: params.indexAaaNumber,
    },
  ];

  const brlNumbersWrite =
    brlNumbersField?.id && params.lawsuitMatterDisplayNumbers
      ? {
          id: brlNumbersField.id,
          custom_field: { id: MATTER_CF.LAWSUIT_MATTER_BRL_NUMBERS },
          value: params.lawsuitMatterDisplayNumbers,
        }
      : null;

  if (brlNumbersWrite) {
    customFieldValues.push(brlNumbersWrite);
  }

  const res = await clioFetch(`/api/v4/matters/${params.matter.id}.json`, {
    method: "PATCH",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "If-Match": params.matter.etag,
    },
    body: JSON.stringify({
      data: {
        custom_field_values: customFieldValues,
      },
    }),
  });

  const body = await res.text();

  if (!res.ok) {
    throw new Error(
      `Failed to write post-filing fields to Clio matter ${params.matter.display_number || params.matter.id}: status ${res.status}; body ${body}`
    );
  }

  const updatedMatter = await readMatterLive(Number(params.matter.id));
  await upsertClaimIndexFromMatter(updatedMatter);

  return {
    matterId: Number(updatedMatter.id),
    displayNumber: updatedMatter.display_number || "",
    isMaster: isMasterMatter(updatedMatter),
    indexAaaNumber: text(cfv(updatedMatter, MATTER_CF.INDEX_AAA_NUMBER)?.value),
    lawsuitMatterDisplayNumbers: text(
      cfv(updatedMatter, MATTER_CF.LAWSUIT_MATTER_BRL_NUMBERS)?.value
    ),
    wroteLawsuitMatterDisplayNumbers: Boolean(brlNumbersWrite),
    missingLawsuitMatterDisplayNumbersField: !brlNumbersField?.id,
  };
}

async function writePostFilingFieldsToClioLawsuit(params: {
  masterLawsuitId: string;
  lawsuitMatters: string;
  indexAaaNumber: string;
}) {
  const matterIds = parseMatterIds(params.lawsuitMatters);

  if (matterIds.length === 0) {
    throw new Error(
      `No lawsuit matters found for MASTER_LAWSUIT_ID ${params.masterLawsuitId}.`
    );
  }

  const liveMatters = [];

  for (const matterId of matterIds) {
    liveMatters.push(await readMatterLive(matterId));
  }

  const lawsuitMatterDisplayNumbers = displayNumberList(liveMatters);
  const results = [];

  for (const matter of liveMatters) {
    const result = await writePostFilingFieldsToClioMatter({
      matter,
      indexAaaNumber: params.indexAaaNumber,
      lawsuitMatterDisplayNumbers,
    });

    results.push(result);
  }

  const masterWrite = results.find((result) => result.isMaster) || null;

  if (!masterWrite) {
    throw new Error(
      `Post-filing fields were written to ${results.length} matter(s), but no Clio master matter was identified for MASTER_LAWSUIT_ID ${params.masterLawsuitId}.`
    );
  }

  return {
    masterWrite,
    matterWrites: results,
    liveMatters,
    writtenCount: results.length,
    indexAaaNumber: params.indexAaaNumber,
    lawsuitMatterDisplayNumbers,
    wroteLawsuitMatterDisplayNumbersCount: results.filter(
      (result) => result.wroteLawsuitMatterDisplayNumbers
    ).length,
    missingLawsuitMatterDisplayNumbersFieldMatterIds: results
      .filter((result) => result.missingLawsuitMatterDisplayNumbersField)
      .map((result) => result.matterId),
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
      select: {
        id: true,
        masterLawsuitId: true,
        venue: true,
        venueSelection: true,
        venueOther: true,
        indexAaaNumber: true,
        lawsuitNotes: true,
        lawsuitOptions: true,
        updatedAt: true,
      },
    });

    if (!lawsuit) {
      return NextResponse.json(
        {
          ok: false,
          error: `No local Lawsuit row found for MASTER_LAWSUIT_ID ${masterLawsuitId}.`,
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      lawsuit,
      sourceOfTruth: "Barsh Matters local Lawsuit table",
      clioReadAttempted: false,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        error: err?.message || "Failed to read lawsuit metadata.",
      },
      { status: 500 }
    );
  }
}


export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const masterLawsuitId = text(body?.masterLawsuitId);
    const venueSelection = text(body?.venueSelection);
    const venueOther = text(body?.venueOther);
    const venue =
      venueSelection === "Other" ? venueOther : text(body?.venue || venueSelection);
    const indexAaaNumber = text(body?.indexAaaNumber);
    const dateOfLoss = text(body?.dateOfLoss);
    const dateFiled = text(body?.dateFiled);
    const filingFee = text(body?.filingFee);
    const serviceFee = text(body?.serviceFee);
    const otherCourtCosts = text(body?.otherCourtCosts);
    const lawsuitNotes = text(body?.lawsuitNotes);
    const amountSoughtMode = normalizeAmountSoughtMode(body?.amountSoughtMode);
    const customAmountSought =
      amountSoughtMode === "custom" ? amountNumber(body?.customAmountSought) : null;

    if (amountSoughtMode === "custom" && customAmountSought === null) {
      return NextResponse.json(
        { ok: false, error: "Custom Amount is required when Amount Sought is set to Custom Amount." },
        { status: 400 }
      );
    }

    if (!masterLawsuitId) {
      return NextResponse.json(
        { ok: false, error: "masterLawsuitId is required." },
        { status: 400 }
      );
    }

    const existing = await prisma.lawsuit.findUnique({
      where: { masterLawsuitId },
      select: {
        id: true,
        lawsuitMatters: true,
        lawsuitOptions: true,
      },
    });

    if (!existing) {
      return NextResponse.json(
        {
          ok: false,
          error: `No local Lawsuit row found for MASTER_LAWSUIT_ID ${masterLawsuitId}.`,
        },
        { status: 404 }
      );
    }

    const existingOptions =
      existing.lawsuitOptions && typeof existing.lawsuitOptions === "object"
        ? (existing.lawsuitOptions as Record<string, unknown>)
        : {};

    let clioPostFilingWrite: any = {
      ok: true,
      skipped: true,
      reason: "local-lawsuit-metadata-save-first-no-clio-required",
      liveMatters: [],
      masterWrite: null,
      matterWrites: [],
      writtenCount: 0,
      indexAaaNumber,
      lawsuitMatterDisplayNumbers: [],
      wroteLawsuitMatterDisplayNumbersCount: 0,
      missingLawsuitMatterDisplayNumbersFieldMatterIds: [],
      clioWriteAttempted: false,
    };

    try {
      clioPostFilingWrite = await writePostFilingFieldsToClioLawsuit({
        masterLawsuitId,
        lawsuitMatters: existing.lawsuitMatters,
        indexAaaNumber,
      });
    } catch (error: any) {
      clioPostFilingWrite = {
        ...clioPostFilingWrite,
        ok: false,
        skipped: true,
        reason: error?.message || "Post-filing Clio write skipped after local metadata save.",
        clioWriteAttempted: false,
      };
    }

    const amountSought = computeAmountSought({
      liveMatters: Array.isArray(clioPostFilingWrite.liveMatters) ? clioPostFilingWrite.liveMatters : [],
      amountSoughtMode,
      customAmountSought,
    });

    const lawsuitOptions = {
      ...existingOptions,
      venue,
      venueSelection,
      venueOther,
      selectedCourtDetails: body?.selectedCourtDetails || null,
      dateOfLoss: dateOfLoss || text(existingOptions.dateOfLoss),
      dateFiled: dateFiled || text(existingOptions.dateFiled),
      filingFee: filingFee || text(existingOptions.filingFee),
      serviceFee: serviceFee || text(existingOptions.serviceFee),
      otherCourtCosts: otherCourtCosts || text(existingOptions.otherCourtCosts),
      amountSoughtMode,
      customAmountSought,
      indexAaaNumber: clioPostFilingWrite.indexAaaNumber || indexAaaNumber,
      notes: lawsuitNotes,
      lawsuitMatterDisplayNumbers: clioPostFilingWrite.lawsuitMatterDisplayNumbers || [],
      updatedPostFiling: !!clioPostFilingWrite?.ok && !clioPostFilingWrite?.skipped,
      updatedPostFilingAt: new Date().toISOString(),
      indexAaaNumberWrittenToClio: !!clioPostFilingWrite?.ok && !clioPostFilingWrite?.skipped,
      indexAaaNumberClioMasterMatterId:
        clioPostFilingWrite.masterWrite?.matterId || null,
      indexAaaNumberClioMatterIds: Array.isArray(clioPostFilingWrite.matterWrites)
        ? clioPostFilingWrite.matterWrites.map((item: any) => item.matterId)
        : [],
      indexAaaNumberClioWriteCount: clioPostFilingWrite.writtenCount || 0,
      lawsuitMatterDisplayNumbersWrittenToClio: !!clioPostFilingWrite?.ok && !clioPostFilingWrite?.skipped,
      lawsuitMatterDisplayNumbersWriteCount:
        clioPostFilingWrite.wroteLawsuitMatterDisplayNumbersCount || 0,
      lawsuitMatterDisplayNumbersMissingFieldMatterIds:
        clioPostFilingWrite.missingLawsuitMatterDisplayNumbersFieldMatterIds || [],
      localLawsuitMetadataSaved: true,
      clioPostFilingWriteSkipped: !!clioPostFilingWrite?.skipped,
      clioPostFilingWriteSkipReason: clioPostFilingWrite?.reason || null,
    };

    const lawsuit = await prisma.lawsuit.update({
      where: { masterLawsuitId },
      data: {
        venue: venue || null,
        venueSelection: venueSelection || null,
        venueOther: venueOther || null,
        indexAaaNumber: (clioPostFilingWrite.indexAaaNumber || indexAaaNumber) || null,
        lawsuitNotes: lawsuitNotes || null,
        lawsuitOptions,
        amountSoughtMode: amountSought.mode,
        amountSought: amountSought.amountSought,
        customAmountSought: amountSought.customAmountSought,
        amountSoughtBreakdown: amountSought,
      },
    });

    return NextResponse.json({
      ok: true,
      lawsuit,
      amountSought,
      clioPostFilingWrite,
      localLawsuitMetadataSaved: true,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        error: err?.message || "Failed to update lawsuit metadata.",
      },
      { status: 500 }
    );
  }
}
