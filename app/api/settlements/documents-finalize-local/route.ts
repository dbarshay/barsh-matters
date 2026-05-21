import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildSettlementPlannedDocuments } from "@/lib/documents/templateRegistry";
import { buildPlaceholderSeededDocxRouteArtifact } from "@/lib/documents/artifactContract";

export const runtime = "nodejs";

function clean(value: unknown): string {
  return String(value || "").trim();
}

function jsonSafe(value: unknown) {
  return JSON.parse(JSON.stringify(value ?? null));
}

function safeFilePart(value: unknown): string {
  const text = clean(value) || "Unknown";
  return text
    .replace(/[\\/:*?"<>|#%{}[\]^~`]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 140);
}

function todayPathPart() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function settlementDocxRouteForTemplate(templateKey: string): string {
  const key = clean(templateKey);
  if (key === "settlement-summary") return "/api/settlements/settlement-summary";
  if (key === "provider-remittance-breakdown") return "/api/settlements/provider-remittance-breakdown";
  if (key === "attorney-fee-breakdown") return "/api/settlements/attorney-fee-breakdown";
  return "";
}

function buildGeneratedDocxReference(params: {
  templateKey: string;
  masterLawsuitId: string;
  settlementRecordId?: string | null;
  filename?: string | null;
}) {
  const endpoint = settlementDocxRouteForTemplate(params.templateKey);
  const query = new URLSearchParams();

  if (params.masterLawsuitId) query.set("masterLawsuitId", params.masterLawsuitId);
  if (params.settlementRecordId) query.set("settlementRecordId", params.settlementRecordId);

  const downloadUrl = endpoint ? `${endpoint}?${query.toString()}` : "";

  return buildPlaceholderSeededDocxRouteArtifact({
    workflowSource: "settlement",
    templateKey: params.templateKey,
    templateLabel: params.templateKey,
    filename: params.filename || null,
    generationEndpoint: endpoint || null,
    downloadUrl: downloadUrl || null,
    metadata: {
      settlementRecordId: params.settlementRecordId || null,
      masterLawsuitId: params.masterLawsuitId,
    },
  });
}

function firstOrMultiple(values: unknown[], fallback: string) {
  const cleaned = Array.from(
    new Set(
      values
        .map((value) => clean(value))
        .filter(Boolean)
    )
  );

  if (cleaned.length === 0) return fallback;
  if (cleaned.length === 1) return cleaned[0];
  return "Multiple";
}

function rowSnapshotValue(row: any, keys: string[]): string {
  const snapshot =
    row?.rowSnapshot && typeof row.rowSnapshot === "object" && !Array.isArray(row.rowSnapshot)
      ? row.rowSnapshot
      : {};

  for (const key of keys) {
    const direct = clean(row?.[key]);
    if (direct) return direct;

    const snap = clean((snapshot as any)?.[key]);
    if (snap) return snap;
  }

  return "";
}

function safetyLocalSettlementDocumentFinalize() {
  return {
    localFirst: true,
    sourceOfTruth: "barsh-matters-local",
    databaseRecordsChanged: true,
    documentFinalizationRecordCreated: true,
    finalizedPdfGenerated: false,
    persistentFileCreated: false,
    noPdfPretended: true,
    clioRecordsChanged: false,
    clioDocumentsUploaded: false,
    printQueueChanged: false,
    emailsSent: false,
    outlookDraftsCreated: false,
    mattersClosed: false,
    ticklersChanged: false,
    oneDriveOrSharePointChanged: false,
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const masterLawsuitIdInput = clean(body?.masterLawsuitId);
    const settlementRecordId = clean(body?.settlementRecordId);
    const templateKey = clean(body?.templateKey);
    const templateLabelInput = clean(body?.templateLabel);
    const confirmFinalize = body?.confirmFinalize === true;

    if (!confirmFinalize) {
      return NextResponse.json(
        {
          ok: false,
          action: "settlement-document-finalize-local",
          error: "Local finalization was not performed. This endpoint requires confirmFinalize: true.",
          safety: {
            localFirst: true,
            databaseRecordsChanged: false,
            clioRecordsChanged: false,
            printQueueChanged: false,
            emailsSent: false,
          },
        },
        { status: 400 }
      );
    }

    if (!settlementRecordId && !masterLawsuitIdInput) {
      return NextResponse.json(
        {
          ok: false,
          action: "settlement-document-finalize-local",
          error: "Missing settlementRecordId or masterLawsuitId.",
          safety: {
            localFirst: true,
            databaseRecordsChanged: false,
            clioRecordsChanged: false,
            printQueueChanged: false,
            emailsSent: false,
          },
        },
        { status: 400 }
      );
    }

    if (!templateKey) {
      return NextResponse.json(
        {
          ok: false,
          action: "settlement-document-finalize-local",
          error: "Missing templateKey.",
          safety: {
            localFirst: true,
            databaseRecordsChanged: false,
            clioRecordsChanged: false,
            printQueueChanged: false,
            emailsSent: false,
          },
        },
        { status: 400 }
      );
    }

    const settlementRecord = await prisma.localSettlementRecord.findFirst({
      where: {
        ...(settlementRecordId ? { id: settlementRecordId } : { masterLawsuitId: masterLawsuitIdInput }),
        voided: false,
      },
      include: {
        rows: {
          orderBy: [{ matterId: "asc" }, { billNumber: "asc" }],
        },
      },
      orderBy: {
        recordedAt: "desc",
      },
    });

    if (!settlementRecord) {
      return NextResponse.json(
        {
          ok: false,
          action: "settlement-document-finalize-local",
          error: "No active local settlement record was found for this document finalization.",
          settlementRecordId: settlementRecordId || null,
          masterLawsuitId: masterLawsuitIdInput || null,
          safety: {
            localFirst: true,
            databaseRecordsChanged: false,
            clioRecordsChanged: false,
            printQueueChanged: false,
            emailsSent: false,
          },
        },
        { status: 404 }
      );
    }

    const rows: any[] = Array.isArray(settlementRecord.rows) ? settlementRecord.rows : [];
    const effectiveMasterLawsuitId = clean(settlementRecord.masterLawsuitId) || masterLawsuitIdInput;
    const provider = firstOrMultiple(
      rows.map((row) => rowSnapshotValue(row, ["provider", "providerName", "clientName", "client"])),
      "No Provider"
    );
    const patient = firstOrMultiple(
      rows.map((row) => rowSnapshotValue(row, ["patient", "patientName"])),
      "No Patient"
    );
    const insurer = firstOrMultiple(
      rows.map((row) => rowSnapshotValue(row, ["insurer", "insurerName", "insuranceCompany"])),
      "No Insurer"
    );
    const claimNumber = firstOrMultiple(
      rows.map((row) => rowSnapshotValue(row, ["claimNumber", "claim_number"])),
      "No Claim"
    );

    const baseName = `${safeFilePart(effectiveMasterLawsuitId)} - ${safeFilePart(provider)} aao ${safeFilePart(patient)} v ${safeFilePart(insurer)} - Claim ${safeFilePart(claimNumber)}`;
    const folderPath = `Settlements/${todayPathPart()}/${safeFilePart(effectiveMasterLawsuitId)}`;
    const plannedDocuments = buildSettlementPlannedDocuments({
      baseName,
      blockingErrors: [],
    });

    const selectedDocument = plannedDocuments.find((doc: any) => clean(doc?.key) === templateKey);

    if (!selectedDocument) {
      return NextResponse.json(
        {
          ok: false,
          action: "settlement-document-finalize-local",
          error: `Selected settlement document template was not found: ${templateKey}`,
          templateKey,
          availableTemplates: plannedDocuments.map((doc: any) => ({
            key: doc.key,
            label: doc.label,
            filename: doc.filename,
          })),
          safety: {
            localFirst: true,
            databaseRecordsChanged: false,
            clioRecordsChanged: false,
            printQueueChanged: false,
            emailsSent: false,
          },
        },
        { status: 400 }
      );
    }

    const generatedDocx = {
      ...buildGeneratedDocxReference({
        templateKey,
        masterLawsuitId: effectiveMasterLawsuitId,
        settlementRecordId: settlementRecord.id,
        filename: selectedDocument.filename || null,
      }),
      templateLabel: templateLabelInput || selectedDocument.label || templateKey,
    };

    const selectedSnapshot = {
      ...selectedDocument,
      templateLabel: templateLabelInput || selectedDocument.label || templateKey,
      settlementRecordId: settlementRecord.id,
      masterLawsuitId: effectiveMasterLawsuitId,
      sourceOfTruth: "barsh-matters-local",
      templateSource: "placeholder-seeded",
      productionTemplateReady: false,
      finalProductionDocument: false,
      generatedDocument: generatedDocx,
      docxDownloadUrl: generatedDocx.downloadUrl,
      finalizedPdfGenerated: false,
      persistentFileCreated: false,
      routeBackedArtifact: generatedDocx.routeBackedArtifact,
      clioUploaded: false,
      printQueueRecordCreated: false,
      emailAttachmentReady: false,
      note: "Local finalization stores a placeholder-seeded Barsh Matters DOCX generation route reference for testing. This is not a final production template/document. It does not create a persistent file, PDF, Clio upload, email attachment, or print queue record.",
    };

    const record = await prisma.documentFinalization.create({
      data: {
        masterLawsuitId: effectiveMasterLawsuitId,
        masterMatterId: 0,
        masterDisplayNumber: null,
        status: "local-settlement-finalized-placeholder",
        requestedKeys: jsonSafe([templateKey]),
        uploaded: jsonSafe([]),
        skipped: jsonSafe([
          {
            key: templateKey,
            label: selectedSnapshot.templateLabel,
            filename: selectedDocument.filename || null,
            reason: "PDF generation and Clio upload are intentionally not wired in this local-only placeholder finalization step.",
            finalizedPdfGenerated: false,
            clioUploaded: false,
            printQueueRecordCreated: false,
            emailAttachmentReady: false,
          },
        ]),
        clioUploadTarget: jsonSafe({
          type: "none-local-placeholder",
          clioUploadDeferred: true,
          reason: "Clio remains document vault/access storage only and is not used during local settlement finalization placeholder creation.",
        }),
        validationSnapshot: jsonSafe({
          canFinalizeLocally: true,
          settlementRecordId: settlementRecord.id,
          settlementStatus: settlementRecord.status,
          settlementVoided: settlementRecord.voided,
          selectedTemplateKey: templateKey,
          selectedTemplateLabel: selectedSnapshot.templateLabel,
          finalizedPdfGenerated: false,
          noPdfPretended: true,
        }),
        packetSummarySnapshot: jsonSafe({
          workflow: "settlement-document-finalization",
          localFirst: true,
          sourceOfTruth: "barsh-matters-local",
          templateSource: "placeholder-seeded",
          productionTemplateReady: false,
          finalProductionDocument: false,
          settlementRecord: {
            id: settlementRecord.id,
            masterLawsuitId: settlementRecord.masterLawsuitId,
            status: settlementRecord.status,
            settledWith: settlementRecord.settledWith,
            settlementDate: settlementRecord.settlementDate,
            paymentExpectedDate: settlementRecord.paymentExpectedDate,
            grossSettlementAmount: settlementRecord.grossSettlementAmount,
            providerNetTotal: settlementRecord.providerNetTotal,
            rowCount: settlementRecord.rowCount,
            recordedAt: settlementRecord.recordedAt,
          },
          selectedDocument: selectedSnapshot,
          generatedDocument: generatedDocx,
          plannedDocumentCount: plannedDocuments.length,
          folderPath,
        }),
        allowDuplicateUploads: false,
        noUploadPerformed: true,
        error: null,
        finalizedAt: new Date(),
      },
    });

    return NextResponse.json({
      ok: true,
      action: "settlement-document-finalize-local",
      localFirst: true,
      sourceOfTruth: "barsh-matters-local",
      masterLawsuitId: effectiveMasterLawsuitId,
      settlementRecordId: settlementRecord.id,
      selectedDocument: selectedSnapshot,
      generatedDocument: generatedDocx,
      finalizationRecord: {
        id: record.id,
        status: record.status,
        masterLawsuitId: record.masterLawsuitId,
        masterMatterId: record.masterMatterId,
        masterDisplayNumber: record.masterDisplayNumber,
        noUploadPerformed: record.noUploadPerformed,
        finalizedAt: record.finalizedAt.toISOString(),
        createdAt: record.createdAt.toISOString(),
      },
      safety: safetyLocalSettlementDocumentFinalize(),
      note: "Created a persistent local Barsh Matters DocumentFinalization record for the selected settlement document with a placeholder-seeded DOCX generation route reference. This is not a final production template/document. No persistent file was created, no PDF was generated, no Clio upload occurred, no Outlook draft was created, and no print queue item was written.",
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        action: "settlement-document-finalize-local",
        error: error?.message || "Local settlement document finalization failed.",
        safety: {
          localFirst: true,
          databaseRecordsChanged: false,
          clioRecordsChanged: false,
          printQueueChanged: false,
          emailsSent: false,
          noPdfPretended: true,
        },
      },
      { status: 500 }
    );
  }
}
