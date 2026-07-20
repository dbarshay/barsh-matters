// Combined "attachable documents" listing for document generation.
//
// Given an individual matter or a lawsuit, this returns the documents a user can attach to a generated
// document: Clio Master Repository documents (the matter's / lawsuit's / each sibling's folder, via the
// shared single-master folder resolution) AND legacy Atlas→Azure documents in their native folder trees.
// Each entry carries enough identity to fetch its bytes later. Per-matter fetches are resilient: a missing
// Clio folder or empty legacy tree yields an empty section with a note rather than failing the whole list.
import { prisma } from "@/lib/prisma";
import { listClioFolderDocuments } from "@/lib/clioDocumentUpload";
import { getLegacyDocTreeForMatter } from "@/lib/legacyDocs";
import { type ClioStorageTargetInput } from "@/lib/clioStoragePlan";
import {
  normalizeClioDocumentRows,
  resolveExistingSingleMasterFolderForDocuments,
  sourceLabel,
} from "@/lib/documents/clioMatterFolderDocuments";

export const LEGACY_MIGRATION_NOTE =
  "Legacy documents come from the Atlas → Azure migration, which is still in progress. A matter's legacy documents may be incomplete until the migration finishes.";

export type AttachableDocument = {
  source: "clio" | "legacy";
  id: string;
  name: string;
  folder: string | null;
  contentType: string | null;
  size: number | null;
  clioDocumentId: string | null;
  clioLatestVersionUuid: string | null;
  legacyFileId: string | null;
};

export type AttachableClioSection = { ok: boolean; documents: AttachableDocument[]; note?: string };
export type AttachableLegacyFolder = { folder: string; files: AttachableDocument[] };
export type AttachableLegacySection = { ok: boolean; folders: AttachableLegacyFolder[]; totalFiles: number; note?: string };

export type AttachableScope = {
  scope: "lawsuit" | "matter";
  label: string;
  matterId: number | null;
  displayNumber: string | null;
  clio: AttachableClioSection;
  legacy: AttachableLegacySection;
};

export type AttachableDocumentsResult = {
  target: "matter" | "lawsuit";
  masterLawsuitId: string | null;
  scopes: AttachableScope[];
  legacyMigrationNote: string;
};

type NormalizedClioRow = ReturnType<typeof normalizeClioDocumentRows>[number];

function toClioAttachable(rows: NormalizedClioRow[]): AttachableDocument[] {
  return rows.map((doc): AttachableDocument => {
    const version = doc.latestDocumentVersion;
    return {
      source: "clio",
      id: `clio:${doc.clioDocumentId}`,
      name: String(doc.clioDocumentName || version?.filename || "Document"),
      folder: null,
      contentType: version?.contentType ?? null,
      size: version?.size ?? null,
      clioDocumentId: doc.clioDocumentId != null ? String(doc.clioDocumentId) : null,
      clioLatestVersionUuid: version?.uuid ?? null,
      legacyFileId: null,
    };
  });
}

async function fetchClioSection(
  targetInput: ClioStorageTargetInput,
  displayForLabel: string,
  role: "lawsuit" | "bill",
  emptyNote: string,
): Promise<AttachableClioSection> {
  try {
    const resolution = await resolveExistingSingleMasterFolderForDocuments(targetInput);
    if (!resolution.ok || !resolution.folderId) {
      return { ok: true, documents: [], note: emptyNote };
    }
    const docs = await listClioFolderDocuments(resolution.folderId);
    const normalized = normalizeClioDocumentRows(docs, {
      clioMatterId: null,
      clioDisplayNumber: displayForLabel,
      sourceRole: role,
      sourceLabel: sourceLabel(displayForLabel, role),
    });
    return { ok: true, documents: toClioAttachable(normalized) };
  } catch (error) {
    return { ok: false, documents: [], note: error instanceof Error ? error.message : "Could not list Clio documents." };
  }
}

async function fetchLegacySection(matterId: number): Promise<AttachableLegacySection> {
  try {
    const tree = await getLegacyDocTreeForMatter(matterId);
    const folders: AttachableLegacyFolder[] = tree.folders.map((folderEntry) => ({
      folder: folderEntry.folder,
      files: folderEntry.files.map((file): AttachableDocument => ({
        source: "legacy",
        id: `legacy:${file.id}`,
        name: file.fileName,
        folder: folderEntry.folder,
        contentType: null,
        size: file.byteSize,
        clioDocumentId: null,
        clioLatestVersionUuid: null,
        legacyFileId: String(file.id),
      })),
    }));
    return { ok: true, folders, totalFiles: tree.totalFiles, note: LEGACY_MIGRATION_NOTE };
  } catch (error) {
    return { ok: false, folders: [], totalFiles: 0, note: error instanceof Error ? error.message : "Could not list legacy documents." };
  }
}

export async function listAttachableDocumentsForMatter(params: {
  matterId: number | null;
  displayNumber: string | null;
  patientName?: string | null;
}): Promise<AttachableScope> {
  const displayNumber = params.displayNumber || null;
  const [clio, legacy] = await Promise.all([
    displayNumber
      ? fetchClioSection(
          { storageTargetKind: "individual_matter", bmMatterId: displayNumber, displayNumber, directMatterFileNumber: displayNumber },
          displayNumber,
          "bill",
          "No Clio repository folder exists for this matter yet.",
        )
      : Promise.resolve<AttachableClioSection>({ ok: true, documents: [] }),
    params.matterId
      ? fetchLegacySection(params.matterId)
      : Promise.resolve<AttachableLegacySection>({ ok: true, folders: [], totalFiles: 0 }),
  ]);

  const label = [displayNumber, params.patientName].filter(Boolean).join(" — ")
    || (params.matterId ? `Matter ${params.matterId}` : "Matter");

  return { scope: "matter", label, matterId: params.matterId ?? null, displayNumber, clio, legacy };
}

export async function listAttachableDocumentsForMatterTarget(params: {
  matterId: number | null;
  displayNumber: string | null;
  patientName?: string | null;
}): Promise<AttachableDocumentsResult> {
  const scope = await listAttachableDocumentsForMatter(params);
  return { target: "matter", masterLawsuitId: null, scopes: [scope], legacyMigrationNote: LEGACY_MIGRATION_NOTE };
}

export async function listAttachableDocumentsForLawsuit(masterLawsuitId: string): Promise<AttachableDocumentsResult> {
  const members = await prisma.claimIndex.findMany({
    where: { master_lawsuit_id: masterLawsuitId },
    orderBy: [{ display_number: "asc" }, { matter_id: "asc" }],
    select: { matter_id: true, display_number: true, patient_name: true },
  });

  const lawsuitClio = await fetchClioSection(
    { storageTargetKind: "lawsuit", lawsuitId: masterLawsuitId, masterLawsuitId, displayNumber: masterLawsuitId },
    masterLawsuitId,
    "lawsuit",
    "No Clio repository folder exists for this lawsuit yet.",
  );

  const lawsuitScope: AttachableScope = {
    scope: "lawsuit",
    label: `Lawsuit ${masterLawsuitId}`,
    matterId: null,
    displayNumber: masterLawsuitId,
    clio: lawsuitClio,
    // The master lawsuit is not a migrated Atlas case, so it has no legacy documents of its own.
    legacy: { ok: true, folders: [], totalFiles: 0 },
  };

  const memberScopes = await Promise.all(
    members.map((member) =>
      listAttachableDocumentsForMatter({
        matterId: member.matter_id,
        displayNumber: member.display_number ?? null,
        patientName: member.patient_name ?? null,
      }),
    ),
  );

  return {
    target: "lawsuit",
    masterLawsuitId,
    scopes: [lawsuitScope, ...memberScopes],
    legacyMigrationNote: LEGACY_MIGRATION_NOTE,
  };
}
