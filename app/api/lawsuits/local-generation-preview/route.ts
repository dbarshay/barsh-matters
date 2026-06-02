import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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

function formatDos(row: any): string {
  const start = text(row?.dos_start);
  const end = text(row?.dos_end);
  if (start && end && start !== end) return `${start} to ${end}`;
  return start || end;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    const selectedMatterIds = normalizeMatterIds(body?.matterIds || body?.selectedMatterIds);
    const amountSoughtMode =
      text(body?.amountSoughtMode) === "claim_amount" ? "claim_amount" : "balance_presuit";

    if (selectedMatterIds.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          canCreate: false,
          error: "Select at least one matter for lawsuit generation preview.",
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
          canCreate: false,
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
          canCreate: false,
          error: "Selected matters must share exactly one local ClaimIndex claim number.",
          claims: Array.from(claimSet),
          selectedMatterIds,
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
    const claimRows = await prisma.claimIndex.findMany({
      where: {
        claim_number_normalized: normalizedClaimNumber,
      },
      orderBy: [{ master_lawsuit_id: "asc" }, { display_number: "asc" }],
    });

    const selectedExistingMasterRows = selectedRows.filter((row) => text(row.master_lawsuit_id));
    const blockedMatterIds = selectedExistingMasterRows.map((row) => Number(row.matter_id));

    const existingMasterGroups = Array.from(
      claimRows.reduce((map, row) => {
        const master = text(row.master_lawsuit_id);
        if (!master) return map;

        const current = map.get(master) || {
          masterLawsuitId: master,
          count: 0,
          matterIds: [] as number[],
          displayNumbers: [] as string[],
        };

        current.count += 1;
        current.matterIds.push(Number(row.matter_id));
        current.displayNumbers.push(rowDisplayNumber(row));
        map.set(master, current);
        return map;
      }, new Map<string, { masterLawsuitId: string; count: number; matterIds: number[]; displayNumbers: string[] }>())
    ).map(([, group]) => ({
      ...group,
      matterIds: group.matterIds.sort((a, b) => a - b),
      displayNumbers: group.displayNumbers.sort((a, b) => a.localeCompare(b)),
    }));

    const amountComponents = selectedRows.map((row) => ({
      matterId: Number(row.matter_id),
      displayNumber: rowDisplayNumber(row),
      amount: amountForMode(row, amountSoughtMode),
      sourceField: amountSoughtMode === "claim_amount" ? "claim_amount" : "balance_presuit",
    }));

    const amountSought = amountComponents.reduce((sum, item) => sum + item.amount, 0);

    const selectedPreviewRows = selectedRows.map((row) => ({
      matterId: Number(row.matter_id),
      displayNumber: rowDisplayNumber(row),
      claimNumber: text(row.claim_number_raw || row.claim_number_normalized),
      patient: text(row.patient_name),
      provider: text(row.client_name || row.provider_name),
      treatingProvider: text(row.treating_provider),
      insurer: text(row.insurer_name),
      dos: formatDos(row),
      dosStart: text(row.dos_start),
      dosEnd: text(row.dos_end),
      denialReason: text(row.denial_reason),
      status: text(row.matter_stage_name || row.status),
      claimAmount: moneyNumber(row.claim_amount),
      balancePresuit: moneyNumber(row.balance_presuit),
      masterLawsuitId: text(row.master_lawsuit_id),
      selectedIsBlocked: Boolean(text(row.master_lawsuit_id)),
    }));

    const canCreate = blockedMatterIds.length === 0;

    return NextResponse.json({
      ok: true,
      canCreate,
      mode: "local-first-lawsuit-generation-preview",
      sourceOfTruth: "ClaimIndex/local Barsh Matters",
      claimNumber: text(selectedRows[0]?.claim_number_raw || normalizedClaimNumber),
      normalizedClaimNumber,
      selectedMatterCount: selectedRows.length,
      selectedMatterIds,
      selectedDisplayNumbers: selectedRows.map(rowDisplayNumber).sort((a, b) => a.localeCompare(b)),
      blockedMatterIds,
      blockedDisplayNumbers: selectedExistingMasterRows.map(rowDisplayNumber).sort((a, b) => a.localeCompare(b)),
      blockingReason:
        blockedMatterIds.length > 0
          ? "One or more selected matters already have a local Master Lawsuit ID. Existing lawsuits are not reused unless a separate explicit add-to-existing workflow is used."
          : null,
      existingClaimRowCount: claimRows.length,
      existingMasterGroups,
      amountSoughtMode,
      amountSought,
      amountComponents,
      selectedRows: selectedPreviewRows,
      proposedCreateBehavior: {
        createsNewLocalLawsuit: canCreate,
        reusesExistingLawsuit: false,
        writesClio: false,
        createsClioMasterMatter: false,
        updatesSelectedClaimIndexRowsOnlyAfterExplicitConfirm: true,
        indexAaaNumberPrefill: false,
        masterLawsuitIdAssignedOnlyOnConfirm: true,
      },
      writes: {
        createsLawsuit: false,
        updatesClaimIndex: false,
        writesClio: false,
        createsClioMasterMatter: false,
        consumesMasterSequence: false,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        canCreate: false,
        error: error?.message || "Local lawsuit generation preview failed.",
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
