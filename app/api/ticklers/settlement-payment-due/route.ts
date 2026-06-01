import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TICKLER_KIND = "settlement_payment_due_followup";

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function boolParam(value: unknown): boolean {
  return clean(value).toLowerCase() === "true";
}

function isValidDueDate(value: unknown): boolean {
  const raw = clean(value);
  if (!raw) return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(raw);
}

async function findSettlementRecord(input: {
  settlementRecordId?: string;
  masterLawsuitId?: string;
}) {
  const settlementRecordId = clean(input.settlementRecordId);
  const masterLawsuitId = clean(input.masterLawsuitId);

  if (settlementRecordId) {
    return prisma.localSettlementRecord.findFirst({
      where: {
        id: settlementRecordId,
        voided: false,
      },
      include: {
        rows: {
          orderBy: [{ displayNumber: "asc" }, { matterId: "asc" }],
        },
      },
    });
  }

  if (masterLawsuitId) {
    return prisma.localSettlementRecord.findFirst({
      where: {
        masterLawsuitId,
        voided: false,
      },
      orderBy: {
        recordedAt: "desc",
      },
      include: {
        rows: {
          orderBy: [{ displayNumber: "asc" }, { matterId: "asc" }],
        },
      },
    });
  }

  return null;
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const masterLawsuitId = clean(url.searchParams.get("masterLawsuitId"));
    const settlementRecordId = clean(url.searchParams.get("settlementRecordId"));
    const includeCompleted = boolParam(url.searchParams.get("includeCompleted"));

    if (!masterLawsuitId && !settlementRecordId) {
      return NextResponse.json(
        {
          ok: false,
          action: "settlement-payment-due-ticklers-list",
          localFirst: true,
          sourceOfTruth: "barsh-matters-local",
          error: "Missing masterLawsuitId or settlementRecordId.",
          safety: {
            clioRecordsChanged: false,
            documentsGenerated: false,
            printQueueChanged: false,
            mattersClosed: false,
            calendarEventsCreated: false,
            emailsSent: false,
          },
        },
        { status: 400 }
      );
    }

    const ticklers = await prisma.localWorkflowTickler.findMany({
      where: {
        kind: TICKLER_KIND,
        ...(masterLawsuitId ? { masterLawsuitId } : {}),
        ...(settlementRecordId ? { settlementRecordId } : {}),
        ...(includeCompleted ? {} : { status: "open" }),
      },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      take: 50,
    });

    return NextResponse.json({
      ok: true,
      action: "settlement-payment-due-ticklers-list",
      localFirst: true,
      sourceOfTruth: "barsh-matters-local",
      count: ticklers.length,
      ticklers,
      safety: {
        readOnly: true,
        clioRecordsChanged: false,
        databaseRecordsChanged: false,
        documentsGenerated: false,
        printQueueChanged: false,
        mattersClosed: false,
        calendarEventsCreated: false,
        emailsSent: false,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        action: "settlement-payment-due-ticklers-list",
        localFirst: true,
        sourceOfTruth: "barsh-matters-local",
        error: error?.message || "Settlement payment due tickler list failed.",
        safety: {
          clioRecordsChanged: false,
          documentsGenerated: false,
          printQueueChanged: false,
          mattersClosed: false,
          calendarEventsCreated: false,
          emailsSent: false,
        },
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const settlementRecordId = clean(body?.settlementRecordId);
    const masterLawsuitId = clean(body?.masterLawsuitId);
    const previewOnly = body?.previewOnly === true;
    const actorName = clean(body?.actorName);
    const actorEmail = clean(body?.actorEmail);

    const settlementRecord = await findSettlementRecord({
      settlementRecordId,
      masterLawsuitId,
    });

    if (!settlementRecord) {
      return NextResponse.json(
        {
          ok: false,
          action: "settlement-payment-due-tickler",
          localFirst: true,
          sourceOfTruth: "barsh-matters-local",
          databaseRecordsChanged: false,
          error: "No active local settlement record found for tickler creation.",
          safety: {
            clioRecordsChanged: false,
            databaseRecordsChanged: false,
            documentsGenerated: false,
            printQueueChanged: false,
            mattersClosed: false,
            calendarEventsCreated: false,
            emailsSent: false,
          },
        },
        { status: 404 }
      );
    }

    if (!isValidDueDate(settlementRecord.paymentExpectedDate)) {
      return NextResponse.json(
        {
          ok: false,
          action: "settlement-payment-due-tickler",
          localFirst: true,
          sourceOfTruth: "barsh-matters-local",
          databaseRecordsChanged: false,
          error: "Settlement record does not have a valid Payment Due Date.",
          settlementRecordId: settlementRecord.id,
          masterLawsuitId: settlementRecord.masterLawsuitId,
          paymentExpectedDate: settlementRecord.paymentExpectedDate,
          safety: {
            clioRecordsChanged: false,
            databaseRecordsChanged: false,
            documentsGenerated: false,
            printQueueChanged: false,
            mattersClosed: false,
            calendarEventsCreated: false,
            emailsSent: false,
          },
        },
        { status: 400 }
      );
    }

    const firstRow = settlementRecord.rows[0] || null;
    const rowMatterLabels = settlementRecord.rows
      .map((row) => row.displayNumber || (row.matterId ? `Matter ${row.matterId}` : ""))
      .filter(Boolean);

    const title = `Payment due follow-up for ${settlementRecord.masterLawsuitId}`;
    const descriptionParts = [
      `Settlement payment due on ${settlementRecord.paymentExpectedDate}.`,
      settlementRecord.settledWith ? `Settled with: ${settlementRecord.settledWith}.` : "",
      rowMatterLabels.length ? `Related matter(s): ${rowMatterLabels.join(", ")}.` : "",
    ].filter(Boolean);

    const existingTickler = await prisma.localWorkflowTickler.findFirst({
      where: {
        kind: TICKLER_KIND,
        settlementRecordId: settlementRecord.id,
        status: "open",
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const ticklerPlan = {
      kind: TICKLER_KIND,
      source: "barsh-matters-local",
      status: "open",
      priority: "normal",
      title,
      description: descriptionParts.join("  "),
      masterLawsuitId: settlementRecord.masterLawsuitId,
      matterId: null,
      displayNumber: settlementRecord.masterLawsuitId,
      settlementRecordId: settlementRecord.id,
      dueDate: settlementRecord.paymentExpectedDate,
      createdBy: actorEmail || actorName || null,
      metadata: {
        settlementRecordId: settlementRecord.id,
        settledWith: settlementRecord.settledWith,
        settlementDate: settlementRecord.settlementDate,
        paymentExpectedDate: settlementRecord.paymentExpectedDate,
        localSettlementStatus: settlementRecord.status,
        rowCount: settlementRecord.rowCount,
        relatedMatters: settlementRecord.rows.map((row) => ({
          matterId: row.matterId,
          displayNumber: row.displayNumber,
          provider: row.provider,
          patient: row.patient,
          claimNumber: row.claimNumber,
        })),
      },
    };

    if (previewOnly) {
      return NextResponse.json({
        ok: true,
        action: "settlement-payment-due-tickler-preview",
        localFirst: true,
        sourceOfTruth: "barsh-matters-local",
        previewOnly: true,
        databaseRecordsChanged: false,
        existingTickler,
        ticklerPlan,
        safety: {
          clioRecordsChanged: false,
          databaseRecordsChanged: false,
          documentsGenerated: false,
          printQueueChanged: false,
          mattersClosed: false,
          calendarEventsCreated: false,
          emailsSent: false,
        },
      });
    }

    if (existingTickler) {
      return NextResponse.json({
        ok: true,
        action: "settlement-payment-due-tickler",
        localFirst: true,
        sourceOfTruth: "barsh-matters-local",
        databaseRecordsChanged: false,
        duplicatePrevented: true,
        tickler: existingTickler,
        safety: {
          clioRecordsChanged: false,
          databaseRecordsChanged: false,
          documentsGenerated: false,
          printQueueChanged: false,
          mattersClosed: false,
          calendarEventsCreated: false,
          emailsSent: false,
        },
      });
    }

    const tickler = await prisma.localWorkflowTickler.create({
      data: ticklerPlan,
    });

    return NextResponse.json({
      ok: true,
      action: "settlement-payment-due-tickler",
      localFirst: true,
      sourceOfTruth: "barsh-matters-local",
      databaseRecordsChanged: true,
      tickler,
      safety: {
        clioRecordsChanged: false,
        databaseRecordsChanged: true,
        documentsGenerated: false,
        printQueueChanged: false,
        mattersClosed: false,
        calendarEventsCreated: false,
        emailsSent: false,
      },
      note:
        "Created a Barsh Matters local payment due follow-up tickler.  This does not create a Clio task, calendar event, email, document, print queue item, or matter closure.",
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        action: "settlement-payment-due-tickler",
        localFirst: true,
        sourceOfTruth: "barsh-matters-local",
        databaseRecordsChanged: false,
        error: error?.message || "Settlement payment due tickler creation failed.",
        safety: {
          clioRecordsChanged: false,
          databaseRecordsChanged: false,
          documentsGenerated: false,
          printQueueChanged: false,
          mattersClosed: false,
          calendarEventsCreated: false,
          emailsSent: false,
        },
      },
      { status: 500 }
    );
  }
}
