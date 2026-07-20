/* eslint-disable @typescript-eslint/no-explicit-any -- Clio document/folder API rows are loosely typed; extracted verbatim from the clio-matter-documents route to be shared. */
// Shared Clio "single master repository" folder resolution + document-row normalization.
//
// This logic previously lived inline inside app/api/documents/clio-matter-documents/route.ts. It is
// extracted here unchanged so the (new) attachable-documents listing can reuse the exact same folder
// resolution and normalization the existing route uses — one source of truth, no behavior change.
import { findExactClioChildFolderByNameWithGuard } from "@/lib/clioFolderResolverExecutor";
import { buildClioStorageTargetPlan, type ClioStorageTargetInput } from "@/lib/clioStoragePlan";

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function normalizeBrl(value: unknown): string {
  const raw = clean(value).toUpperCase();
  if (!raw) return "";
  if (/^BRL\d+$/.test(raw)) return raw;
  if (/^\d+$/.test(raw)) return `BRL${raw}`;
  return raw;
}

export function normalizeClioDocumentRows(documents: any[], source: {
  clioMatterId: number | null;
  clioDisplayNumber: string;
  sourceRole: "lawsuit" | "bill";
  sourceLabel: string;
}) {
  return documents.map((doc: any) => ({
    clioDocumentId: doc.id,
    clioDocumentName: doc.name,
    clioDocumentFilename: doc.filename,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    sourceClioMatterId: source.clioMatterId,
    sourceClioDisplayNumber: source.clioDisplayNumber,
    sourceRole: source.sourceRole,
    sourceLabel: source.sourceLabel,
    latestDocumentVersion: doc.latestDocumentVersion
      ? {
          id: doc.latestDocumentVersion.id,
          uuid: doc.latestDocumentVersion.uuid,
          filename: doc.latestDocumentVersion.filename,
          size: doc.latestDocumentVersion.size,
          contentType: doc.latestDocumentVersion.contentType,
          fullyUploaded: doc.latestDocumentVersion.fullyUploaded,
          receivedAt: doc.latestDocumentVersion.receivedAt,
          createdAt: doc.latestDocumentVersion.createdAt,
          updatedAt: doc.latestDocumentVersion.updatedAt,
        }
      : null,
  }));
}

export function sourceLabel(displayNumber: string, role: "lawsuit" | "bill") {
  return `${normalizeBrl(displayNumber)}- ${role === "lawsuit" ? "Lawsuit" : "Bill"}`;
}

export async function resolveExistingSingleMasterFolderForDocuments(input: ClioStorageTargetInput) {
  const targetPlan = buildClioStorageTargetPlan(input);
  const rootFolderId = numberOrNull(
    process.env.CLIO_SINGLE_MASTER_ROOT_FOLDER_ID || process.env.CLIO_DOCUMENTS_ROOT_FOLDER_ID
  );

  if (!rootFolderId) {
    throw new Error("[CLIO_STORAGE] Missing or invalid CLIO_SINGLE_MASTER_ROOT_FOLDER_ID for read-only document listing.");
  }

  const configuredSegments =
    Array.isArray(targetPlan.folderSegments) && targetPlan.folderSegments.length
      ? targetPlan.folderSegments
      : [targetPlan.bucketFolderName, targetPlan.matterFolderName];

  const folderSegments: any[] = [];
  let parentId = rootFolderId;

  for (const segmentName of configuredSegments) {
    const folderName = clean(segmentName);
    if (!folderName) {
      throw new Error("[CLIO_STORAGE] Empty folder segment in read-only document listing.");
    }

    const found = await findExactClioChildFolderByNameWithGuard({
      matterId: targetPlan.masterMatterId,
      parentId,
      folderName,
    });

    if (!found?.id) {
      return {
        ok: false as const,
        targetPlan,
        folderId: null,
        folderSegments,
        missingFolderName: folderName,
        missingParentId: parentId,
        createdFolderCount: 0,
        reusedFolderCount: folderSegments.length,
      };
    }

    folderSegments.push(found);
    parentId = Number(found.id);
  }

  const finalFolder = folderSegments[folderSegments.length - 1];

  return {
    ok: true as const,
    targetPlan,
    bucketFolderId: Number(folderSegments[0]?.id || finalFolder?.id || 0),
    matterFolderId: Number(finalFolder?.id || 0),
    folderId: Number(finalFolder?.id || 0),
    folderSegments,
    createdFolderCount: 0,
    reusedFolderCount: folderSegments.length,
  };
}
