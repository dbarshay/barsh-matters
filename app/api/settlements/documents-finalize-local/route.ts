import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import {
  listClioMatterDocuments,
  uploadBufferToClioMatterDocuments,
} from "@/lib/clioDocumentUpload";
import {
  convertWorkingDocxDriveItemToPdf,
  downloadWorkingDocxFromGraph,
  uploadWorkingDocxToGraph,
} from "@/lib/documents/graphWorkingDocuments";
import { buildSettlementPlannedDocuments } from "@/lib/documents/templateRegistry";
import { buildPlaceholderSeededDocxRouteArtifact } from "@/lib/documents/artifactContract";

export const runtime = "nodejs";

const DOCX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const PDF_CONTENT_TYPE = "application/pdf";

function clean(value: unknown): string {
  return String(value || "").trim();
}

function pdfFilenameFromDocxFilename(value: unknown): string {
  const raw = clean(value) || "Settlement Document.pdf";
  if (raw.toLowerCase().endsWith(".pdf")) return raw;
  if (raw.toLowerCase().endsWith(".docx")) return `${raw.slice(0, -5)}.pdf`;
  return `${raw.replace(/\.[^.]+$/, "") || "Settlement Document"}.pdf`;
}

function editedPdfFilenameFromDocxFilename(value: unknown): string {
  const basePdf = pdfFilenameFromDocxFilename(value);
  const stamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .replace(/Z$/, "Z");
  if (basePdf.toLowerCase().endsWith(".pdf")) {
    return `${basePdf.slice(0, -4)} - Edited ${stamp}.pdf`;
  }
  return `${basePdf} - Edited ${stamp}.pdf`;
}

function jsonSafe(value: unknown) {
  return JSON.parse(JSON.stringify(value ?? null));
}

function sha256Hex(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
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

function waitForGraphContentSync(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function downloadStableEditedWorkingDocxFromGraph(driveItemId: string, originalSourceDocxSha256 = "") {
  const pollMs = 2000;
  const minElapsedMs = 6000;
  const maxElapsedMs = originalSourceDocxSha256 ? 30000 : 12000;

  const byteLengthSequence: number[] = [];
  const sha256Sequence: string[] = [];

  let latest = await downloadWorkingDocxFromGraph(driveItemId);
  let latestBuffer = Buffer.from(latest.buffer);
  let latestSha256 = sha256Hex(latestBuffer);

  byteLengthSequence.push(latest.byteLength);
  sha256Sequence.push(latestSha256);

  let changedAcrossAttempts = false;
  let stableConsecutiveDownloads = 0;
  let changedFromOriginalSource = originalSourceDocxSha256
    ? latestSha256 !== originalSourceDocxSha256
    : true;
  let elapsedMs = 0;

  while (elapsedMs < maxElapsedMs) {
    await waitForGraphContentSync(pollMs);
    elapsedMs += pollMs;

    const next = await downloadWorkingDocxFromGraph(driveItemId);
    const nextBuffer = Buffer.from(next.buffer);
    const nextSha256 = sha256Hex(nextBuffer);

    byteLengthSequence.push(next.byteLength);
    sha256Sequence.push(nextSha256);

    if (nextBuffer.equals(latestBuffer)) {
      stableConsecutiveDownloads += 1;
    } else {
      changedAcrossAttempts = true;
      stableConsecutiveDownloads = 0;
    }

    if (originalSourceDocxSha256 && nextSha256 !== originalSourceDocxSha256) {
      changedFromOriginalSource = true;
    }

    latest = next;
    latestBuffer = nextBuffer;
    latestSha256 = nextSha256;

    if (
      elapsedMs >= minElapsedMs &&
      changedFromOriginalSource
    ) {
      break;
    }
  }

  return {
    ...latest,
    downloadAttempts: byteLengthSequence.length,
    byteLengthSequence,
    sha256Sequence,
    latestSha256,
    originalSourceDocxSha256: originalSourceDocxSha256 || null,
    changedAcrossAttempts,
    changedFromOriginalSource,
    graphContentStabilityPollMs: pollMs,
    graphContentStabilityMinElapsedMs: minElapsedMs,
    graphContentStabilityMaxElapsedMs: maxElapsedMs,
    graphContentStabilityElapsedMs: elapsedMs,
  };
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
    const workingDocumentDriveItemId = clean(body?.workingDocumentDriveItemId);
    const workingDocumentKey = clean(body?.workingDocumentKey);
    const workingDocumentSourceDocxSha256 = clean(body?.workingDocumentSourceDocxSha256);
    const finalizeFromEditedWorkingDocument = Boolean(workingDocumentDriveItemId);
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
      masterLawsuitId: masterLawsuitIdInput,
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

    const lawsuit = await prisma.lawsuit.findUnique({
      where: { masterLawsuitId: effectiveMasterLawsuitId },
      select: {
        clioMasterMatterId: true,
        clioMasterDisplayNumber: true,
        clioMasterMatterDescription: true,
      },
    });

    const clioMatterId = Number(lawsuit?.clioMasterMatterId || 0);
    const clioDisplayNumber = clean(lawsuit?.clioMasterDisplayNumber);
    const finalFilename = clean(generatedDocx.filename || selectedDocument.filename || `${templateKey}.docx`);

    if (!Number.isFinite(clioMatterId) || clioMatterId <= 0) {
      return NextResponse.json(
        {
          ok: false,
          action: "settlement-document-finalize-local",
          error: `No mapped Clio repository storage exists for ${effectiveMasterLawsuitId}. Finalized settlement documents must upload to the Barsh Matters Master Repository storage.`,
          safety: {
            localFirst: true,
            databaseRecordsChanged: false,
            clioRecordsChanged: false,
            printQueueChanged: false,
            emailsSent: false,
            noPdfPretended: true,
          },
        },
        { status: 400 }
      );
    }

    const generatedDocxDownloadUrl = clean(generatedDocx.downloadUrl);

    let docxBuffer = Buffer.alloc(0);
    let workingDocx: any = null;

    if (finalizeFromEditedWorkingDocument) {
      const downloadedEditedDocx = await downloadStableEditedWorkingDocxFromGraph(
        workingDocumentDriveItemId,
        workingDocumentSourceDocxSha256
      );
      docxBuffer = Buffer.from(downloadedEditedDocx.buffer);

      if (!docxBuffer.length) {
        throw new Error("Downloaded edited Word Web DOCX was empty and could not be finalized.");
      }

      const editedSnapshotFilename = `${finalFilename.replace(/\.docx$/i, "")} - Edited Snapshot ${new Date()
        .toISOString()
        .replace(/[:.]/g, "-")
        .replace(/Z$/, "Z")}.docx`;

      workingDocx = await uploadWorkingDocxToGraph({
        docxBuffer,
        filename: editedSnapshotFilename,
        folder: "BarshMattersSettlementFinalizationWorkingDocs",
      });

      workingDocx = {
        ...workingDocx,
        originalEditedDriveItemId: workingDocumentDriveItemId,
        originalEditedWebUrl: clean(body?.workingDocumentWebUrl),
        source: "edited-word-web-working-document-downloaded-snapshot",
        workingDocumentKey: workingDocumentKey || templateKey,
        editedSnapshotDownloadAttempts: downloadedEditedDocx.downloadAttempts,
        editedSnapshotByteLengthSequence: downloadedEditedDocx.byteLengthSequence,
        editedSnapshotChangedAcrossAttempts: downloadedEditedDocx.changedAcrossAttempts,
        editedSnapshotSha256Sequence: downloadedEditedDocx.sha256Sequence,
        editedSnapshotLatestSha256: downloadedEditedDocx.latestSha256,
        editedSnapshotOriginalSourceDocxSha256: downloadedEditedDocx.originalSourceDocxSha256,
        editedSnapshotChangedFromOriginalSource: downloadedEditedDocx.changedFromOriginalSource,
        graphContentStabilityElapsedMs: downloadedEditedDocx.graphContentStabilityElapsedMs,
        graphContentStabilityMinElapsedMs: downloadedEditedDocx.graphContentStabilityMinElapsedMs,
        graphContentStabilityMaxElapsedMs: downloadedEditedDocx.graphContentStabilityMaxElapsedMs,
      };
    } else {
      if (!generatedDocxDownloadUrl) {
        throw new Error("Generated settlement DOCX did not expose a download URL for Clio upload.");
      }

      const docxUrl = new URL(generatedDocxDownloadUrl, req.nextUrl.origin);
      const docxRes = await fetch(docxUrl);

      if (!docxRes.ok) {
        const text = await docxRes.text().catch(() => "");
        throw new Error(
          `Could not generate settlement DOCX for Clio upload: ${docxRes.status} ${docxRes.statusText}${text ? ` ${text.slice(0, 300)}` : ""}`
        );
      }

      docxBuffer = Buffer.from(await docxRes.arrayBuffer());

      if (!docxBuffer.length) {
        throw new Error("Generated settlement DOCX was empty and could not be uploaded to Clio.");
      }

      workingDocx = await uploadWorkingDocxToGraph({
        docxBuffer,
        filename: finalFilename,
        folder: "BarshMattersSettlementFinalizationWorkingDocs",
      });
    }

    const finalPdfFilename = finalizeFromEditedWorkingDocument
      ? editedPdfFilenameFromDocxFilename(finalFilename)
      : pdfFilenameFromDocxFilename(finalFilename);

    const pdfConversion = await convertWorkingDocxDriveItemToPdf({
      driveItemId: workingDocx.driveItemId,
    });

    const pdfBuffer = pdfConversion.pdfBuffer;

    if (!Buffer.isBuffer(pdfBuffer) || pdfBuffer.byteLength <= 0) {
      throw new Error("Generated settlement PDF was empty and could not be uploaded to Clio.");
    }

    const existingClioDocuments = await listClioMatterDocuments(clioMatterId);
    const existingMatch = existingClioDocuments.find((doc: any) => {
      const names = [
        clean(doc?.name),
        clean(doc?.filename),
        clean(doc?.latestDocumentVersion?.filename),
      ].filter(Boolean);
      return names.some((name) => name.toLowerCase() === finalPdfFilename.toLowerCase());
    });

    const uploaded: any[] = [];
    const skipped: any[] = [];

    if (existingMatch) {
      const existingMatchAny = existingMatch as any;
      const existingClioDocumentIdForSkippedPdf = String(
        existingMatch.id ||
        existingMatchAny.documentId ||
        existingMatchAny.document_id ||
        existingMatchAny.clioDocumentId ||
        ""
      ).trim();

      const existingClioDocumentVersionUuidForSkippedPdf = String(
        existingMatch.latestDocumentVersion?.uuid ||
        existingMatchAny.latest_document_version?.uuid ||
        existingMatch.latestDocumentVersion?.id ||
        existingMatchAny.latest_document_version?.id ||
        ""
      ).trim();

      skipped.push({
        key: templateKey,
        label: templateLabelInput || selectedDocument.label || templateKey,
        filename: finalPdfFilename,
        sourceDocxFilename: finalFilename,
        reason: "A PDF document with this exact filename already exists in the Barsh Matters Master Repository document storage.",
        duplicatePrevention: true,
        clioUploaded: false,
        existingClioDocumentId: existingClioDocumentIdForSkippedPdf || null,
        clioDocumentId: existingClioDocumentIdForSkippedPdf || null,
        documentId: existingClioDocumentIdForSkippedPdf || null,
        id: existingClioDocumentIdForSkippedPdf || null,
        existingClioDocumentName: existingMatch.name || existingMatch.filename || finalPdfFilename,
        existingClioDocumentVersionUuid: existingClioDocumentVersionUuidForSkippedPdf || null,
        clioDocumentVersionUuid: existingClioDocumentVersionUuidForSkippedPdf || null,
        finalizedPdfGenerated: true,
        uploadedAsDocx: false,
        uploadedAsPdf: false,
        workingDocumentDriveItemId: workingDocx.driveItemId,
        finalizedFromEditedWorkingDocument: finalizeFromEditedWorkingDocument,
        workingDocumentKey: workingDocumentKey || templateKey,
        graphPdfSourceDriveItemId: pdfConversion.sourceDriveItemId || workingDocx.driveItemId,
        printQueueRecordCreated: false,
        emailAttachmentReady: false,
      });
    } else {
      const uploadResult = await uploadBufferToClioMatterDocuments({
        matterId: clioMatterId,
        filename: finalPdfFilename,
        buffer: pdfBuffer,
        contentType: PDF_CONTENT_TYPE,
      });

      uploaded.push({
        key: templateKey,
        label: templateLabelInput || selectedDocument.label || templateKey,
        filename: finalPdfFilename,
        sourceDocxFilename: finalFilename,
        byteLength: pdfBuffer.byteLength,
        sourceDocxByteLength: docxBuffer.byteLength || null,
        originalEditedDriveItemId: workingDocx.originalEditedDriveItemId || null,
        originalEditedWebUrl: workingDocx.originalEditedWebUrl || null,
        editedSnapshotDownloadAttempts: workingDocx.editedSnapshotDownloadAttempts || null,
        editedSnapshotByteLengthSequence: workingDocx.editedSnapshotByteLengthSequence || null,
        editedSnapshotChangedAcrossAttempts: workingDocx.editedSnapshotChangedAcrossAttempts ?? null,
        contentType: PDF_CONTENT_TYPE,
        sourceDocxContentType: DOCX_CONTENT_TYPE,
        uploadedAsDocx: false,
        uploadedAsPdf: true,
        finalizedPdfGenerated: true,
        workingDocumentDriveItemId: workingDocx.driveItemId,
        finalizedFromEditedWorkingDocument: finalizeFromEditedWorkingDocument,
        workingDocumentKey: workingDocumentKey || templateKey,
        graphPdfSourceDriveItemId: pdfConversion.sourceDriveItemId || workingDocx.driveItemId,
        pdfFinalization: {
          provider: "microsoft_graph_driveitem_content_format_pdf",
          source: "settlement-generated-docx-drive-item",
          sourceDriveItemId: pdfConversion.sourceDriveItemId || workingDocx.driveItemId,
          pdfContentType: pdfConversion.pdfContentType || PDF_CONTENT_TYPE,
          pdfByteLength: pdfConversion.pdfByteLength || pdfBuffer.byteLength,
        },
        clioDocumentId: uploadResult.documentId,
        clioDocumentName: uploadResult.documentName,
        clioDocumentVersionUuid: uploadResult.documentVersionUuid,
        fullyUploaded: uploadResult.fullyUploaded,
        printQueueRecordCreated: false,
        emailAttachmentReady: false,
      });
    }

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
      finalizedPdfGenerated: true,
      persistentFileCreated: false,
      routeBackedArtifact: generatedDocx.routeBackedArtifact,
      clioUploaded: uploaded.length > 0,
      clioSkippedDuplicate: skipped.length > 0,
      clioUploadTargetMatterId: clioMatterId,
      clioUploadTargetDisplayNumber: clioDisplayNumber || null,
      printQueueRecordCreated: false,
      emailAttachmentReady: false,
      note: "Local settlement finalization generated the settlement DOCX route and automatically stored the document in the Barsh Matters Master Repository document storage when no exact filename duplicate existed.",
    };

    const record = await prisma.documentFinalization.create({
      data: {
        masterLawsuitId: effectiveMasterLawsuitId,
        masterMatterId: clioMatterId,
        masterDisplayNumber: clioDisplayNumber || null,
        status: uploaded.length > 0 ? "settlement-uploaded-to-clio" : "settlement-clio-duplicate-skipped",
        requestedKeys: jsonSafe([templateKey]),
        uploaded: jsonSafe(uploaded),
        skipped: jsonSafe(skipped),
        clioUploadTarget: jsonSafe({
          type: "mapped-master-lawsuit",
          matterId: clioMatterId,
          displayNumber: clioDisplayNumber || null,
          description: clean(lawsuit?.clioMasterMatterDescription) || null,
          uploadTargetMode: "master-lawsuit",
          clioUploadDeferred: false,
        }),
        validationSnapshot: jsonSafe({
          canFinalizeLocally: true,
          settlementRecordId: settlementRecord.id,
          settlementStatus: settlementRecord.status,
          settlementVoided: settlementRecord.voided,
          selectedTemplateKey: templateKey,
          selectedTemplateLabel: selectedSnapshot.templateLabel,
          finalizedPdfGenerated: true,
          uploadedAsDocx: false,
          uploadedAsPdf: uploaded.length > 0,
          duplicateSkipped: skipped.length > 0,
          clioUploaded: uploaded.length > 0,
          finalizedFromEditedWorkingDocument: finalizeFromEditedWorkingDocument,
          workingDocumentDriveItemId: workingDocx.driveItemId,
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
          workingDocument: {
            driveItemId: workingDocx.driveItemId,
            name: workingDocx.name || finalFilename,
            webUrl: workingDocx.webUrl || null,
            source: finalizeFromEditedWorkingDocument ? "edited-word-web-working-document-downloaded-snapshot" : "generated-route-working-document",
            originalEditedDriveItemId: workingDocx.originalEditedDriveItemId || null,
            originalEditedWebUrl: workingDocx.originalEditedWebUrl || null,
            workingDocumentKey: workingDocumentKey || templateKey,
          },
          finalizedFromEditedWorkingDocument: finalizeFromEditedWorkingDocument,
          plannedDocumentCount: plannedDocuments.length,
          folderPath,
        }),
        allowDuplicateUploads: false,
        noUploadPerformed: uploaded.length === 0,
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
      workingDocument: {
        driveItemId: workingDocx.driveItemId,
        name: workingDocx.name || finalFilename,
        webUrl: workingDocx.webUrl || null,
        source: finalizeFromEditedWorkingDocument ? "edited-word-web-working-document-downloaded-snapshot" : "generated-route-working-document",
        originalEditedDriveItemId: workingDocx.originalEditedDriveItemId || null,
        originalEditedWebUrl: workingDocx.originalEditedWebUrl || null,
        editedSnapshotDownloadAttempts: workingDocx.editedSnapshotDownloadAttempts || null,
        editedSnapshotByteLengthSequence: workingDocx.editedSnapshotByteLengthSequence || null,
        editedSnapshotChangedAcrossAttempts: workingDocx.editedSnapshotChangedAcrossAttempts ?? null,
        workingDocumentKey: workingDocumentKey || templateKey,
      },
      finalizedFromEditedWorkingDocument: finalizeFromEditedWorkingDocument,
      uploaded,
      skipped,
      clioUploadTarget: {
        type: "mapped-master-lawsuit",
        matterId: clioMatterId,
        displayNumber: clioDisplayNumber || null,
        description: clean(lawsuit?.clioMasterMatterDescription) || null,
      },
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
      safety: {
        ...safetyLocalSettlementDocumentFinalize(),
        clioRecordsChanged: uploaded.length > 0,
        clioDocumentsUploaded: uploaded.length,
        duplicateClioDocumentsSkipped: skipped.length,
        noUploadPerformed: uploaded.length === 0,
        uploadedOnlyToMappedMasterClioMatterDocumentsTab: true,
      },
      note:
        uploaded.length > 0
          ? "Created a persistent local Barsh Matters DocumentFinalization record and automatically uploaded the finalized settlement PDF to the Barsh Matters Master Repository document storage. No Outlook draft was created, no email was sent, and no print queue item was written."
          : "Created a persistent local Barsh Matters DocumentFinalization record. Clio upload was skipped because an exact filename duplicate already exists in the Barsh Matters Master Repository document storage. No Outlook draft was created, no email was sent, and no print queue item was written.",
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
