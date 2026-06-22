import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildMasterId } from "@/lib/buildMasterId";

function normalizeMatterIds(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];

  return Array.from(
    new Set(
      raw
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value) && value > 0)
    )
  );
}

function text(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function moneyNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value === null || value === undefined) return 0;

  const cleaned = String(value).replace(/[$,\s]/g, "");
  if (!cleaned) return 0;

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function positiveNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function rowDisplayNumber(row: any): string {
  return text(row?.display_number) || String(row?.matter_id || "");
}

function amountForMode(row: any, mode: string): number {
  if (mode === "claim_amount") return moneyNumber(row?.claim_amount);
  return moneyNumber(row?.balance_presuit);
}

function normalizeLawsuitMatterList(ids: number[]): string {
  return Array.from(new Set(ids))
    .sort((a, b) => a - b)
    .join(",");
}

function buildClioMatterDescription(masterLawsuitId: string) {
  return `MASTER LAWSUIT - ${masterLawsuitId}`;
}

function normalizeClioDisplayNumber(value: unknown): string {
  const raw = text(value).toUpperCase();
  if (!raw) return "";
  if (/^BRL\d+$/.test(raw)) return raw;
  if (/^\d+$/.test(raw)) return `BRL${raw}`;
  return raw;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    const confirm = text(body?.confirm);
    const selectedMatterIds = normalizeMatterIds(body?.matterIds || body?.selectedMatterIds);
    const rawAmountSoughtMode = text(body?.amountSoughtMode);
    const amountSoughtMode =
      rawAmountSoughtMode === "claim_amount" || rawAmountSoughtMode === "custom"
        ? rawAmountSoughtMode
        : "balance_presuit";
    const customAmountSought = moneyNumber(body?.customAmountSought);
    const venue = text(body?.venue || body?.court || body?.courtVenue);
    const venueSelection = text(body?.venueSelection || venue);
    const venueOther = text(body?.venueOther);

    if (confirm !== "create-local-lawsuit") {
      return NextResponse.json(
        {
          ok: false,
          created: false,
          error: "Explicit confirm=create-local-lawsuit is required. No lawsuit was created.",
          writes: {
            createsLawsuit: false,
            updatesClaimIndex: false,
            writesClio: false,
            createsClioMasterMatter: false,
            consumesMasterSequence: false,
          },
        },
        { status: 400 }
      );
    }

    if (selectedMatterIds.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          created: false,
          error: "Select at least one matter for local lawsuit generation.",
          writes: {
            createsLawsuit: false,
            updatesClaimIndex: false,
            writesClio: false,
            createsClioMasterMatter: false,
            consumesMasterSequence: false,
          },
        },
        { status: 400 }
      );
    }

    if (!venue) {
      return NextResponse.json(
        {
          ok: false,
          created: false,
          error: "Court / Venue is required before creating a local lawsuit.",
          writes: {
            createsLawsuit: false,
            updatesClaimIndex: false,
            writesClio: false,
            createsClioMasterMatter: false,
            consumesMasterSequence: false,
          },
        },
        { status: 400 }
      );
    }

    if (amountSoughtMode === "custom" && customAmountSought <= 0) {
      return NextResponse.json(
        {
          ok: false,
          created: false,
          error: "A valid Lawsuit Amount is required when Other is selected.",
          writes: {
            createsLawsuit: false,
            updatesClaimIndex: false,
            writesClio: false,
            createsClioMasterMatter: false,
            consumesMasterSequence: false,
          },
        },
        { status: 400 }
      );
    }

    const selectedRows = await prisma.claimIndex.findMany({
      where: {
        matter_id: {
          in: selectedMatterIds,
        },
      },
      orderBy: [{ display_number: "asc" }],
    });

    const foundIds = new Set(selectedRows.map((row) => Number(row.matter_id)));
    const missingMatterIds = selectedMatterIds.filter((id) => !foundIds.has(id));

    if (missingMatterIds.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          created: false,
          error: "One or more selected matters were not found in ClaimIndex.",
          missingMatterIds,
          writes: {
            createsLawsuit: false,
            updatesClaimIndex: false,
            writesClio: false,
            createsClioMasterMatter: false,
            consumesMasterSequence: false,
          },
        },
        { status: 400 }
      );
    }

    const claimSet = new Set(
      selectedRows
        .map((row) => text(row.claim_number_normalized || row.claim_number_raw))
        .filter(Boolean)
    );

    if (claimSet.size !== 1) {
      return NextResponse.json(
        {
          ok: false,
          created: false,
          error: "Selected matters must share exactly one local ClaimIndex claim number.",
          claims: Array.from(claimSet),
          writes: {
            createsLawsuit: false,
            updatesClaimIndex: false,
            writesClio: false,
            createsClioMasterMatter: false,
            consumesMasterSequence: false,
          },
        },
        { status: 400 }
      );
    }

    const blockedRows = selectedRows.filter((row) => text(row.master_lawsuit_id));
    if (blockedRows.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          created: false,
          error: "One or more selected matters already have a local Master Lawsuit ID. Existing lawsuits are not reused by this route.",
          blockedMatterIds: blockedRows.map((row) => Number(row.matter_id)),
          blockedDisplayNumbers: blockedRows.map(rowDisplayNumber).sort((a, b) => a.localeCompare(b)),
          writes: {
            createsLawsuit: false,
            updatesClaimIndex: false,
            writesClio: false,
            createsClioMasterMatter: false,
            consumesMasterSequence: false,
          },
        },
        { status: 400 }
      );
    }

    const childClient = {
      ok: false,
      skipped: true,
      reason: "Create Lawsuit is local-only; Clio child matter client lookup is not used.",
      clientId: null,
      clientName: "",
      sourceMatterId: null,
      sourceDisplayNumber: "",
      attempts: [],
    };

    const normalizedClaimNumber =
      String(selectedRows[0]?.claim_number_normalized || selectedRows[0]?.claim_number_raw || "")
        .replace(/\D+/g, "") ||
      String(selectedRows[0]?.claim_number_raw || "").trim();

    const claimNumber = text(selectedRows[0]?.claim_number_raw || normalizedClaimNumber);
    const lawsuitMatters = normalizeLawsuitMatterList(selectedMatterIds);
    const amountComponents = selectedRows.map((row) => ({
      matterId: Number(row.matter_id),
      displayNumber: rowDisplayNumber(row),
      amount: amountSoughtMode === "custom" ? 0 : amountForMode(row, amountSoughtMode),
      sourceField:
        amountSoughtMode === "custom"
          ? "custom"
          : amountSoughtMode === "claim_amount"
          ? "claim_amount"
          : "balance_presuit",
    }));
    const amountSought =
      amountSoughtMode === "custom"
        ? customAmountSought
        : amountComponents.reduce((sum, item) => sum + item.amount, 0);

    const masterLawsuitId = await buildMasterId();
    const clioMatterDescription = buildClioMatterDescription(masterLawsuitId);


    const result = await prisma.$transaction(async (tx) => {
      const lawsuit = await tx.lawsuit.create({
        data: {
          masterLawsuitId,
          claimNumber,
          lawsuitMatters,
          sharedFolderPath: "",
          venue,
          venueSelection: venueSelection || venue,
          venueOther: venueOther || null,
          indexAaaNumber: null,
          lawsuitNotes: text(body?.notes) || "Created from Lawsuits page local-first generation workflow.",
          lawsuitOptions: {
            source: "local-first-lawsuit-generation",
            selectedMatterIds,
            selectedDisplayNumbers: selectedRows.map(rowDisplayNumber).sort((a, b) => a.localeCompare(b)),
            amountSoughtMode,
            customAmountSought: amountSoughtMode === "custom" ? customAmountSought : null,
            venue,
            venueSelection: venueSelection || venue,
            venueOther: venueOther || null,
            createsClioDocumentShell: true,
            clioMasterMatterId: null,
            clioMasterDisplayNumber: null,
            clioMasterMatterDescription: null,
            clioClientId: childClient.clientId,
            clioClientName: childClient.clientName,
            noClioOperationalHydration: true,
            noClioMasterMatterManualStepRequired: true,
            reusesExistingLawsuit: false,
            indexAaaNumberPrefill: false,
          },
          amountSoughtMode,
          amountSought,
          customAmountSought: amountSoughtMode === "custom" ? customAmountSought : null,
          amountSoughtBreakdown: {
            mode: amountSoughtMode,
            sourceField: amountSoughtMode === "claim_amount" ? "claim_amount" : "balance_presuit",
            amountSought,
            selectedMatterCount: selectedRows.length,
            components: amountComponents,
          },
          clioMasterMatterId: null,
          clioMasterDisplayNumber: null,
          clioMasterMatterDescription: null,
          clioMasterMappedAt: null,
          clioMasterMappingSource: "none-local-only-create-lawsuit",
        },
      });

      const updated = await tx.claimIndex.updateMany({
        where: {
          matter_id: {
            in: selectedMatterIds,
          },
          master_lawsuit_id: null,
        },
        data: {
          master_lawsuit_id: masterLawsuitId,
        },
      });

      if (updated.count !== selectedMatterIds.length) {
        throw new Error(
          `Expected to update ${selectedMatterIds.length} selected ClaimIndex rows, but updated ${updated.count}.`
        );
      }

      return { lawsuit, updatedCount: updated.count };
    });

    return NextResponse.json({
      ok: true,
      created: true,
      mode: "local-first-lawsuit-generation-create",
      sourceOfTruth: "ClaimIndex/local Barsh Matters",
      masterLawsuitId,
      lawsuitId: result.lawsuit.id,
      claimNumber,
      selectedMatterIds,
      selectedDisplayNumbers: selectedRows.map(rowDisplayNumber).sort((a, b) => a.localeCompare(b)),
      selectedMatterCount: selectedRows.length,
      lawsuitMatters,
      amountSoughtMode,
      amountSought,
      amountComponents,
      updatedClaimIndexCount: result.updatedCount,
      venue,
      venueSelection: venueSelection || venue,
      venueOther: venueOther || null,
      indexAaaNumber: null,
      childClient,
      clioMasterMatter: null,
      createdClioMatter: null,
      localLawsuitDescription: clioMatterDescription,
      clioMasterMatterId: null,
      clioMasterDisplayNumber: null,
      clioMasterMatterDescription: null,
      clioMasterMappedAt: null,
      clioMasterMappingSource: "none-local-only-create-lawsuit",
      proposedNextStep: "Use the local lawsuit record for aggregation and the Barsh Matters Master Repository for document storage/finalization.",
      writes: {
        createsLawsuit: true,
        updatesClaimIndex: true,
        writesClio: false,
        createsClioMasterMatter: false,
        consumesMasterSequence: true,
        uploadsDocuments: false,
        downloadsDocuments: false,
        sendsEmail: false,
        printsDocuments: false,
        queuesPrintJobs: false,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        created: false,
        error: error?.message || "Local lawsuit generation failed.",
        writes: {
          createsLawsuit: false,
          updatesClaimIndex: false,
          writesClio: false,
          createsClioMasterMatter: false,
          consumesMasterSequence: false,
        },
      },
      { status: 500 }
    );
  }
}
