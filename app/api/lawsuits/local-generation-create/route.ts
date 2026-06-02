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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    const confirm = text(body?.confirm);
    const selectedMatterIds = normalizeMatterIds(body?.matterIds || body?.selectedMatterIds);
    const amountSoughtMode =
      text(body?.amountSoughtMode) === "claim_amount" ? "claim_amount" : "balance_presuit";

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

    const normalizedClaimNumber = Array.from(claimSet)[0];
    const claimNumber = text(selectedRows[0]?.claim_number_raw || normalizedClaimNumber);
    const lawsuitMatters = normalizeLawsuitMatterList(selectedMatterIds);
    const amountComponents = selectedRows.map((row) => ({
      matterId: Number(row.matter_id),
      displayNumber: rowDisplayNumber(row),
      amount: amountForMode(row, amountSoughtMode),
      sourceField: amountSoughtMode === "claim_amount" ? "claim_amount" : "balance_presuit",
    }));
    const amountSought = amountComponents.reduce((sum, item) => sum + item.amount, 0);

    const masterLawsuitId = await buildMasterId();

    const result = await prisma.$transaction(async (tx) => {
      const lawsuit = await tx.lawsuit.create({
        data: {
          masterLawsuitId,
          claimNumber,
          lawsuitMatters,
          sharedFolderPath: "",
          venue: null,
          venueSelection: null,
          venueOther: null,
          indexAaaNumber: null,
          lawsuitNotes: text(body?.notes) || null,
          lawsuitOptions: {
            source: "local-first-lawsuit-generation",
            selectedMatterIds,
            selectedDisplayNumbers: selectedRows.map(rowDisplayNumber).sort((a, b) => a.localeCompare(b)),
            amountSoughtMode,
            noClioWrites: true,
            noClioMasterMatter: true,
            reusesExistingLawsuit: false,
            indexAaaNumberPrefill: false,
          },
          amountSoughtMode,
          amountSought,
          customAmountSought: null,
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
          clioMasterMappingSource: null,
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
      indexAaaNumber: null,
      clioMasterMatterId: null,
      proposedNextStep: "Map or create a Clio document shell only through a separate explicit document-storage workflow.",
      writes: {
        createsLawsuit: true,
        updatesClaimIndex: true,
        writesClio: false,
        createsClioMasterMatter: false,
        consumesMasterSequence: true,
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
