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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    const masterLawsuitId = clean(body.masterLawsuitId);
    const grossSettlementAmount = cents(numberOrZero(body.grossSettlementAmount));
    const interestAmountTotal = cents(numberOrZero(body.interestAmount));
    const principalFeePercent = percent(body.principalFeePercent);
    const interestFeePercent = percent(body.interestFeePercent);
    const allocationMode = clean(body.allocationMode) || "pro_rata_by_principal_balance";

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

    const previewRows = basisRows.map(({ row, principalBasis }) => {
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

    const summary = {
      masterLawsuitId,
      allocationMode: "pro_rata_by_principal_balance",
      grossSettlementAmount,
      principalBasisTotal,
      allocatedSettlementTotal: cents(
        previewRows.reduce((sum, row) => sum + row.allocatedSettlement, 0)
      ),
      interestAmountTotal: cents(
        previewRows.reduce((sum, row) => sum + row.interestAmount, 0)
      ),
      principalFeePercent,
      interestFeePercent,
      principalFeeTotal: cents(
        previewRows.reduce((sum, row) => sum + row.principalFee, 0)
      ),
      interestFeeTotal: cents(
        previewRows.reduce((sum, row) => sum + row.interestFee, 0)
      ),
      totalFee: cents(previewRows.reduce((sum, row) => sum + row.totalFee, 0)),
      providerPrincipalNetTotal: cents(
        previewRows.reduce((sum, row) => sum + row.providerPrincipalNet, 0)
      ),
      providerInterestNetTotal: cents(
        previewRows.reduce((sum, row) => sum + row.providerInterestNet, 0)
      ),
      providerNetTotal: cents(
        previewRows.reduce((sum, row) => sum + row.providerNet, 0)
      ),
      rowCount: previewRows.length,
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
