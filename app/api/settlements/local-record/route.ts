import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

function cents(value: unknown): number {
  return Math.round(numberOrZero(value) * 100) / 100;
}

function moneyEqual(a: unknown, b: unknown): boolean {
  return Math.round(cents(a) * 100) === Math.round(cents(b) * 100);
}

function sumRows(rows: any[], field: string): number {
  return Math.round(rows.reduce((sum, row) => sum + cents(row?.[field]), 0) * 100) / 100;
}

function buildValidation(settlementRecordPayload: any) {
  const blockingErrors: string[] = [];
  const warnings: string[] = [];

  if (!settlementRecordPayload || typeof settlementRecordPayload !== "object") {
    blockingErrors.push("Missing settlementRecordPayload.");
  }

  const masterLawsuitId = clean(settlementRecordPayload?.masterLawsuitId);
  const payloadKind = clean(settlementRecordPayload?.payloadKind);
  const recordIntent = clean(settlementRecordPayload?.recordIntent);
  const settlementTerms = settlementRecordPayload?.settlementTerms || {};
  const settlementTotals = settlementRecordPayload?.settlementTotals || {};
  const settlementRows = Array.isArray(settlementRecordPayload?.settlementRows)
    ? settlementRecordPayload.settlementRows
    : [];

  if (!masterLawsuitId) blockingErrors.push("Missing masterLawsuitId.");
  if (payloadKind !== "local-settlement-record-preview") {
    blockingErrors.push("Invalid payloadKind for local settlement record save.");
  }
  if (recordIntent !== "future-barsh-matters-local-settlement-record") {
    blockingErrors.push("Invalid recordIntent for local settlement record save.");
  }
  if (settlementRecordPayload?.previewOnly !== true) {
    blockingErrors.push("Payload must originate from previewOnly settlement calculation.");
  }
  if (settlementRows.length <= 0) {
    blockingErrors.push("Settlement payload has no rows.");
  }

  const rowAllocatedSettlementTotal = sumRows(settlementRows, "allocatedSettlement");
  const rowInterestAmountTotal = sumRows(settlementRows, "interestAmount");
  const rowPrincipalFeeTotal = sumRows(settlementRows, "principalFee");
  const rowInterestFeeTotal = sumRows(settlementRows, "interestFee");
  const rowTotalFee = sumRows(settlementRows, "totalFee");
  const rowProviderPrincipalNetTotal = sumRows(settlementRows, "providerPrincipalNet");
  const rowProviderInterestNetTotal = sumRows(settlementRows, "providerInterestNet");
  const rowProviderNetTotal = sumRows(settlementRows, "providerNet");

  if (!moneyEqual(rowAllocatedSettlementTotal, settlementTotals?.allocatedSettlementTotal)) {
    blockingErrors.push("Allocated settlement row total does not match payload total.");
  }
  if (!moneyEqual(rowInterestAmountTotal, settlementTotals?.interestAmountTotal)) {
    blockingErrors.push("Interest row total does not match payload total.");
  }
  if (!moneyEqual(rowPrincipalFeeTotal, settlementTotals?.principalFeeTotal)) {
    blockingErrors.push("Principal fee row total does not match payload total.");
  }
  if (!moneyEqual(rowInterestFeeTotal, settlementTotals?.interestFeeTotal)) {
    blockingErrors.push("Interest fee row total does not match payload total.");
  }
  if (!moneyEqual(rowTotalFee, settlementTotals?.totalFee)) {
    blockingErrors.push("Total fee row total does not match payload total.");
  }
  if (!moneyEqual(rowProviderPrincipalNetTotal, settlementTotals?.providerPrincipalNetTotal)) {
    blockingErrors.push("Provider principal net row total does not match payload total.");
  }
  if (!moneyEqual(rowProviderInterestNetTotal, settlementTotals?.providerInterestNetTotal)) {
    blockingErrors.push("Provider interest net row total does not match payload total.");
  }
  if (!moneyEqual(rowProviderNetTotal, settlementTotals?.providerNetTotal)) {
    blockingErrors.push("Provider net row total does not match payload total.");
  }

  const duplicateMatterIds = settlementRows
    .map((row: any) => Number(row?.matterId || 0))
    .filter((matterId: number, index: number, all: number[]) => matterId > 0 && all.indexOf(matterId) !== index);

  if (duplicateMatterIds.length) {
    warnings.push(`Duplicate matter IDs detected in settlement payload: ${Array.from(new Set(duplicateMatterIds)).join(", ")}.`);
  }

  return {
    masterLawsuitId,
    settlementTerms,
    settlementTotals,
    settlementRows,
    blockingErrors,
    warnings,
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const settlementRecordPayload = body?.settlementRecordPayload || body?.payload || null;
    const actorName = clean(body?.actorName);
    const actorEmail = clean(body?.actorEmail);

    const validation = buildValidation(settlementRecordPayload);

    if (validation.blockingErrors.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          action: "local-settlement-record-save",
          localFirst: true,
          databaseRecordsChanged: false,
          validation: {
            readyForLocalSettlementRecordSave: false,
            blockingErrors: validation.blockingErrors,
            warnings: validation.warnings,
          },
          safety: {
            clioRecordsChanged: false,
            databaseRecordsChanged: false,
            documentsGenerated: false,
            printQueueChanged: false,
            mattersClosed: false,
            settlementWritebackPerformed: false,
          },
        },
        { status: 400 }
      );
    }

    const existingRecord = await prisma.localSettlementRecord.findFirst({
      where: {
        masterLawsuitId: validation.masterLawsuitId,
        voided: false,
      },
      orderBy: {
        recordedAt: "desc",
      },
      select: {
        id: true,
        recordedAt: true,
        status: true,
      },
    });

    if (existingRecord) {
      return NextResponse.json(
        {
          ok: false,
          action: "local-settlement-record-save",
          localFirst: true,
          databaseRecordsChanged: false,
          duplicateSettlementBlocked: true,
          error: "A settlement has already been recorded for this lawsuit.  Only one active settlement is permitted per lawsuit.",
          existingSettlement: {
            id: existingRecord.id,
            recordedAt: existingRecord.recordedAt,
            status: existingRecord.status,
          },
          validation: {
            readyForLocalSettlementRecordSave: false,
            blockingErrors: [
              "A settlement has already been recorded for this lawsuit.  Only one active settlement is permitted per lawsuit.",
            ],
            warnings: validation.warnings,
          },
          safety: {
            clioRecordsChanged: false,
            databaseRecordsChanged: false,
            documentsGenerated: false,
            printQueueChanged: false,
            mattersClosed: false,
            settlementWritebackPerformed: false,
          },
        },
        { status: 409 }
      );
    }

    const terms = validation.settlementTerms;
    const totals = validation.settlementTotals;

    const savedRecord = await prisma.localSettlementRecord.create({
      data: {
        masterLawsuitId: validation.masterLawsuitId,
        status: "recorded",
        source: "barsh-matters-local",
        payloadKind: clean(settlementRecordPayload?.payloadKind),
        recordIntent: clean(settlementRecordPayload?.recordIntent),
        settledWith: clean(terms?.settledWith) || null,
        settlementDate: clean(terms?.settlementDate) || null,
        paymentExpectedDate: clean(terms?.paymentExpectedDate) || null,
        notes: clean(terms?.notes) || null,
        allocationMode: clean(terms?.allocationMode) || "pro_rata_by_principal_balance",
        grossSettlementAmount: cents(terms?.grossSettlementAmount),
        interestAmountTotal: cents(totals?.interestAmountTotal),
        principalFeePercent: cents(terms?.principalFeePercent),
        interestFeePercent: cents(terms?.interestFeePercent),
        allocatedSettlementTotal: cents(totals?.allocatedSettlementTotal),
        principalFeeTotal: cents(totals?.principalFeeTotal),
        interestFeeTotal: cents(totals?.interestFeeTotal),
        totalFee: cents(totals?.totalFee),
        providerPrincipalNetTotal: cents(totals?.providerPrincipalNetTotal),
        providerInterestNetTotal: cents(totals?.providerInterestNetTotal),
        providerNetTotal: cents(totals?.providerNetTotal),
        rowCount: validation.settlementRows.length,
        previewSnapshot: settlementRecordPayload,
        roundingAdjustmentsSnapshot: settlementRecordPayload?.roundingAdjustments || [],
        safetySnapshot: {
          clioRecordsChanged: false,
          databaseRecordsChanged: true,
          databaseWriteScope: ["LocalSettlementRecord", "LocalSettlementRow"],
          priorActiveSettlementAutoSuperseded: false,
          duplicateSettlementBlocked: false,
          documentsGenerated: false,
          printQueueChanged: false,
          mattersClosed: false,
          settlementWritebackPerformed: false,
        },
        recordedBy: actorEmail || actorName || "barsh-matters-ui",
        rows: {
          create: validation.settlementRows.map((row: any) => ({
            masterLawsuitId: validation.masterLawsuitId,
            matterId: Number(row?.matterId || 0),
            displayNumber: row?.displayNumber || null,
            provider: row?.provider || null,
            patient: row?.patient || null,
            insurer: row?.insurer || null,
            claimNumber: row?.claimNumber || null,
            billNumber: row?.billNumber || null,
            dosStart: row?.dosStart || null,
            dosEnd: row?.dosEnd || null,
            denialReason: row?.denialReason || null,
            claimAmount: cents(row?.claimAmount),
            principalBasis: cents(row?.principalBasis),
            allocatedSettlement: cents(row?.allocatedSettlement),
            interestAmount: cents(row?.interestAmount),
            principalFee: cents(row?.principalFee),
            interestFee: cents(row?.interestFee),
            totalFee: cents(row?.totalFee),
            providerPrincipalNet: cents(row?.providerPrincipalNet),
            providerInterestNet: cents(row?.providerInterestNet),
            providerNet: cents(row?.providerNet),
            settlementStatus: clean(row?.settlementStatus) || "recorded_local_settlement",
            rowSnapshot: row,
          })),
        },
      },
      include: {
        rows: true,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        action: "local-settlement-record-save",
        localFirst: true,
        databaseRecordsChanged: true,
        savedRecord: {
          id: savedRecord.id,
          masterLawsuitId: savedRecord.masterLawsuitId,
          status: savedRecord.status,
          settledWith: savedRecord.settledWith,
          settlementDate: savedRecord.settlementDate,
          totalFee: savedRecord.totalFee,
          providerNetTotal: savedRecord.providerNetTotal,
          rowCount: savedRecord.rows.length,
          recordedAt: savedRecord.recordedAt,
        },
        validation: {
          readyForLocalSettlementRecordSave: true,
          blockingErrors: [],
          warnings: validation.warnings,
        },
        safety: {
          clioRecordsChanged: false,
          databaseRecordsChanged: true,
          databaseWriteScope: ["LocalSettlementRecord", "LocalSettlementRow"],
          documentsGenerated: false,
          printQueueChanged: false,
          mattersClosed: false,
          settlementWritebackPerformed: false,
        },
        note:
          "Local settlement record saved to Barsh Matters local settlement tables only.  One active settlement is permitted per lawsuit.  No Clio write, document generation, print queue change, or matter closure occurred.",
      },
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        action: "local-settlement-record-save",
        localFirst: true,
        databaseRecordsChanged: false,
        error: error?.message || "Local settlement record save failed.",
        safety: {
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
