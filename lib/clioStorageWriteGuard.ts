export type ClioStorageWriteGuardDecision = {
  allowed: boolean;
  reason: string;
  createFoldersEnabled: boolean;
  uploadRewireEnabled: boolean;
  liveClioWriteEnabled: boolean;
  safety: {
    noClioCallsMadeByGuard: true;
    noFoldersCreatedByGuard: true;
    noDocumentsUploadedByGuard: true;
    noDatabaseMutationByGuard: true;
  };
};

function enabled(value: unknown): boolean {
  return String(value ?? "").trim() === "1";
}

export function getClioStorageWriteGuard(env: NodeJS.ProcessEnv = process.env): ClioStorageWriteGuardDecision {
  const createFoldersEnabled = enabled(env.CLIO_SINGLE_MASTER_CREATE_FOLDERS_ENABLED);
  const uploadRewireEnabled = enabled(env.CLIO_SINGLE_MASTER_UPLOAD_REWIRE_ENABLED);
  const liveClioWriteEnabled = enabled(env.CLIO_SINGLE_MASTER_LIVE_WRITE_ENABLED);

  const allowed = Boolean(createFoldersEnabled && liveClioWriteEnabled);

  return {
    allowed,
    reason: allowed
      ? "Folder creation may proceed only in a later operational phase that also performs live preflight checks."
      : "Clio folder writes are disabled unless CLIO_SINGLE_MASTER_CREATE_FOLDERS_ENABLED=1 and CLIO_SINGLE_MASTER_LIVE_WRITE_ENABLED=1.",
    createFoldersEnabled,
    uploadRewireEnabled,
    liveClioWriteEnabled,
    safety: {
      noClioCallsMadeByGuard: true,
      noFoldersCreatedByGuard: true,
      noDocumentsUploadedByGuard: true,
      noDatabaseMutationByGuard: true,
    },
  };
}

export function assertClioStorageFolderWriteAllowed(env: NodeJS.ProcessEnv = process.env): ClioStorageWriteGuardDecision {
  const decision = getClioStorageWriteGuard(env);
  if (!decision.allowed) throw new Error(`[CLIO_STORAGE] ${decision.reason}`);
  return decision;
}
