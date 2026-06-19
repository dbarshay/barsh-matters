import { buildClioStorageFolderResolutionPreview } from "./clioStorageFolderResolution";
import type { ClioStorageTargetInput } from "./clioStoragePlan";

export type ClioSingleMasterUploadTargetPreview = {
  mode: "single_master_matter";
  previewOnly: true;
  uploadRewired: false;
  createsFolders: false;
  callsClio: false;
  uploadsDocuments: false;
  masterMatterId: number;
  masterMatterName: string;
  bucketFolderName: string;
  matterFolderName: string;
  matterFolderPath: string;
  plannedUploadTarget: {
    type: "future-clio-folder";
    masterMatterId: number;
    folderPath: string;
  };
  safety: {
    noExistingRoutesRewired: true;
    noClioCalls: true;
    noFolderCreation: true;
    noDocumentUploads: true;
    noDatabaseMutation: true;
  };
};

export function buildClioSingleMasterUploadTargetPreview(input: ClioStorageTargetInput): ClioSingleMasterUploadTargetPreview {
  const preview = buildClioStorageFolderResolutionPreview(input);
  const plan = preview.targetPlan;

  return {
    mode: "single_master_matter",
    previewOnly: true,
    uploadRewired: false,
    createsFolders: false,
    callsClio: false,
    uploadsDocuments: false,
    masterMatterId: plan.masterMatterId,
    masterMatterName: plan.masterMatterName,
    bucketFolderName: plan.bucketFolderName,
    matterFolderName: plan.matterFolderName,
    matterFolderPath: plan.matterFolderPath,
    plannedUploadTarget: {
      type: "future-clio-folder",
      masterMatterId: plan.masterMatterId,
      folderPath: plan.matterFolderPath,
    },
    safety: {
      noExistingRoutesRewired: true,
      noClioCalls: true,
      noFolderCreation: true,
      noDocumentUploads: true,
      noDatabaseMutation: true,
    },
  };
}
