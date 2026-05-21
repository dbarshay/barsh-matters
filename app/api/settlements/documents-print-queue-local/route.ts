import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function clean(value: unknown): string {
  return String(value || "").trim();
}

function jsonObject(value: unknown): any {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as any;
}

function jsonArray(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

function safeQueuePart(value: unknown): string {
  return clean(value)
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
}

function localQueueSafety(createdCount = 0, duplicateCount = 0) {
  return {
    localFirst: true,
    sourceOfTruth: "barsh-matters-local",
    printQueueRecordsCreated: createdCount,
    duplicateQueueRecordsSkipped: duplicateCount,
    databaseRecordsChanged: createdCount > 0,
    finalizedPdfGenerated: false,
    persistentFileCreated: false,
    noPdfPretended: true,
    clioRecordsChanged: false,
    clioDocumentsUploaded: false,
    emailsSent: false,
    outlookDraftsCreated: false,
    mattersClosed: false,
    oneDriveOrSharePointChanged: false,
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const finalizationId = Number(body?.finalizationId);
    const confirmAdd = body?.confirmAdd === true;

    if (!confirmAdd) {
      return NextResponse.json(
        {
          ok: false,
          action: "settlement-document-print-queue-local",
          error: "Print queue record was not created. This endpoint requires confirmAdd: true.",
          safety: localQueueSafety(0, 0),
        },
        { status: 400 }
      );
    }

    if (!Number.isFinite(finalizationId) || finalizationId <= 0) {
      return NextResponse.json(
        {
          ok: false,
          action: "settlement-document-print-queue-local",
          error: "Missing valid finalizationId.",
          safety: localQueueSafety(0, 0),
        },
        { status: 400 }
      );
    }

    const finalization = await prisma.documentFinalization.findUnique({
      where: { id: Math.floor(finalizationId) },
    });

    if (!finalization) {
      return NextResponse.json(
        {
          ok: false,
          action: "settlement-document-print-queue-local",
          error: `No DocumentFinalization record exists with id ${finalizationId}.`,
          safety: localQueueSafety(0, 0),
        },
        { status: 404 }
      );
    }

    if (finalization.status !== "local-settlement-finalized-placeholder") {
      return NextResponse.json(
        {
          ok: false,
          action: "settlement-document-print-queue-local",
          error: "Only local settlement finalized-document placeholder records may be queued by this route.",
          finalizationStatus: finalization.status,
          safety: localQueueSafety(0, 0),
        },
        { status: 400 }
      );
    }

    const packetSummary = jsonObject(finalization.packetSummarySnapshot);
    const selectedDocument = jsonObject(packetSummary.selectedDocument);
    const skipped = jsonArray(finalization.skipped);
    const fallbackSkipped = jsonObject(skipped[0]);

    const documentKey = clean(selectedDocument.key || fallbackSkipped.key || "settlement-document");
    const documentLabel = clean(selectedDocument.templateLabel || selectedDocument.label || fallbackSkipped.label || documentKey);
    const filename = clean(selectedDocument.filename || fallbackSkipped.filename || `${documentLabel}.docx`);
    const settlementRecordId = clean(selectedDocument.settlementRecordId || packetSummary?.settlementRecord?.id);

    const uniqueQueueKey = [
      "local-settlement-placeholder",
      finalization.id,
      safeQueuePart(documentKey),
      safeQueuePart(filename),
    ].join(":");

    const prior = await prisma.documentPrintQueueItem.findUnique({
      where: { uniqueQueueKey },
    });

    if (prior) {
      return NextResponse.json({
        ok: true,
        action: "settlement-document-print-queue-local",
        status: "already-queued",
        duplicate: true,
        printQueueItem: {
          id: prior.id,
          uniqueQueueKey: prior.uniqueQueueKey,
          status: prior.status,
          filename: prior.filename,
          queuedAt: prior.queuedAt.toISOString(),
        },
        safety: localQueueSafety(0, 1),
        note: "This local finalized-document placeholder was already in the Barsh Matters print queue. No duplicate queue record was created.",
      });
    }

    const record = await prisma.documentPrintQueueItem.create({
      data: {
        uniqueQueueKey,
        masterLawsuitId: finalization.masterLawsuitId,
        masterMatterId: finalization.masterMatterId,
        masterDisplayNumber: finalization.masterDisplayNumber,
        finalizationId: finalization.id,
        documentKey,
        documentLabel,
        filename,
        clioDocumentId: null,
        clioDocumentName: null,
        clioDocumentVersionUuid: null,
        status: "queued",
        notes: "Local settlement finalized-document placeholder queued. PDF generation and Clio document-vault upload are not yet wired.",
        documentSnapshot: {
          ...selectedDocument,
          queuedFrom: "local-settlement-finalized-placeholder",
          settlementRecordId: settlementRecordId || null,
          finalizedPdfGenerated: false,
          persistentFileCreated: false,
          clioUploaded: false,
          emailAttachmentReady: false,
          printableFileReady: false,
        },
        sourceFinalizationSnapshot: {
          id: finalization.id,
          status: finalization.status,
          masterLawsuitId: finalization.masterLawsuitId,
          masterMatterId: finalization.masterMatterId,
          masterDisplayNumber: finalization.masterDisplayNumber,
          noUploadPerformed: finalization.noUploadPerformed,
          finalizedAt: finalization.finalizedAt.toISOString(),
        },
      },
    });

    return NextResponse.json({
      ok: true,
      action: "settlement-document-print-queue-local",
      status: "queued",
      localFirst: true,
      sourceOfTruth: "barsh-matters-local",
      finalizationId: finalization.id,
      masterLawsuitId: finalization.masterLawsuitId,
      settlementRecordId: settlementRecordId || null,
      printQueueItem: {
        id: record.id,
        uniqueQueueKey: record.uniqueQueueKey,
        status: record.status,
        filename: record.filename,
        documentKey: record.documentKey,
        documentLabel: record.documentLabel,
        queuedAt: record.queuedAt.toISOString(),
      },
      safety: localQueueSafety(1, 0),
      note: "Created a local Barsh Matters DocumentPrintQueueItem from a settlement DocumentFinalization placeholder. No PDF was generated, no Clio upload occurred, no Outlook draft was created, and no email was sent.",
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        action: "settlement-document-print-queue-local",
        error: error?.message || "Local settlement document print queue add failed.",
        safety: localQueueSafety(0, 0),
      },
      { status: 500 }
    );
  }
}
