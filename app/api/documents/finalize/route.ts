import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  findExistingClioDocumentsByFilename,
  listClioFolderDocuments,
  listClioMatterDocuments,
  uploadBufferToClioMatterDocuments,
} from "@/lib/clioDocumentUpload";
import { convertWorkingDocxDriveItemToPdf } from "@/lib/documents/graphWorkingDocuments";
import { buildClioStorageFolderResolutionPreview } from "@/lib/clioStorageFolderResolution";
import { resolveClioMatterFolderWithGuard } from "@/lib/clioFolderResolverExecutor";
import { getClioStorageWriteGuard } from "@/lib/clioStorageWriteGuard";
import type { ClioStorageTargetInput } from "@/lib/clioStoragePlan";
import { adminUnauthorizedJson, isAdminRequestAuthorized } from "@/lib/adminAuth";

export const runtime = "nodejs";

const DOCX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const PDF_CONTENT_TYPE = "application/pdf";

type PlannedDocument = {
  key: string;
  label: string;
  filename: string;
  sourceEndpoint: string;
  wouldGenerate: boolean;
  wouldUploadToClio: boolean;
  availableNow: boolean;
  status: string;
  note?: string;
};

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function pdfFilenameFromDocxFilename(value: unknown): string {
  const raw = clean(value) || "Document.pdf";
  if (raw.toLowerCase().endsWith(".pdf")) return raw;
  if (raw.toLowerCase().endsWith(".docx")) return `${raw.slice(0, -5)}.pdf`;
  return `${raw.replace(/\.[^.]+$/, "") || "Document"}.pdf`;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => clean(item)).filter(Boolean);
}

function jsonSafe(value: unknown): any {
  if (value == null) return null;

  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return null;
  }
}

async function recordDocumentFinalizationAttempt(params: {
  masterLawsuitId: string;
  matterId: number;
  preview: any;
  status: string;
  requestedKeys: string[];
  uploaded: any[];
  skipped: any[];
  allowDuplicateUploads: boolean;
  noUploadPerformed: boolean;
  error?: string;
}) {
  try {
    const target = params.preview?.clioUploadTarget || {};
    const displayNumber = clean(target?.displayNumber);

    const record = await prisma.documentFinalization.create({
      data: {
        masterLawsuitId: params.masterLawsuitId,
        masterMatterId: params.matterId,
        masterDisplayNumber: displayNumber || null,
        status: params.status,
        requestedKeys: jsonSafe(params.requestedKeys),
        uploaded: jsonSafe(params.uploaded),
        skipped: jsonSafe(params.skipped),
        clioUploadTarget: jsonSafe(params.preview?.clioUploadTarget),
        validationSnapshot: jsonSafe(params.preview?.validation),
        packetSummarySnapshot: jsonSafe(params.preview?.packetSummary),
        allowDuplicateUploads: params.allowDuplicateUploads,
        noUploadPerformed: params.noUploadPerformed,
        error: params.error || null,
        finalizedAt: new Date(),
      },
    });

    return {
      ok: true,
      id: record.id,
    };
  } catch (err: any) {
    return {
      ok: false,
      error: err?.message || "Could not record document finalization metadata.",
    };
  }
}

async function loadFinalizePreview(req: NextRequest, params: {
  masterLawsuitId: string;
  uploadTargetMode?: string;
  directMatterId?: string | number | null;
  directMatterDisplayNumber?: string | null;
}) {
  const previewUrl = new URL("/api/documents/finalize-preview", req.nextUrl.origin);
  previewUrl.searchParams.set("masterLawsuitId", params.masterLawsuitId);

  if (clean(params.uploadTargetMode)) {
    previewUrl.searchParams.set("uploadTarget", clean(params.uploadTargetMode));
  }

  if (clean(params.directMatterId)) {
    previewUrl.searchParams.set("directMatterId", clean(params.directMatterId));
  }

  if (clean(params.directMatterDisplayNumber)) {
    previewUrl.searchParams.set("directMatterDisplayNumber", clean(params.directMatterDisplayNumber));
  }

  const previewRes = await fetch(previewUrl, {
    method: "GET",
    cache: "no-store",
  });

  const previewJson = await previewRes.json().catch(() => null);

  if (!previewRes.ok || !previewJson) {
    throw new Error(
      previewJson?.error || "Could not load finalization preview before upload."
    );
  }

  return previewJson;
}

function getMasterMatterId(preview: any): number {
  const raw = preview?.clioUploadTarget?.matterId;
  const matterId = Number(raw);

  if (!Number.isFinite(matterId) || matterId <= 0) {
    throw new Error("Finalize upload is blocked because the master matter ID is missing.");
  }

  return matterId;
}


function buildSingleMasterFinalizeTargetInput(preview: any, params: {
  masterLawsuitId: string;
  uploadTargetMode?: string;
  directMatterId?: string;
  directMatterDisplayNumber?: string;
}): ClioStorageTargetInput {
  const target = preview?.clioUploadTarget || {};
  const isDirectMatter = params.uploadTargetMode === "direct-matter";

  if (isDirectMatter) {
    const directMatterFileNumber = clean(
      params.directMatterDisplayNumber ||
        target?.directMatterFileNumber ||
        target?.matterDisplayNumber ||
        target?.displayNumber ||
        params.directMatterId
    );

    if (process.env.CLIO_DIRECT_INDIVIDUAL_FINALIZE_TARGET_INPUT_ENABLED !== "1") {
      throw new Error(
        "Single-master Clio storage for direct/individual matters is blocked until CLIO_DIRECT_INDIVIDUAL_FINALIZE_TARGET_INPUT_ENABLED=1."
      );
    }

    if (!/^BRL_\d{9}$/.test(directMatterFileNumber)) {
      throw new Error(
        "Single-master Clio storage for direct/individual matters requires a Barsh Matters direct matter file number in BRL_YYYYNNNNN format."
      );
    }

    return {
      storageTargetKind: "individual_matter",
      directMatterFileNumber,
      bmMatterId: directMatterFileNumber,
      displayNumber: directMatterFileNumber,
    };
  }

  const displayNumber = clean(
    params.masterLawsuitId ||
      target?.lawsuitId ||
      target?.masterLawsuitId
  );
  const lawsuitId = clean(
    params.masterLawsuitId ||
      target?.lawsuitId ||
      target?.masterLawsuitId ||
      displayNumber
  );
  const bmMatterId = clean(
    params.masterLawsuitId ||
      target?.bmMatterId ||
      target?.masterLawsuitId ||
      lawsuitId ||
      displayNumber
  );

  if (!bmMatterId && !lawsuitId && !displayNumber) {
    throw new Error(
      "Single-master Clio storage target cannot be derived without a Barsh Matters lawsuit identifier."
    );
  }

  return {
    bmMatterId: bmMatterId || lawsuitId || displayNumber,
    lawsuitId: lawsuitId || displayNumber || bmMatterId,
    displayNumber: displayNumber || lawsuitId || bmMatterId,
  };
}

async function generateDocumentBuffer(req: NextRequest, document: PlannedDocument) {
  const sourceUrl = new URL(document.sourceEndpoint, req.nextUrl.origin);

  const docRes = await fetch(sourceUrl, {
    method: "GET",
    cache: "no-store",
  });

  const contentType = docRes.headers.get("Content-Type") || "";

  if (!docRes.ok) {
    const text = await docRes.text().catch(() => "");
    throw new Error(
      `Document generation failed for ${document.label}: ${docRes.status} ${docRes.statusText}${text ? ` ${text}` : ""}`
    );
  }

  if (!contentType.includes(DOCX_CONTENT_TYPE)) {
    const text = await docRes.text().catch(() => "");
    throw new Error(
      `Document generation for ${document.label} did not return a .docx response. Content-Type was ${contentType || "missing"}.${text ? ` Body: ${text}` : ""}`
    );
  }

  const arrayBuffer = await docRes.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (!buffer.length) {
    throw new Error(`Document generation returned an empty buffer for ${document.label}.`);
  }

  return buffer;
}

export async function POST(req: NextRequest) {
  const uploaded: any[] = [];
  const skipped: any[] = [];

  try {
    const body = await req.json().catch(() => ({}));
    const allowDuplicateUploads = body?.allowDuplicateUploads === true;

    const masterLawsuitId = clean(body?.masterLawsuitId);
    const uploadTargetMode = clean(body?.uploadTargetMode || body?.uploadTarget);
    const directMatterId = clean(body?.directMatterId);
    const directMatterDisplayNumber = clean(body?.directMatterDisplayNumber);
    const confirmUpload = body?.confirmUpload === true;
    const useSingleMasterClioStorage = body?.useSingleMasterClioStorage === true;
    const singleMasterDryRun = body?.singleMasterDryRun !== false;
    const singleMasterResolveFolders = body?.singleMasterResolveFolders === true;
    const requestedKeys = asStringArray(body?.documentKeys);
    const workingDocumentDriveItemId = clean(body?.workingDocumentDriveItemId || body?.workingDriveItemId);
    const workingDocumentKey = clean(body?.workingDocumentKey);

    if (!masterLawsuitId && uploadTargetMode !== "direct-matter") {
      return NextResponse.json(
        { ok: false, error: "Missing masterLawsuitId" },
        { status: 400 }
      );
    }

    if (uploadTargetMode === "direct-matter" && !masterLawsuitId && !directMatterId && !directMatterDisplayNumber) {
      return NextResponse.json(
        { ok: false, error: "Missing directMatterId or directMatterDisplayNumber." },
        { status: 400 }
      );
    }

    const effectiveMasterLawsuitId =
      masterLawsuitId ||
      `DIRECT-${directMatterDisplayNumber || (directMatterId ? `BRL${directMatterId}` : "MATTER")}`;

    if (!confirmUpload && !(useSingleMasterClioStorage && singleMasterDryRun)) {
      return NextResponse.json(
        {
          ok: false,
          action: "finalize-upload",
          error:
            "Upload not performed. This endpoint requires confirmUpload: true unless useSingleMasterClioStorage dry-run mode is requested.",
          safety: {
            noUploadPerformed: true,
            duplicatePreventionDefault: !allowDuplicateUploads,
            noDatabaseRecordsChanged: true,
            noOneDriveOrSharePointFoldersCreated: true,
            singleMasterDryRunAllowedWithoutConfirmUpload: true,
          },
        },
        { status: 400 }
      );
    }

    const useDirectFinalizePreview = uploadTargetMode === "direct-matter" && (!masterLawsuitId || useSingleMasterClioStorage);


  const isDirectMatterLiveFinalizeRequest =
    useDirectFinalizePreview &&
    uploadTargetMode === "direct-matter" &&
    confirmUpload === true &&
    singleMasterDryRun !== true;

  const directMatterLiveFinalizeServerEnabled =
    String(process.env.BARSH_DIRECT_MATTER_CLIO_LIVE_FINALIZE_ENABLED || "").trim() === "1";

  if (isDirectMatterLiveFinalizeRequest && !directMatterLiveFinalizeServerEnabled) {
    return NextResponse.json(
      {
        ok: false,
        action: "direct-live-server-kill-switch",
        authorized: true,
        serverLiveFinalizeEnabled: false,
        error: "Direct matter live finalize is disabled by server configuration.",
      },
      { status: 403 },
    );
  }


  if (isDirectMatterLiveFinalizeRequest && !isAdminRequestAuthorized(req as any)) {
    return adminUnauthorizedJson(403);
  }

    const preview =
      useDirectFinalizePreview
        ? await (async () => {
            const previewUrl = new URL("/api/documents/direct-finalize-preview", req.nextUrl.origin);
            if (directMatterId) previewUrl.searchParams.set("directMatterId", directMatterId);
            if (directMatterDisplayNumber) previewUrl.searchParams.set("directMatterDisplayNumber", directMatterDisplayNumber);
            if (useSingleMasterClioStorage) previewUrl.searchParams.set("singleMasterDirectStorage", "1");
            const previewRes = await fetch(previewUrl, { method: "GET", cache: "no-store" });
            const previewJson = await previewRes.json().catch(() => null);
            if (!previewRes.ok || !previewJson) {
              throw new Error(previewJson?.error || "Could not load direct matter finalization preview before upload.");
            }
            return previewJson;
          })()
        : await loadFinalizePreview(req, {
            masterLawsuitId,
            uploadTargetMode,
            directMatterId,
            directMatterDisplayNumber,
          });
    const validation = preview?.validation || {};

    let singleMasterTargetInput: ClioStorageTargetInput | null = null;
    let singleMasterFolderResolution: any = null;
    let uploadRewiredToSingleMasterFolder = false;
    let singleMasterUploadFolderId: number | null = null;

    if (useSingleMasterClioStorage) {
      singleMasterTargetInput = buildSingleMasterFinalizeTargetInput(preview, {
        masterLawsuitId,
        uploadTargetMode,
        directMatterId,
        directMatterDisplayNumber,
      });

      if (singleMasterDryRun) {
        const folderResolution = singleMasterResolveFolders
          ? await resolveClioMatterFolderWithGuard(singleMasterTargetInput)
          : buildClioStorageFolderResolutionPreview(singleMasterTargetInput);

        return NextResponse.json({
          ok: true,
          action: "finalize-upload",
          finalizeRewired: true,
          uploadRewired: false,
          databaseMutation: false,
          clioWrite: singleMasterResolveFolders,
          noUploadPerformed: true,
          confirmUploadRequired: false,
          generationSkipped: true,
          singleMasterDryRun,
          singleMasterResolveFolders,
          folderResolutionMode: singleMasterResolveFolders
            ? "guarded-live-folder-resolution-no-upload"
            : "preview-only-no-clio-call",
          singleMasterTargetInput,
          folderResolution,
          safety: {
            clioIsStorageOnly: true,
            barshMattersOwnsFileAndLawsuitNumbers: true,
            noPatientProviderInsurerClaimFolderNames: true,
            noDocumentUploadPerformed: true,
            noDatabaseRecordsChanged: true,
          },
        });
      }

      const uploadGuard = getClioStorageWriteGuard();
      if (!uploadGuard.uploadRewireEnabled || !uploadGuard.liveClioWriteEnabled || !uploadGuard.createFoldersEnabled) {
        return NextResponse.json(
          {
            ok: false,
            action: "finalize-upload",
            error:
              "Single-master finalize upload is disabled unless CLIO_SINGLE_MASTER_UPLOAD_REWIRE_ENABLED=1, CLIO_SINGLE_MASTER_CREATE_FOLDERS_ENABLED=1, and CLIO_SINGLE_MASTER_LIVE_WRITE_ENABLED=1.",
            finalizeRewired: true,
            uploadRewired: false,
            databaseMutation: false,
            noUploadPerformed: true,
            confirmUploadRequired: true,
            singleMasterTargetInput,
            uploadGuard: {
              uploadRewireEnabled: uploadGuard.uploadRewireEnabled,
              createFoldersEnabled: uploadGuard.createFoldersEnabled,
              liveClioWriteEnabled: uploadGuard.liveClioWriteEnabled,
            },
            safety: {
              clioIsStorageOnly: true,
              barshMattersOwnsFileAndLawsuitNumbers: true,
              noPatientProviderInsurerClaimFolderNames: true,
              noDocumentUploadPerformed: true,
              noDatabaseRecordsChanged: true,
            },
          },
          { status: 403 }
        );
      }

      singleMasterFolderResolution = await resolveClioMatterFolderWithGuard(singleMasterTargetInput);
      singleMasterUploadFolderId = Number(singleMasterFolderResolution?.folderId);

      if (!Number.isFinite(singleMasterUploadFolderId) || singleMasterUploadFolderId <= 0) {
        throw new Error("Single-master finalize upload could not resolve a valid Clio folder upload target.");
      }

      uploadRewiredToSingleMasterFolder = true;
    }

    if (!validation.canGenerate) {
      return NextResponse.json(
        {
          ok: false,
          action: "finalize-upload",
          error: "Finalize upload blocked because packet validation is not generation-ready.",
          validation,
          safety: {
            noUploadPerformed: true,
            duplicatePreventionDefault: !allowDuplicateUploads,
            noDatabaseRecordsChanged: true,
            noOneDriveOrSharePointFoldersCreated: true,
          },
        },
        { status: 422 }
      );
    }

    const matterId = uploadRewiredToSingleMasterFolder
      ? Number(singleMasterFolderResolution?.targetPlan?.masterMatterId)
      : getMasterMatterId(preview);
    const plannedDocuments: PlannedDocument[] = Array.isArray(preview?.plannedDocuments)
      ? preview.plannedDocuments
      : [];

    const selectedDocuments = plannedDocuments.filter((document) => {
      if (!document?.wouldGenerate || !document?.wouldUploadToClio) return false;
      if (!requestedKeys.length) return true;
      return requestedKeys.includes(document.key);
    });

    const existingDocuments = uploadRewiredToSingleMasterFolder
      ? await listClioFolderDocuments(Number(singleMasterUploadFolderId))
      : await listClioMatterDocuments(matterId);
    const documentsToUpload: PlannedDocument[] = [];

    for (const document of selectedDocuments) {
      const finalPdfFilename = pdfFilenameFromDocxFilename(document.filename);
      const existingMatches = findExistingClioDocumentsByFilename(
        existingDocuments,
        finalPdfFilename
      );

      if (existingMatches.length > 0 && !allowDuplicateUploads) {
        skipped.push({
          key: document.key,
          label: document.label,
          filename: finalPdfFilename,
          sourceDocxFilename: document.filename,
          reason: "already-uploaded-to-clio",
          existingClioDocuments: existingMatches.map((match) => ({
            id: match.id,
            name: match.name,
            filename: match.filename,
            createdAt: match.createdAt,
            updatedAt: match.updatedAt,
            latestDocumentVersion: match.latestDocumentVersion,
          })),
        });
        continue;
      }

      documentsToUpload.push(document);
    }

    for (const document of plannedDocuments) {
      if (selectedDocuments.includes(document)) continue;
      skipped.push({
        key: document.key,
        label: document.label,
        filename: pdfFilenameFromDocxFilename(document.filename),
        sourceDocxFilename: document.filename,
        reason: requestedKeys.length
          ? "not-requested"
          : document.wouldUploadToClio
            ? "not-selected"
            : "not-uploadable",
      });
    }

    if (!documentsToUpload.length) {
      const duplicateOnlySkip =
        selectedDocuments.length > 0 &&
        selectedDocuments.every((document) =>
          skipped.some(
            (skip) =>
              clean(skip?.key) === clean(document?.key) &&
              clean(skip?.reason) === "already-uploaded-to-clio"
          )
        );

      if (duplicateOnlySkip) {
        const finalizationRecord = await recordDocumentFinalizationAttempt({
          masterLawsuitId: effectiveMasterLawsuitId,
          matterId,
          preview,
          status: "nothing-uploaded-existing-documents-skipped",
          requestedKeys,
          uploaded: [],
          skipped,
          allowDuplicateUploads,
          noUploadPerformed: true,
        });

        return NextResponse.json({
          ok: true,
          action: "finalize-upload",
          status: "nothing-uploaded-existing-documents-skipped",
          message:
            "No upload was performed because all selected documents already exist in Clio by exact filename match.",
          requestedKeys,
          uploaded: [],
          skipped,
          finalizationRecord,
          uploadRewired: uploadRewiredToSingleMasterFolder,
          folderResolution: uploadRewiredToSingleMasterFolder ? singleMasterFolderResolution : null,
          safety: {
            noUploadPerformed: true,
            duplicatePreventionDefault: !allowDuplicateUploads,
            databaseAuditRecordAttempted: true,
            databaseAuditRecordCreated: finalizationRecord.ok,
            databaseAuditLayerOnly: true,
            clioDocumentsTabRemainsSourceOfTruth: true,
            noOneDriveOrSharePointFoldersCreated: true,
          },
        });
      }

      return NextResponse.json(
        {
          ok: false,
          action: "finalize-upload",
          status: "nothing-selected-for-upload",
          error: "No final documents were selected for upload.",
          requestedKeys,
          uploaded: [],
          skipped,
          safety: {
            noUploadPerformed: true,
            duplicatePreventionDefault: !allowDuplicateUploads,
            noDatabaseRecordsChanged: true,
            noOneDriveOrSharePointFoldersCreated: true,
          },
        },
        { status: 400 }
      );
    }

    for (const document of documentsToUpload) {
      const finalPdfFilename = pdfFilenameFromDocxFilename(document.filename);
      const shouldUseWorkingDocument =
        Boolean(workingDocumentDriveItemId) &&
        (!workingDocumentKey || clean(workingDocumentKey) === clean(document.key));

      let sourceDocxByteLength: number | null = null;
      let pdfBuffer: Buffer;
      let pdfConversion: any;

      if (shouldUseWorkingDocument) {
        pdfConversion = await convertWorkingDocxDriveItemToPdf({
          driveItemId: workingDocumentDriveItemId,
        });
        pdfBuffer = pdfConversion.pdfBuffer;
      } else {
        throw new Error(
          "Finalize Document now requires a saved working Word document so the final PDF reflects the latest edits. Use Edit Document first, save in Word, then Finalize Document."
        );
      }

      const result = await uploadBufferToClioMatterDocuments({
        matterId,
        filename: finalPdfFilename,
        buffer: pdfBuffer,
        contentType: PDF_CONTENT_TYPE,
        parentType: uploadRewiredToSingleMasterFolder ? "Folder" : "Matter",
        parentId: uploadRewiredToSingleMasterFolder ? Number(singleMasterUploadFolderId) : undefined,
      });

      uploaded.push({
        key: document.key,
        label: document.label,
        filename: finalPdfFilename,
        sourceDocxFilename: document.filename,
        byteLength: pdfBuffer.byteLength,
        sourceDocxByteLength,
        contentType: PDF_CONTENT_TYPE,
        sourceDocxContentType: DOCX_CONTENT_TYPE,
        workingDocumentDriveItemId: shouldUseWorkingDocument ? workingDocumentDriveItemId : null,
        sourceTemplateContract: {
          usesStoredDbDocx:
            clean((document as any).repositorySource) === "barsh-matters-db" &&
            clean((document as any).storageKind) === "db-docx-base64" &&
            Boolean((document as any).hasStoredDocx),
          repositorySource: clean((document as any).repositorySource),
          repositoryStatus: clean((document as any).repositoryStatus),
          storageKind: clean((document as any).storageKind),
          storedTemplateVersionId: clean((document as any).storedTemplateVersionId),
          storedTemplateVersionNumber: (document as any).storedTemplateVersionNumber || null,
          sourceEndpoint: clean((document as any).sourceEndpoint),
        },
        pdfFinalization: {
          provider: "microsoft_graph_driveitem_content_format_pdf",
          source: shouldUseWorkingDocument ? "working-docx-drive-item" : "generated-docx",
          sourceDriveItemId: pdfConversion?.sourceDriveItemId || null,
          pdfContentType: pdfConversion?.pdfContentType || PDF_CONTENT_TYPE,
          pdfByteLength: pdfConversion?.pdfByteLength || pdfBuffer.byteLength,
        },
        clioUploadParent: {
          type: uploadRewiredToSingleMasterFolder ? "Folder" : "Matter",
          id: uploadRewiredToSingleMasterFolder ? Number(singleMasterUploadFolderId) : matterId,
        },
        clioDocumentId: result.documentId,
        clioDocumentName: result.documentName,
        clioDocumentVersionUuid: result.documentVersionUuid,
        fullyUploaded: result.fullyUploaded,
      });
    }

    const finalizedAt = new Date().toISOString();
    const finalizationRecord = await recordDocumentFinalizationAttempt({
      masterLawsuitId: effectiveMasterLawsuitId,
      matterId,
      preview,
      status: "uploaded-to-clio",
      requestedKeys,
      uploaded,
      skipped,
      allowDuplicateUploads,
      noUploadPerformed: false,
    });

    return NextResponse.json({
      ok: true,
      action: "finalize-upload",
      masterLawsuitId: effectiveMasterLawsuitId,
      finalizedAt,
      clioUploadTarget: uploadRewiredToSingleMasterFolder
        ? {
            ...(preview.clioUploadTarget || {}),
            parentType: "Folder",
            parentId: Number(singleMasterUploadFolderId),
            folderResolution: singleMasterFolderResolution,
          }
        : preview.clioUploadTarget,
      uploadRewired: uploadRewiredToSingleMasterFolder,
      folderResolution: uploadRewiredToSingleMasterFolder ? singleMasterFolderResolution : null,
      uploaded,
      skipped,
      finalizationRecord,
      safety: {
        explicitUploadAction: true,
        duplicatePreventionDefault: !allowDuplicateUploads,
        duplicateUploadsAllowed: allowDuplicateUploads,
        previewAndDownloadRemainNonPersistent: true,
        databaseAuditRecordAttempted: true,
        databaseAuditRecordCreated: finalizationRecord.ok,
        databaseAuditLayerOnly: true,
        clioDocumentsTabRemainsSourceOfTruth: true,
        noOneDriveOrSharePointFoldersCreated: true,
        uploadedOnlyToRequestedClioMatterDocumentsTab: !uploadRewiredToSingleMasterFolder,
        uploadedToResolvedSingleMasterFolder: uploadRewiredToSingleMasterFolder,
        finalDeliveryFormat: "pdf",
        sourceWorkingFormat: "docx",
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        action: "finalize-upload",
        error: err?.message || "Finalize upload failed.",
        uploaded,
        skipped,
        safety: {
          explicitUploadAction: true,
          noDatabaseRecordsChanged: true,
          noOneDriveOrSharePointFoldersCreated: true,
          warning:
            uploaded.length > 0
              ? "One or more documents may already have been uploaded before the failure."
              : "No upload was confirmed before the failure.",
        },
      },
      { status: 500 }
    );
  }
}
