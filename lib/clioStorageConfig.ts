export type ClioStorageMode = "legacy_per_matter" | "single_master_matter";

export type ClioStorageConfig = {
  mode: ClioStorageMode;
  singleMasterEnabled: boolean;
  masterMatterId: number | null;
  masterMatterName: string;
  bucketSize: number;
};

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function positiveIntegerOrNull(value: unknown): number | null {
  const raw = clean(value);
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function positiveIntegerOrDefault(value: unknown, fallback: number): number {
  return positiveIntegerOrNull(value) ?? fallback;
}

function requirePositiveInteger(name: string, value: unknown): number {
  const parsed = positiveIntegerOrNull(value);
  if (!parsed) throw new Error(`[CLIO_STORAGE] Missing or invalid positive integer: ${name}`);
  return parsed;
}

function requireText(name: string, value: unknown): string {
  const parsed = clean(value);
  if (!parsed) throw new Error(`[CLIO_STORAGE] Missing: ${name}`);
  return parsed;
}

export function getClioStorageConfig(env: NodeJS.ProcessEnv = process.env): ClioStorageConfig {
  const modeRaw = clean(env.CLIO_STORAGE_MODE);
  const mode: ClioStorageMode = modeRaw === "single_master_matter" ? "single_master_matter" : "legacy_per_matter";
  const bucketSize = positiveIntegerOrDefault(env.CLIO_BUCKET_SIZE, 1000);

  if (mode !== "single_master_matter") {
    return {
      mode,
      singleMasterEnabled: false,
      masterMatterId: null,
      masterMatterName: "",
      bucketSize,
    };
  }

  return {
    mode,
    singleMasterEnabled: true,
    masterMatterId: requirePositiveInteger("CLIO_MASTER_MATTER_ID", env.CLIO_MASTER_MATTER_ID),
    masterMatterName: requireText("CLIO_MASTER_MATTER_NAME", env.CLIO_MASTER_MATTER_NAME),
    bucketSize,
  };
}

export function assertSingleMasterClioStorageConfig(env: NodeJS.ProcessEnv = process.env): ClioStorageConfig {
  const config = getClioStorageConfig(env);
  if (config.mode !== "single_master_matter" || !config.singleMasterEnabled) {
    throw new Error("[CLIO_STORAGE] CLIO_STORAGE_MODE must be single_master_matter for the storage refactor path.");
  }
  return config;
}
