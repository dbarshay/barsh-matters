import { buildClioStorageFolderResolutionPreview } from "./clioStorageFolderResolution";
import { createClioFolderWithGuard } from "./clioFolderCreateExecutor";
import type { ClioStorageTargetInput } from "./clioStoragePlan";

export type ClioFolderResolverExecutorResult = {
  ok: true;
  masterMatterId: number;
  bucketFolderName: string;
  matterFolderName: string;
  matterFolderPath: string;
  bucketFolder: { id: number | string; name: string };
  matterFolder: { id: number | string; name: string };
};

export async function resolveClioMatterFolderWithGuard(input: ClioStorageTargetInput, env: NodeJS.ProcessEnv = process.env): Promise<ClioFolderResolverExecutorResult> {
  const preview = buildClioStorageFolderResolutionPreview(input);
  const target = preview.targetPlan;

  const bucketFolder = await createClioFolderWithGuard({
    matterId: target.masterMatterId,
    folderName: target.bucketFolderName,
    parentId: null,
  }, env);

  const matterFolder = await createClioFolderWithGuard({
    matterId: target.masterMatterId,
    folderName: target.matterFolderName,
    parentId: Number(bucketFolder.id),
  }, env);

  return {
    ok: true,
    masterMatterId: target.masterMatterId,
    bucketFolderName: target.bucketFolderName,
    matterFolderName: target.matterFolderName,
    matterFolderPath: target.matterFolderPath,
    bucketFolder: { id: bucketFolder.id, name: bucketFolder.name },
    matterFolder: { id: matterFolder.id, name: matterFolder.name },
  };
}
