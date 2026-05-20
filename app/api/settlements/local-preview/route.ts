import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SettlementRowInput = {
  matter_id: number;
  display_number: string | null;
  provider_name: string | null;
  client_name: string | null;
  patient_name: string | null;
  insurer_name: string | null;
  claim_number_raw: string | null;
  bill_number: string | null;
  dos_start: string | null;
  dos_end: string | null;
  denial_reason: string | null;
  claim_amount: number | null;
  balance_amount: number | null;
  balance_presuit: number | null;
};

type SettlementPreviewRow = {
  matterId: number;
  displayNumber: string | null;
  provider: string | null;
  patient: string | null;
  insurer: string | null;
  claimNumber: string | null;
  billNumber: string | null;
  dosStart: string | null;
  dosEnd: string | null;
  denialReason: string | null;
  claimAmount: number;
  principalBasis: number;
  allocatedSettlement: number;
  interestAmount: number;
  principalFee: number;
  interestFee: number;
  totalFee: number;
  providerPrincipalNet: number;
  providerInterestNet: number;
  providerNet: number;
};

type MonetaryField =
  | "allocatedSettlement"
  | "interestAmount"
  | "principalFee"
  | "interestFee"
  | "totalFee"
  | "providerPrincipalNet"
  | "providerInterestNet"
  | "providerNet";

type RoundingAdjustment = {
  field: MonetaryField;
  matterId: number;
  displayNumber: string | null;
  cents: number;
  amount: number;
  reason: string;
};

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function numberOrZero(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const raw = clean(value).replace(/[$,%\s,]/g, "");
  if (!raw) return 0;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

function cents(value: number): number {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}

function centsInteger(value: number): number {
  return Math.round(cents(value) * 100);
}

function fromCentsInteger(value: number): number {
  return cents(value / 100);
}

function percent(value: unknown): number {
  const parsed = numberOrZero(value);
  if (parsed < 0) return 0;
  if (parsed > 100) return 100;
  return parsed;
}

function principalBasis(row: SettlementRowInput): number {
  return cents(
    numberOrZero(row.balance_presuit) ||
      numberOrZero(row.balance_amount) ||
      numberOrZero(row.claim_amount)
  );
}

function proratedAmount(total: number, basis: number, basisTotal: number): number {
  if (total <= 0 || basis <= 0 || basisTotal <= 0) return 0;
  return cents(total * (basis / basisTotal));
}

function sumFieldCents(rows: SettlementPreviewRow[], field: MonetaryField): number {
  return rows.reduce((sum, row) => sum + centsInteger(row[field]), 0);
}

function deterministicAdjustmentRowIndex(rows: SettlementPreviewRow[]): number {
  if (!rows.length) return -1;

  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      const basisDiff = centsInteger(b.row.principalBasis) - centsInteger(a.row.principalBasis);
      if (basisDiff !== 0) return basisDiff;
      return a.row.matterId - b.row.matterId;
    })[0].index;
}

function adjustFieldToTarget(
  rows: SettlementPreviewRow[],
  field: MonetaryField,
  expectedTotal: number,
  roundingAdjustments: RoundingAdjustment[],
  reason: string
): void {
  if (!rows.length) return;

  const expectedCents = centsInteger(expectedTotal);
  const currentCents = sumFieldCents(rows, field);
  const deltaCents = expectedCents - currentCents;

  if (deltaCents === 0) return;

  const targetIndex = deterministicAdjustmentRowIndex(rows);
  if (targetIndex < 0) return;

  const row = rows[targetIndex];
  row[field] = fromCentsInteger(centsInteger(row[field]) + deltaCents);

  roundingAdjustments.push({
    field,
    matterId: row.matterId,
    displayNumber: row.displayNumber,
    cents: deltaCents,
    amount: fromCentsInteger(deltaCents),
    reason,
  });
}

function recomputeFeesAndNets(
  rows: SettlementPreviewRow[],
  principalFeePercent: number,
  interestFeePercent: number
): void {
  rows.forEach((row) => {
    row.principalFee = cents(row.allocatedSettlement * (principalFeePercent / 100));
    row.interestFee = cents(row.interestAmount * (interestFeePercent / 100));
    row.totalFee = cents(row.principalFee + row.interestFee);
    row.providerPrincipalNet = cents(row.allocatedSettlement - row.principalFee);
    row.providerInterestNet = cents(row.interestAmount - row.interestFee);
    row.providerNet = cents(row.providerPrincipalNet + row.providerInterestNet);
  });
}

function recomputeNetsFromBalancedFees(rows: SettlementPreviewRow[]): void {
  rows.forEach((row) => {
    row.totalFee = cents(row.principalFee + row.interestFee);
    row.providerPrincipalNet = cents(row.allocatedSettlement - row.principalFee);
    row.providerInterestNet = cents(row.interestAmount - row.interestFee);
    row.providerNet = cents(row.providerPrincipalNet + row.providerInterestNet);
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    const masterLawsuitId = clean(body.masterLawsuitId);
    const grossSettlementAmount = cents(numberOrZero(body.grossSettlementAmount));
    const interestAmountTotal = cents(numberOrZero(body.interestAmount));
    const principalFeePercent = percent(body.principalFeePercent);
    const interestFeePercent = percent(body.interestFeePercent);
    const allocationMode = clean(body.allocationMode) || "pro_rata_by_principal_balance";
    const settledWith = clean(body.settledWith);
    const settlementDate = clean(body.settlementDate);
    const paymentExpectedDate = clean(body.paymentExpectedDate);
    const notes = clean(body.notes);

    if (!masterLawsuitId) {
      return NextResponse.json(
        {
          ok: false,
          action: "settlement-local-preview",
          previewOnly: true,
          error: "Missing masterLawsuitId.",
          safety: {
            localBarshMattersCalculation: true,
            clioRecordsChanged: false,
            databaseRecordsChanged: false,
            documentsGenerated: false,
            printQueueChanged: false,
            mattersClosed: false,
          },
        },
        { status: 400 }
      );
    }

    const rows = (await prisma.claimIndex.findMany({
      where: {
        master_lawsuit_id: masterLawsuitId,
      },
      orderBy: {
        matter_id: "asc",
      },
      select: {
        matter_id: true,
        display_number: true,
        provider_name: true,
        client_name: true,
        patient_name: true,
        insurer_name: true,
        claim_number_raw: true,
        bill_number: true,
        dos_start: true,
        dos_end: true,
        denial_reason: true,
        claim_amount: true,
        balance_amount: true,
        balance_presuit: true,
      },
    })) as SettlementRowInput[];

    const childRows = rows.filter((row) => {
      const display = clean(row.display_number).toUpperCase();
      return display && !display.includes("MASTER");
    });

    const basisRows = childRows.map((row) => ({
      row,
      principalBasis: principalBasis(row),
    }));

    const principalBasisTotal = cents(
      basisRows.reduce((sum, row) => sum + row.principalBasis, 0)
    );

    const blockingErrors: string[] = [];
    const warnings: string[] = [];

    if (!childRows.length) blockingErrors.push("No child bill matters were found for this Master Lawsuit.");
    if (grossSettlementAmount <= 0) blockingErrors.push("Gross settlement amount must be greater than zero.");
    if (principalBasisTotal <= 0) blockingErrors.push("No positive principal balance basis was found for allocation.");
    if (allocationMode !== "pro_rata_by_principal_balance") {
      warnings.push(`Unsupported allocation mode "${allocationMode}" was requested; preview used pro_rata_by_principal_balance.`);
    }

    const previewRows: SettlementPreviewRow[] = basisRows.map(({ row, principalBasis }) => {
      const rawPrincipalAllocation = proratedAmount(
        grossSettlementAmount,
        principalBasis,
        principalBasisTotal
      );
      const allocatedSettlement = cents(Math.min(rawPrincipalAllocation, principalBasis));
      const interestAmount = proratedAmount(
        interestAmountTotal,
        principalBasis,
        principalBasisTotal
      );
      const principalFee = cents(allocatedSettlement * (principalFeePercent / 100));
      const interestFee = cents(interestAmount * (interestFeePercent / 100));
      const totalFee = cents(principalFee + interestFee);
      const providerPrincipalNet = cents(allocatedSettlement - principalFee);
      const providerInterestNet = cents(interestAmount - interestFee);
      const providerNet = cents(providerPrincipalNet + providerInterestNet);

      return {
        matterId: row.matter_id,
        displayNumber: row.display_number,
        provider: row.provider_name || row.client_name,
        patient: row.patient_name,
        insurer: row.insurer_name,
        claimNumber: row.claim_number_raw,
        billNumber: row.bill_number,
        dosStart: row.dos_start,
        dosEnd: row.dos_end,
        denialReason: row.denial_reason,
        claimAmount: cents(numberOrZero(row.claim_amount)),
        principalBasis,
        allocatedSettlement,
        interestAmount,
        principalFee,
        interestFee,
        totalFee,
        providerPrincipalNet,
        providerInterestNet,
        providerNet,
      };
    });

    const expectedAllocatedSettlementTotal = cents(Math.min(grossSettlementAmount, principalBasisTotal));
    const expectedInterestAmountTotal = interestAmountTotal;
    const expectedPrincipalFeeTotal = cents(expectedAllocatedSettlementTotal * (principalFeePercent / 100));
    const expectedInterestFeeTotal = cents(expectedInterestAmountTotal * (interestFeePercent / 100));
    const expectedTotalFee = cents(expectedPrincipalFeeTotal + expectedInterestFeeTotal);
    const expectedProviderPrincipalNetTotal = cents(expectedAllocatedSettlementTotal - expectedPrincipalFeeTotal);
    const expectedProviderInterestNetTotal = cents(expectedInterestAmountTotal - expectedInterestFeeTotal);
    const expectedProviderNetTotal = cents(expectedProviderPrincipalNetTotal + expectedProviderInterestNetTotal);

    const roundingAdjustments: RoundingAdjustment[] = [];

    adjustFieldToTarget(
      previewRows,
      "allocatedSettlement",
      expectedAllocatedSettlementTotal,
      roundingAdjustments,
      "Reconciled prorated principal allocation rows to the aggregate expected allocated settlement total."
    );

    adjustFieldToTarget(
      previewRows,
      "interestAmount",
      expectedInterestAmountTotal,
      roundingAdjustments,
      "Reconciled prorated interest rows to the aggregate expected interest total."
    );

    recomputeFeesAndNets(previewRows, principalFeePercent, interestFeePercent);

    adjustFieldToTarget(
      previewRows,
      "principalFee",
      expectedPrincipalFeeTotal,
      roundingAdjustments,
      "Reconciled row-level principal fees to the aggregate expected principal fee total."
    );

    adjustFieldToTarget(
      previewRows,
      "interestFee",
      expectedInterestFeeTotal,
      roundingAdjustments,
      "Reconciled row-level interest fees to the aggregate expected interest fee total."
    );

    recomputeNetsFromBalancedFees(previewRows);

    const summary = {
      masterLawsuitId,
      allocationMode: "pro_rata_by_principal_balance",
      grossSettlementAmount,
      principalBasisTotal,
      expectedAllocatedSettlementTotal,
      allocatedSettlementTotal: fromCentsInteger(sumFieldCents(previewRows, "allocatedSettlement")),
      interestAmountTotal: fromCentsInteger(sumFieldCents(previewRows, "interestAmount")),
      principalFeePercent,
      interestFeePercent,
      principalFeeTotal: fromCentsInteger(sumFieldCents(previewRows, "principalFee")),
      interestFeeTotal: fromCentsInteger(sumFieldCents(previewRows, "interestFee")),
      totalFee: fromCentsInteger(sumFieldCents(previewRows, "totalFee")),
      providerPrincipalNetTotal: fromCentsInteger(sumFieldCents(previewRows, "providerPrincipalNet")),
      providerInterestNetTotal: fromCentsInteger(sumFieldCents(previewRows, "providerInterestNet")),
      providerNetTotal: fromCentsInteger(sumFieldCents(previewRows, "providerNet")),
      expectedInterestAmountTotal,
      expectedPrincipalFeeTotal,
      expectedInterestFeeTotal,
      expectedTotalFee,
      expectedProviderPrincipalNetTotal,
      expectedProviderInterestNetTotal,
      expectedProviderNetTotal,
      roundingAdjustmentCount: roundingAdjustments.length,
      rowCount: previewRows.length,
    };

    const settlementRecordPayload = {
      payloadKind: "local-settlement-record-preview",
      previewOnly: true,
      recordIntent: "future-barsh-matters-local-settlement-record",
      databaseRecordsChanged: false,
      sourceOfTruth: "barsh-matters-local-claimindex",
      masterLawsuitId,
      settlementTerms: {
        settledWith,
        settlementDate,
        paymentExpectedDate,
        notes,
        allocationMode: "pro_rata_by_principal_balance",
        grossSettlementAmount,
        interestAmount: summary.interestAmountTotal,
        principalFeePercent,
        interestFeePercent,
      },
      settlementTotals: {
        allocatedSettlementTotal: summary.allocatedSettlementTotal,
        interestAmountTotal: summary.interestAmountTotal,
        principalFeeTotal: summary.principalFeeTotal,
        interestFeeTotal: summary.interestFeeTotal,
        totalFee: summary.totalFee,
        providerPrincipalNetTotal: summary.providerPrincipalNetTotal,
        providerInterestNetTotal: summary.providerInterestNetTotal,
        providerNetTotal: summary.providerNetTotal,
      },
      settlementRows: previewRows.map((row) => ({
        matterId: row.matterId,
        displayNumber: row.displayNumber,
        provider: row.provider,
        patient: row.patient,
        insurer: row.insurer,
        claimNumber: row.claimNumber,
        billNumber: row.billNumber,
        dosStart: row.dosStart,
        dosEnd: row.dosEnd,
        denialReason: row.denialReason,
        claimAmount: row.claimAmount,
        principalBasis: row.principalBasis,
        allocatedSettlement: row.allocatedSettlement,
        interestAmount: row.interestAmount,
        principalFee: row.principalFee,
        interestFee: row.interestFee,
        totalFee: row.totalFee,
        providerPrincipalNet: row.providerPrincipalNet,
        providerInterestNet: row.providerInterestNet,
        providerNet: row.providerNet,
        settlementStatus: "preview_only_not_recorded",
      })),
      roundingAdjustments,
      safety: {
        previewOnly: true,
        clioRecordsChanged: false,
        databaseRecordsChanged: false,
        documentsGenerated: false,
        printQueueChanged: false,
        mattersClosed: false,
        settlementWritebackPerformed: false,
      },
    };

    return NextResponse.json(
      {
        ok: blockingErrors.length === 0,
        action: "settlement-local-preview",
        previewOnly: true,
        localFirst: true,
        sourceOfTruth: "barsh-matters-local-claimindex",
        summary,
        rows: previewRows,
        roundingAdjustments,
        settlementRecordPayload,
        validation: {
          readyForLocalSettlementPreview: blockingErrors.length === 0,
          blockingErrors,
          warnings,
        },
        safety: {
          localBarshMattersCalculation: true,
          clioRecordsChanged: false,
          databaseRecordsChanged: false,
          documentsGenerated: false,
          printQueueChanged: false,
          mattersClosed: false,
          settlementWritebackPerformed: false,
        },
        note:
          "Local-first settlement calculation preview only.  This endpoint reads Barsh Matters ClaimIndex data and does not write Clio, write the database, generate documents, print, queue, or close matters.",
      },
      { status: blockingErrors.length === 0 ? 200 : 400 }
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        action: "settlement-local-preview",
        previewOnly: true,
        localFirst: true,
        error: error?.message || "Local settlement preview failed.",
        safety: {
          localBarshMattersCalculation: true,
          clioRecordsChanged: false,
          databaseRecordsChanged: false,
          documentsGenerated: false,
          printQueueChanged: false,
          mattersClosed: false,
          settlementWritebackPerformed: false,
        },
      },
      { status: 500 }
    );
  }
}
