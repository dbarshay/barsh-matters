import { createClioFolderWithGuard } from "./clioFolderCreateExecutor";
import { buildClioStorageTargetPlan, type ClioStorageTargetInput } from "./clioStoragePlan";

export type ClioResolvedFolderSegment = {
  name: string;
  id: number;
  parentId: number | null;
  created: boolean;
};

export type ClioFolderResolverExecutorResult = {
  ok: true;
  targetPlan: ReturnType<typeof buildClioStorageTargetPlan>;
  bucketFolderId: number;
  matterFolderId: number;
  folderId: number;
  folderSegments: ClioResolvedFolderSegment[];
  createdFolderCount: number;
  reusedFolderCount: number;
};

function getResolvedFolderId(result: unknown): number {
  const value = result as any;
  const raw =
    value?.folderId ??
    value?.id ??
    value?.folder?.id ??
    value?.folder?.data?.id ??
    value?.data?.id ??
    value?.result?.folderId ??
    value?.result?.folder?.id;

  const folderId = Number(raw);

  if (!Number.isFinite(folderId) || folderId <= 0) {
    throw new Error("Guarded Clio folder creation did not return a valid folder id.");
  }

  return folderId;
}

function getResolvedCreatedFlag(result: unknown): boolean {
  const value = result as any;
  return Boolean(
    value?.created ??
      value?.wasCreated ??
      value?.createdFolder ??
      value?.folderCreated ??
      value?.result?.created ??
      false
  );
}

export async function resolveClioMatterFolderWithGuard(
  input: ClioStorageTargetInput,
  env: NodeJS.ProcessEnv = process.env
): Promise<ClioFolderResolverExecutorResult> {
  const target = buildClioStorageTargetPlan(input);
  const configuredSegments = Array.isArray(target.folderSegments) && target.folderSegments.length
    ? target.folderSegments
    : [target.bucketFolderName, target.matterFolderName];

  const configuredRootFolderId = Number(env.CLIO_SINGLE_MASTER_ROOT_FOLDER_ID || env.CLIO_DOCUMENTS_ROOT_FOLDER_ID || 0);

  if (!Number.isFinite(configuredRootFolderId) || configuredRootFolderId <= 0) {
    throw new Error("[CLIO_STORAGE] Missing or invalid CLIO_SINGLE_MASTER_ROOT_FOLDER_ID for single-master folder resolution.");
  }

  const folderSegments: ClioResolvedFolderSegment[] = [];
  let parentId: number | null = configuredRootFolderId;

  for (const segmentName of configuredSegments) {
    const resolved = await createClioFolderWithGuard({
      matterId: target.masterMatterId,
      parentId,
      folderName: segmentName,
    }, env);

    const folderId = getResolvedFolderId(resolved);
    const created = getResolvedCreatedFlag(resolved);

    folderSegments.push({
      name: segmentName,
      id: folderId,
      parentId,
      created,
    });

    parentId = folderId;
  }

  const finalFolder = folderSegments[folderSegments.length - 1];

  if (!finalFolder) {
    throw new Error("Clio folder resolver did not resolve any folder segments.");
  }

  return {
    ok: true,
    targetPlan: target,
    bucketFolderId: folderSegments[0]?.id ?? finalFolder.id,
    matterFolderId: finalFolder.id,
    folderId: finalFolder.id,
    folderSegments,
    createdFolderCount: folderSegments.filter((segment) => segment.created).length,
    reusedFolderCount: folderSegments.filter((segment) => !segment.created).length,
  };
}
