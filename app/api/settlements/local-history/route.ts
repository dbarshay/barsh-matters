import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function intLimit(value: unknown, fallback = 10): number {
  const parsed = Number.parseInt(clean(value), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, 50);
}

function money(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value * 100) / 100;
  }
  const raw = clean(value).replace(/[$,%\s,]/g, "");
  if (!raw) return 0;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : 0;
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const masterLawsuitId = clean(url.searchParams.get("masterLawsuitId"));
    const includeVoided = clean(url.searchParams.get("includeVoided")).toLowerCase() === "true";
    const limit = intLimit(url.searchParams.get("limit"), 10);

    if (!masterLawsuitId) {
      return NextResponse.json(
        {
          ok: false,
          action: "local-settlement-history",
          localFirst: true,
          sourceOfTruth: "barsh-matters-local",
          error: "Missing masterLawsuitId.",
          safety: {
            readOnly: true,
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

    const records = await prisma.localSettlementRecord.findMany({
      where: {
        masterLawsuitId,
        ...(includeVoided ? {} : { voided: false }),
      },
      orderBy: {
        recordedAt: "desc",
      },
      take: limit,
      include: {
        rows: {
          orderBy: [
            { displayNumber: "asc" },
            { matterId: "asc" },
          ],
        },
      },
    });

    const activeRecord = records.find((record) => !record.voided) || null;

    return NextResponse.json({
      ok: true,
      action: "local-settlement-history",
      localFirst: true,
      sourceOfTruth: "barsh-matters-local",
      masterLawsuitId,
      includeVoided,
      count: records.length,
      activeRecordId: activeRecord?.id || null,
      records: records.map((record) => ({
        id: record.id,
        masterLawsuitId: record.masterLawsuitId,
        status: record.status,
        source: record.source,
        settledWith: record.settledWith,
        settlementDate: record.settlementDate,
        paymentExpectedDate: record.paymentExpectedDate,
        notes: record.notes,
        allocationMode: record.allocationMode,
        grossSettlementAmount: money(record.grossSettlementAmount),
        interestAmountTotal: money(record.interestAmountTotal),
        principalFeePercent: money(record.principalFeePercent),
        interestFeePercent: money(record.interestFeePercent),
        allocatedSettlementTotal: money(record.allocatedSettlementTotal),
        principalFeeTotal: money(record.principalFeeTotal),
        interestFeeTotal: money(record.interestFeeTotal),
        totalFee: money(record.totalFee),
        providerPrincipalNetTotal: money(record.providerPrincipalNetTotal),
        providerInterestNetTotal: money(record.providerInterestNetTotal),
        providerNetTotal: money(record.providerNetTotal),
        rowCount: record.rowCount,
        recordedBy: record.recordedBy,
        recordedAt: record.recordedAt,
        voided: record.voided,
        voidedAt: record.voidedAt,
        voidedBy: record.voidedBy,
        voidReason: record.voidReason,
        rows: record.rows.map((row) => ({
          id: row.id,
          settlementRecordId: row.settlementRecordId,
          masterLawsuitId: row.masterLawsuitId,
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
          claimAmount: money(row.claimAmount),
          principalBasis: money(row.principalBasis),
          allocatedSettlement: money(row.allocatedSettlement),
          interestAmount: money(row.interestAmount),
          principalFee: money(row.principalFee),
          interestFee: money(row.interestFee),
          totalFee: money(row.totalFee),
          providerPrincipalNet: money(row.providerPrincipalNet),
          providerInterestNet: money(row.providerInterestNet),
          providerNet: money(row.providerNet),
          settlementStatus: row.settlementStatus,
        })),
      })),
      totals: activeRecord
        ? {
            grossSettlementAmount: money(activeRecord.grossSettlementAmount),
            principal: money(activeRecord.allocatedSettlementTotal),
            interest: money(activeRecord.interestAmountTotal),
            attorneyFee: money(activeRecord.totalFee),
            providerNet: money(activeRecord.providerNetTotal),
            providerPrincipalNet: money(activeRecord.providerPrincipalNetTotal),
            providerInterestNet: money(activeRecord.providerInterestNetTotal),
          }
        : null,
      safety: {
        readOnly: true,
        clioRecordsChanged: false,
        databaseRecordsChanged: false,
        documentsGenerated: false,
        printQueueChanged: false,
        mattersClosed: false,
        settlementWritebackPerformed: false,
      },
      note:
        "Read-only Barsh Matters local settlement history.  This route reads LocalSettlementRecord and LocalSettlementRow only.  It does not write Clio, generate documents, change the print queue, close matters, or perform settlement writeback.",
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        action: "local-settlement-history",
        localFirst: true,
        sourceOfTruth: "barsh-matters-local",
        error: error?.message || "Local settlement history readback failed.",
        safety: {
          readOnly: true,
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
