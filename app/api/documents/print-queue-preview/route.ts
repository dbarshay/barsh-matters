import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  findExistingClioDocumentsByFilename,
  listClioMatterDocuments,
  type ClioMatterDocument,
} from "@/lib/clioDocumentUpload";

export const runtime = "nodejs";

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function toJsonSafe(value: unknown): any {
  if (value == null) return null;

  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return null;
  }
}

function asArray(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

function positiveInt(value: unknown, fallback: number, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.min(max, Math.floor(n)));
}

function numberOrNull(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function buildLocalAuditCandidateDocuments(row: any) {
  const uploaded = asArray(toJsonSafe(row.uploaded));

  return uploaded
    .filter((doc) => clean(doc?.filename))
    .map((doc) => ({
      key: clean(doc.key),
      label: clean(doc.label),
      filename: clean(doc.filename),
      byteLength: Number.isFinite(Number(doc.byteLength))
        ? Number(doc.byteLength)
        : null,
      clioDocumentId: clean(doc.clioDocumentId),
      clioDocumentName: clean(doc.clioDocumentName),
      clioDocumentVersionUuid: clean(doc.clioDocumentVersionUuid),
      fullyUploaded: doc.fullyUploaded === true,
      printCandidateReason:
        "Document appears in local DocumentFinalization uploaded[] audit data and was verified against the current Clio repository storage Documents tab.",
      localAuditOnly: false,
      currentClioExistenceVerified: false,
      currentClioExistenceMatch: null,
      currentClioExistenceReason: "Not checked yet.",
    }));
}

function normalizeClioDocumentMatch(document: ClioMatterDocument) {
  return {
    id: document.id,
    name: document.name,
    filename: document.filename,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
    latestDocumentVersion: document.latestDocumentVersion,
  };
}

function findCurrentClioMatch(
  existingDocuments: ClioMatterDocument[],
  candidate: any
): ClioMatterDocument | null {
  const wantedId = numberOrNull(candidate?.clioDocumentId);
  const wantedUuid = clean(candidate?.clioDocumentVersionUuid).toLowerCase();

  if (wantedId) {
    const byId = existingDocuments.find((document) => Number(document?.id) === wantedId);
    if (byId) return byId;
  }

  if (wantedUuid) {
    const byUuid = existingDocuments.find(
      (document) =>
        clean(document?.latestDocumentVersion?.uuid).toLowerCase() === wantedUuid
    );
    if (byUuid) return byUuid;
  }

  const filenameMatches = findExistingClioDocumentsByFilename(
    existingDocuments,
    candidate?.filename
  );

  return filenameMatches[0] || null;
}

function buildClioDocumentOpenUrl(req: NextRequest, documentId: unknown, filename?: unknown): string {
  const cleanDocumentId = clean(documentId);
  if (!cleanDocumentId) return "";

  const url = new URL("/api/documents/clio-document-open", req.nextUrl.origin);
  url.searchParams.set("documentId", cleanDocumentId);

  const cleanFilename = clean(filename);
  if (cleanFilename) url.searchParams.set("filename", cleanFilename);

  return url.toString();
}

async function verifyCandidatesAgainstCurrentClioDocuments(finalizations: any[]) {
  const documentsByMatterId = new Map<number, ClioMatterDocument[]>();
  const verificationErrors: any[] = [];

  for (const finalization of finalizations) {
    const matterId = Number(finalization.masterMatterId);

    if (!Number.isFinite(matterId) || matterId <= 0) {
      verificationErrors.push({
        finalizationId: finalization.finalizationId,
        masterMatterId: finalization.masterMatterId,
        error: "Missing valid master matter ID for current Clio document verification.",
      });
      continue;
    }

    if (documentsByMatterId.has(matterId)) continue;

    try {
      const documents = await listClioMatterDocuments(matterId);
      documentsByMatterId.set(matterId, documents);
    } catch (err: any) {
      verificationErrors.push({
        finalizationId: finalization.finalizationId,
        masterMatterId: matterId,
        error: err?.message || "Could not verify current Clio documents.",
      });
      documentsByMatterId.set(matterId, []);
    }
  }

  const verifiedFinalizations = finalizations.map((finalization) => {
    const matterId = Number(finalization.masterMatterId);
    const currentDocuments = documentsByMatterId.get(matterId) || [];

    const uploadedDocuments = finalization.uploadedDocuments.map((candidate: any) => {
      const match = findCurrentClioMatch(currentDocuments, candidate);

      if (!match) {
        return {
          ...candidate,
          currentClioExistenceVerified: false,
          currentClioExistenceMatch: null,
          currentClioExistenceReason:
            "No current matching document was found in the Clio repository storage Documents tab.",
        };
      }

      return {
        ...candidate,
        currentClioExistenceVerified: true,
        currentClioExistenceMatch: normalizeClioDocumentMatch(match),
        currentClioExistenceReason:
          "A current matching document was found in the Clio repository storage Documents tab.",
      };
    });

    return {
      ...finalization,
      uploadedDocuments,
      uploadedDocumentCount: uploadedDocuments.length,
      verifiedUploadedDocumentCount: uploadedDocuments.filter(
        (document: any) => document.currentClioExistenceVerified
      ).length,
      currentClioExistenceVerified: true,
    };
  });

  return {
    finalizations: verifiedFinalizations,
    verificationErrors,
    matterDocumentLookupCount: documentsByMatterId.size,
  };
}

export async function GET(req: NextRequest) {
  try {
    const limit = positiveInt(req.nextUrl.searchParams.get("limit"), 25, 100);
    const masterLawsuitId = clean(req.nextUrl.searchParams.get("masterLawsuitId"));

    const rows = await prisma.documentFinalization.findMany({
      where: {
        ...(masterLawsuitId ? { masterLawsuitId } : {}),
        status: "uploaded-to-clio",
        noUploadPerformed: false,
      },
      orderBy: { finalizedAt: "desc" },
      take: limit,
    });

    const localAuditFinalizations = rows
      .map((row) => {
        const uploadedDocuments = buildLocalAuditCandidateDocuments(row);

        return {
          finalizationId: row.id,
          masterLawsuitId: row.masterLawsuitId,
          masterMatterId: row.masterMatterId,
          masterDisplayNumber: row.masterDisplayNumber,
          status: row.status,
          finalizedAt: row.finalizedAt.toISOString(),
          requestedKeys: toJsonSafe(row.requestedKeys),
          uploadedDocumentCount: uploadedDocuments.length,
          verifiedUploadedDocumentCount: 0,
          uploadedDocuments,
          skipped: toJsonSafe(row.skipped),
          clioUploadTarget: toJsonSafe(row.clioUploadTarget),
          packetSummarySnapshot: toJsonSafe(row.packetSummarySnapshot),
          validationSnapshot: toJsonSafe(row.validationSnapshot),
          localAuditOnly: false,
          currentClioExistenceVerified: false,
        };
      })
      .filter((row) => row.uploadedDocumentCount > 0);

    const verification = await verifyCandidatesAgainstCurrentClioDocuments(
      localAuditFinalizations
    );

    const finalizations = verification.finalizations
      .map((row) => ({
        ...row,
        uploadedDocuments: row.uploadedDocuments.filter(
          (doc: any) => doc.currentClioExistenceVerified
        ),
      }))
      .filter((row) => row.uploadedDocuments.length > 0)
      .map((row) => ({
        ...row,
        uploadedDocumentCount: row.uploadedDocuments.length,
        verifiedUploadedDocumentCount: row.uploadedDocuments.length,
      }));

    const candidateDocuments = finalizations.flatMap((row) =>
      row.uploadedDocuments.map((doc: any) => {
        const documentUrl = buildClioDocumentOpenUrl(
          req,
          doc.clioDocumentId,
          doc.filename || doc.clioDocumentName || doc.label || doc.key
        );

        return {
          finalizationId: row.finalizationId,
          masterLawsuitId: row.masterLawsuitId,
          masterMatterId: row.masterMatterId,
          masterDisplayNumber: row.masterDisplayNumber,
          finalizedAt: row.finalizedAt,
          ...doc,
          documentUrl,
          downloadUrl: documentUrl,
        };
      })
    );

    const localAuditCandidateDocuments = verification.finalizations.flatMap((row) =>
      row.uploadedDocuments.map((doc: any) => ({
        finalizationId: row.finalizationId,
        masterLawsuitId: row.masterLawsuitId,
        masterMatterId: row.masterMatterId,
        masterDisplayNumber: row.masterDisplayNumber,
        finalizedAt: row.finalizedAt,
        ...doc,
      }))
    );

    const excludedUnverifiedDocuments = localAuditCandidateDocuments.filter(
      (doc: any) => !doc.currentClioExistenceVerified
    );

    return NextResponse.json({
      ok: true,
      action: "print-queue-preview",
      generatedAt: new Date().toISOString(),
      masterLawsuitId: masterLawsuitId || null,
      localAuditFinalizationCount: localAuditFinalizations.length,
      localAuditCandidateDocumentCount: localAuditCandidateDocuments.length,
      finalizationCount: finalizations.length,
      candidateDocumentCount: candidateDocuments.length,
      finalizations,
      candidateDocuments,
      excludedUnverifiedDocumentCount: excludedUnverifiedDocuments.length,
      excludedUnverifiedDocuments,
      verification: {
        currentClioExistenceVerified: true,
        sourceOfTruth: "Clio repository storage Documents tab",
        matterDocumentLookupCount: verification.matterDocumentLookupCount,
        verificationErrorCount: verification.verificationErrors.length,
        verificationErrors: verification.verificationErrors,
      },
      safety: {
        readOnly: true,
        previewOnly: true,
        localAuditHistoryOnly: false,
        currentClioExistenceVerified: true,
        clioDocumentsTabRemainsSourceOfTruth: true,
        noClioRecordsChanged: true,
        noDatabaseRecordsChanged: true,
        noPrintQueueRecordsCreated: true,
        noOneDriveOrSharePointFoldersCreated: true,
      },
      note:
        "This endpoint proposes print candidates from local DocumentFinalization audit records only after verifying that each candidate still has a matching current document in the Clio repository storage Documents tab.  It does not create print records or change Clio.",
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        action: "print-queue-preview",
        error: err?.message || "Could not load print queue preview.",
        safety: {
          readOnly: true,
          previewOnly: true,
          noClioRecordsChanged: true,
          noDatabaseRecordsChanged: true,
          noPrintQueueRecordsCreated: true,
          noOneDriveOrSharePointFoldersCreated: true,
        },
      },
      { status: 500 }
    );
  }
}
