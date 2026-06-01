import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function jsonSafe(value: unknown) {
  return JSON.parse(JSON.stringify(value ?? null));
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);

    const masterLawsuitId = clean(body?.masterLawsuitId);
    const settlementRecordId = clean(body?.settlementRecordId);
    const voidReason = clean(body?.voidReason);
    const voidedBy = clean(body?.voidedBy) || "Administrator";
    const confirmVoid = body?.confirmVoid === true;

    if (!confirmVoid) {
      return NextResponse.json(
        {
          ok: false,
          action: "settlement-local-void",
          error: "Settlement void was not performed. This endpoint requires confirmVoid: true.",
          databaseRecordsChanged: false,
        },
        { status: 400 }
      );
    }

    if (!masterLawsuitId) {
      return NextResponse.json(
        {
          ok: false,
          action: "settlement-local-void",
          error: "masterLawsuitId is required.",
          databaseRecordsChanged: false,
        },
        { status: 400 }
      );
    }

    if (!voidReason) {
      return NextResponse.json(
        {
          ok: false,
          action: "settlement-local-void",
          error: "Void reason is required.",
          databaseRecordsChanged: false,
        },
        { status: 400 }
      );
    }

    const existing = settlementRecordId
      ? await prisma.localSettlementRecord.findFirst({
          where: {
            id: settlementRecordId,
            masterLawsuitId,
          },
          include: {
            rows: true,
          },
        })
      : await prisma.localSettlementRecord.findFirst({
          where: {
            masterLawsuitId,
            voided: false,
          },
          orderBy: {
            recordedAt: "desc",
          },
          include: {
            rows: true,
          },
        });

    if (!existing) {
      return NextResponse.json(
        {
          ok: false,
          action: "settlement-local-void",
          error: settlementRecordId ? "No matching local settlement record was found for this master lawsuit." : "No active local settlement record was found for this master lawsuit.",
          databaseRecordsChanged: false,
        },
        { status: 404 }
      );
    }

    if (existing.voided) {
      return NextResponse.json(
        {
          ok: true,
          action: "settlement-local-void",
          alreadyVoided: true,
          databaseRecordsChanged: false,
          settlementRecord: {
            id: existing.id,
            masterLawsuitId: existing.masterLawsuitId,
            voided: true,
            voidedAt: existing.voidedAt,
            voidedBy: existing.voidedBy,
            voidReason: existing.voidReason,
          },
          safety: {
            localOnly: true,
            clioWritesPerformed: false,
            localTablesEligibleForUpdate: ["LocalSettlementRecord", "LocalWorkflowTickler"],
            localSettlementRowsDeleted: false,
          },
        }
      );
    }

    const voidSnapshot = {
      action: "settlement-local-void",
      voidedAt: new Date().toISOString(),
      voidedBy,
      voidReason,
      previousStatus: existing.status,
      rowCount: existing.rows.length,
      grossSettlementAmount: existing.grossSettlementAmount,
      settlementDate: existing.settlementDate,
      paymentExpectedDate: existing.paymentExpectedDate,
      settledWith: existing.settledWith,
      existingRecord: jsonSafe({
        id: existing.id,
        masterLawsuitId: existing.masterLawsuitId,
        status: existing.status,
        rowCount: existing.rowCount,
        grossSettlementAmount: existing.grossSettlementAmount,
        settledWith: existing.settledWith,
        settlementDate: existing.settlementDate,
        paymentExpectedDate: existing.paymentExpectedDate,
      }),
    };

    const result = await prisma.$transaction(async (tx) => {
      const updatedRecord = await tx.localSettlementRecord.update({
        where: { id: existing.id },
        data: {
          status: "voided",
          voided: true,
          voidedAt: new Date(),
          voidedBy,
          voidReason,
          voidSnapshot,
        },
      });

      const ticklers = await tx.localWorkflowTickler.deleteMany({
        where: {
          kind: "settlement_payment_due_followup",
          OR: [
            { masterLawsuitId, settlementRecordId: existing.id },
            { settlementRecordId: existing.id },
          ],
          status: {
            notIn: ["completed", "voided", "cancelled"],
          },
        },
      });

      return {
        updatedRecord,
        ticklersDeleted: ticklers.count,
      };
    });

    return NextResponse.json({
      ok: true,
      action: "settlement-local-void",
      databaseRecordsChanged: true,
      clioRecordsChanged: false,
      settlementRecord: {
        id: result.updatedRecord.id,
        masterLawsuitId: result.updatedRecord.masterLawsuitId,
        status: result.updatedRecord.status,
        voided: result.updatedRecord.voided,
        voidedAt: result.updatedRecord.voidedAt,
        voidedBy: result.updatedRecord.voidedBy,
        voidReason: result.updatedRecord.voidReason,
      },
      counts: {
        settlementRecordsVoided: 1,
        settlementRowsDeleted: 0,
        workflowTicklersDeleted: result.ticklersDeleted,
      },
      safety: {
        localOnly: true,
        clioWritesPerformed: false,
        localTablesUpdated: ["LocalSettlementRecord", "LocalWorkflowTickler"],
        localSettlementRowsPreservedForHistory: true,
      },
      note:
        "Voided the active local settlement record and deleted related open settlement payment due ticklers only. No Clio records, documents, print queue records, or email records were changed.",
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        action: "settlement-local-void",
        error: error?.message || "Local settlement void failed.",
        databaseRecordsChanged: false,
      },
      { status: 500 }
    );
  }
}
