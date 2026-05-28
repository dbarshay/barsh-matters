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


function firstPresent(...values: any[]): any {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim() !== "") return value;
  }
  return null;
}

function settlementAmountOrPercentDisplay(value: any): string | null {
  const raw = firstPresent(value);
  if (raw === null) return null;

  const text = String(raw).trim();
  if (!text) return null;

  if (text.includes("%")) {
    const n = Number(text.replace(/[%\s,]/g, ""));
    return Number.isFinite(n) ? `${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}%` : text;
  }

  if (text.includes("$")) {
    const n = Number(text.replace(/[$,\s]/g, ""));
    return Number.isFinite(n)
      ? n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : text;
  }

  const n = Number(text.replace(/[,\s]/g, ""));
  if (!Number.isFinite(n)) return text;

  if (n < 101) {
    return `${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}%`;
  }

  return n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
}


function numericMoney(value: any): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

function recordCostsAmount(record: any): number {
  const snapshot = record?.previewSnapshot && typeof record.previewSnapshot === "object" ? record.previewSnapshot : {};
  const terms = snapshot?.settlementTerms && typeof snapshot.settlementTerms === "object" ? snapshot.settlementTerms : {};
  const totals = snapshot?.settlementTotals && typeof snapshot.settlementTotals === "object" ? snapshot.settlementTotals : {};
  return numericMoney(
    firstPresent(
      totals.costsAmount,
      terms.costsAmount,
      snapshot.costsAmount,
      0
    )
  );
}

function rowCostsAmount(row: any): number {
  const snapshot = row?.rowSnapshot && typeof row.rowSnapshot === "object" ? row.rowSnapshot : {};
  return numericMoney(
    firstPresent(
      snapshot.costAmount,
      snapshot.costsAmount,
      snapshot.filingFee,
      0
    )
  );
}

function displayMoney(value: any): string {
  const n = numericMoney(value);
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function percentText(value: number): string | null {
  if (!Number.isFinite(value)) return null;
  return `${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}%`;
}

function percentDisplayFromRawInput(value: any): string | null {
  const raw = firstPresent(value);
  if (raw === null) return null;

  const text = String(raw).trim();
  if (!text) return null;
  if (text.includes("$")) return null;

  const n = Number(text.replace(/[%\s,]/g, ""));
  if (!Number.isFinite(n)) return null;

  if (text.includes("%") || n < 101) return percentText(n);
  return null;
}

function derivedPrincipalPercent(record: any): string | null {
  const rows = Array.isArray(record?.rows) ? record.rows : [];
  const basisTotal = rows.reduce((sum: number, row: any) => sum + numericMoney(row?.principalBasis), 0);
  const allocatedTotal = numericMoney(record?.allocatedSettlementTotal);

  if (basisTotal <= 0 || allocatedTotal <= 0) return null;
  return percentText((allocatedTotal / basisTotal) * 100);
}

function derivedInterestPercent(record: any): string | null {
  const snapshot = record?.previewSnapshot && typeof record.previewSnapshot === "object" ? record.previewSnapshot : {};
  const terms = snapshot?.settlementTerms && typeof snapshot.settlementTerms === "object" ? snapshot.settlementTerms : {};
  const basis = numericMoney(
    firstPresent(
      terms.interestBasis,
      terms.calculatedInterestAmount,
      snapshot.interestBasis,
      snapshot.calculatedInterestAmount,
      0
    )
  );
  const amount = numericMoney(record?.interestAmountTotal);

  if (basis > 0 && amount > 0) return percentText((amount / basis) * 100);
  return percentDisplayFromRawInput(firstPresent(terms.interestSettlementInput, snapshot.interestSettlementInput));
}

function combinedSettlementDisplay(amount: any, rawPercentInput: any, fallbackPercent: string | null): string | null {
  const amountDisplay = displayMoney(amount);
  const percentDisplay = percentDisplayFromRawInput(rawPercentInput) || fallbackPercent;
  return percentDisplay ? `${amountDisplay} (${percentDisplay})` : amountDisplay;
}

function settlementInputDisplaysFromRecord(record: any): {
  principalSettlementDisplay: string | null;
  interestSettlementDisplay: string | null;
} {
  const snapshot = record?.previewSnapshot && typeof record.previewSnapshot === "object" ? record.previewSnapshot : {};
  const terms = snapshot?.settlementTerms && typeof snapshot.settlementTerms === "object" ? snapshot.settlementTerms : {};
  const totals = snapshot?.settlementTotals && typeof snapshot.settlementTotals === "object" ? snapshot.settlementTotals : {};

  const principalPercentInput = firstPresent(
    terms.principalSettlementInput,
    terms.grossSettlementAmountInput,
    snapshot.principalSettlementInput,
    snapshot.grossSettlementAmountInput
  );

  const interestPercentInput = firstPresent(
    terms.interestSettlementInput,
    snapshot.interestSettlementInput
  );

  return {
    principalSettlementDisplay: combinedSettlementDisplay(
      firstPresent(record.allocatedSettlementTotal, totals.allocatedSettlementTotal, terms.grossSettlementAmount, record.grossSettlementAmount),
      principalPercentInput,
      derivedPrincipalPercent(record)
    ),
    interestSettlementDisplay: combinedSettlementDisplay(
      firstPresent(record.interestAmountTotal, totals.interestAmountTotal, terms.interestAmount),
      interestPercentInput,
      derivedInterestPercent(record)
    ),
  };
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
      records: records.map((record) => {
        const settlementInputDisplays = settlementInputDisplaysFromRecord(record);
        const costsAmount = recordCostsAmount(record);
        const totalSettlementAmount = numericMoney(record.allocatedSettlementTotal) + numericMoney(record.interestAmountTotal) + costsAmount + numericMoney(record.totalFee);

        return {
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
        principalSettlementDisplay: settlementInputDisplays.principalSettlementDisplay,
        interestSettlementDisplay: settlementInputDisplays.interestSettlementDisplay,
        costsAmount: money(costsAmount),
        totalSettlementAmount: money(totalSettlementAmount),
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
        rows: record.rows.map((row, rowIndex) => {
          const costAmount = rowCostsAmount(row) || (rowIndex === 0 ? costsAmount : 0);
          const settlementTotal = numericMoney(row.allocatedSettlement) + numericMoney(row.interestAmount) + costAmount + numericMoney(row.totalFee);

          return {
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
          costAmount: money(costAmount),
          principalFee: money(row.principalFee),
          interestFee: money(row.interestFee),
          totalFee: money(row.totalFee),
          settlementTotal: money(settlementTotal),
          providerPrincipalNet: money(row.providerPrincipalNet),
          providerInterestNet: money(row.providerInterestNet),
          providerNet: money(row.providerNet),
          settlementStatus: row.settlementStatus,
          };
        }),
      };
      }),
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
