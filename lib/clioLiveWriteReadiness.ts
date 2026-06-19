export type ClioLiveWriteReadiness = {
  ready: boolean;
  reason: string;
  requiresExplicitUserCommand: true;
  requiresCleanMasterInventory: true;
  requiresWriteGuardEnabled: true;
  requiresNoFinalizeRewire: true;
  allowedCommandPhrase: "RUN_CLIO_SINGLE_MASTER_FOLDER_CREATE";
};

export function getClioLiveWriteReadiness(env: NodeJS.ProcessEnv = process.env): ClioLiveWriteReadiness {
  const explicit = String(env.CLIO_SINGLE_MASTER_LIVE_WRITE_COMMAND ?? "").trim() === "RUN_CLIO_SINGLE_MASTER_FOLDER_CREATE";
  const createFolders = String(env.CLIO_SINGLE_MASTER_CREATE_FOLDERS_ENABLED ?? "").trim() === "1";
  const liveWrite = String(env.CLIO_SINGLE_MASTER_LIVE_WRITE_ENABLED ?? "").trim() === "1";

  const ready = Boolean(explicit && createFolders && liveWrite);

  return {
    ready,
    reason: ready
      ? "Live folder creation readiness gate passed for a later explicitly commanded operational phase."
      : "Live folder creation is blocked unless explicit command phrase and both write flags are present.",
    requiresExplicitUserCommand: true,
    requiresCleanMasterInventory: true,
    requiresWriteGuardEnabled: true,
    requiresNoFinalizeRewire: true,
    allowedCommandPhrase: "RUN_CLIO_SINGLE_MASTER_FOLDER_CREATE",
  };
}
