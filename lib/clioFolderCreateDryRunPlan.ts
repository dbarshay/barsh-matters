import { buildClioStorageFolderResolutionPreview } from "./clioStorageFolderResolution";
import { getClioStorageWriteGuard } from "./clioStorageWriteGuard";
import type { ClioStorageTargetInput } from "./clioStoragePlan";

export type ClioFolderCreateDryRunRequest = {
  method: "POST";
  endpoint: "/folders.json";
  dryRunOnly: true;
  blockedByDefault: true;
  target: "bucket-folder" | "matter-folder";
  masterMatterId: number;
  parentFolderPath: string | null;
  folderName: string;
  plannedBody: {
    matter_id: number;
    name: string;
    parent_path?: string;
  };
};

export type ClioFolderCreateDryRunPlan = {
  previewOnly: true;
  callsClio: false;
  createsFolders: false;
  uploadsDocuments: false;
  mutatesDatabase: false;
  guardAllowed: boolean;
  guardReason: string;
  bucketRequest: ClioFolderCreateDryRunRequest;
  matterRequest: ClioFolderCreateDryRunRequest;
};

export function buildClioFolderCreateDryRunPlan(input: ClioStorageTargetInput, env: NodeJS.ProcessEnv = process.env): ClioFolderCreateDryRunPlan {
  const preview = buildClioStorageFolderResolutionPreview(input);
  const target = preview.targetPlan;
  const guard = getClioStorageWriteGuard(env);

  const bucketRequest: ClioFolderCreateDryRunRequest = {
    method: "POST",
    endpoint: "/folders.json",
    dryRunOnly: true,
    blockedByDefault: true,
    target: "bucket-folder",
    masterMatterId: target.masterMatterId,
    parentFolderPath: null,
    folderName: target.bucketFolderName,
    plannedBody: {
      matter_id: target.masterMatterId,
      name: target.bucketFolderName,
    },
  };

  const matterRequest: ClioFolderCreateDryRunRequest = {
    method: "POST",
    endpoint: "/folders.json",
    dryRunOnly: true,
    blockedByDefault: true,
    target: "matter-folder",
    masterMatterId: target.masterMatterId,
    parentFolderPath: target.bucketFolderName,
    folderName: target.matterFolderName,
    plannedBody: {
      matter_id: target.masterMatterId,
      name: target.matterFolderName,
      parent_path: target.bucketFolderName,
    },
  };

  return {
    previewOnly: true,
    callsClio: false,
    createsFolders: false,
    uploadsDocuments: false,
    mutatesDatabase: false,
    guardAllowed: guard.allowed,
    guardReason: guard.reason,
    bucketRequest,
    matterRequest,
  };
}
