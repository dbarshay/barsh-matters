import { getClioStorageConfig, type ClioStorageConfig } from "./clioStorageConfig";

export type ClioStorageTargetInput = {
  bmMatterId?: string | number | null;
  lawsuitId?: string | number | null;
  masterLawsuitId?: string | number | null;
  displayNumber?: string | number | null;
  matterDisplayNumber?: string | number | null;
  directMatterFileNumber?: string | number | null;
  storageTargetKind?: "lawsuit" | "individual_matter" | "direct_matter" | null;
  label?: string | number | null;
};

export type ClioStorageTargetPlan = {
  mode: "single_master_matter";
  masterMatterId: number;
  masterMatterName: string;
  bucketSize: number;
  storageTargetKind: "lawsuit" | "individual_matter";
  rootFolderName: string;
  groupFolderName: string;
  finalFolderName: string;
  folderSegments: string[];
  matterOrdinal: number;
  bucketIndex: number;
  bucketStart: number;
  bucketEnd: number;
  bucketFolderName: string;
  matterFolderName: string;
  matterFolderPath: string;
};

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function safeFolderPart(value: unknown, fallback: string): string {
  const cleaned = clean(value)
    .replace(/[\/\\:*?"<>|#%{}~&]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  return (cleaned || fallback).slice(0, 140);
}

function firstPositiveInteger(value: unknown): number | null {
  const raw = clean(value);
  if (!raw) return null;
  const exact = Number(raw);
  if (Number.isInteger(exact) && exact > 0) return exact;
  const match = raw.match(/\d+/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function pad(value: number): string {
  return String(value).padStart(6, "0");
}

export function getMatterOrdinal(input: ClioStorageTargetInput): number {
  const fromMatterId = firstPositiveInteger(input.bmMatterId);
  if (fromMatterId) return fromMatterId;
  const fromDisplayNumber = firstPositiveInteger(input.displayNumber);
  if (fromDisplayNumber) return fromDisplayNumber;
  const fromLawsuitId = firstPositiveInteger(input.lawsuitId);
  if (fromLawsuitId) return fromLawsuitId;
  throw new Error("[CLIO_STORAGE] Cannot compute storage bucket without a numeric BM matter/lawsuit identifier.");
}

export function getBucketRange(matterOrdinal: number, bucketSize: number): { bucketIndex: number; bucketStart: number; bucketEnd: number } {
  if (!Number.isInteger(matterOrdinal) || matterOrdinal <= 0) throw new Error("[CLIO_STORAGE] matterOrdinal must be a positive integer.");
  if (!Number.isInteger(bucketSize) || bucketSize <= 0) throw new Error("[CLIO_STORAGE] bucketSize must be a positive integer.");
  const bucketIndex = Math.floor((matterOrdinal - 1) / bucketSize) + 1;
  const bucketStart = (bucketIndex - 1) * bucketSize + 1;
  const bucketEnd = bucketIndex * bucketSize;
  return { bucketIndex, bucketStart, bucketEnd };
}

function getMatterYearMonth(input: ClioStorageTargetInput): { year: string; month: string } {
  const source = clean(input.displayNumber) || clean(input.bmMatterId) || clean(input.lawsuitId);
  const match = source.match(/(20\d{2})[.-](\d{2})[.-]\d+/);
  if (match) return { year: match[1], month: match[2] };
  return { year: "undated", month: "unknown" };
}

function getTargetKind(input: ClioStorageTargetInput): "lawsuit" | "individual_matter" {
  const explicit = clean(input.storageTargetKind);
  if (explicit === "individual_matter" || explicit === "direct_matter") return "individual_matter";
  if (explicit === "lawsuit") return "lawsuit";

  const candidates = [
    input.directMatterFileNumber,
    input.bmMatterId,
    input.displayNumber,
    input.matterDisplayNumber,
    input.lawsuitId,
    input.masterLawsuitId,
  ].map(clean).filter(Boolean);

  if (candidates.some((value) => /^BRL_\d{9}$/.test(value))) return "individual_matter";
  return "lawsuit";
}

function getLawsuitNumber(input: ClioStorageTargetInput): string {
  const candidates = [
    input.lawsuitId,
    input.masterLawsuitId,
    input.displayNumber,
    input.matterDisplayNumber,
    input.bmMatterId,
  ].map(clean).filter(Boolean);

  const lawsuitNumber =
    candidates.find((value) => /^\d{4}\.\d{2}\.\d{5}$/.test(value)) ||
    clean(input.lawsuitId || input.masterLawsuitId || input.displayNumber || input.bmMatterId);

  if (!lawsuitNumber) {
    throw new Error("Clio storage lawsuit target requires a Barsh Matters lawsuit number.");
  }

  return lawsuitNumber;
}

function getIndividualMatterFileNumber(input: ClioStorageTargetInput): string {
  const candidates = [
    input.directMatterFileNumber,
    input.bmMatterId,
    input.displayNumber,
    input.matterDisplayNumber,
  ].map(clean).filter(Boolean);

  const fileNumber = candidates.find((value) => /^BRL_\d{9}$/.test(value));

  if (!fileNumber) {
    throw new Error("Clio storage individual matter target requires a Barsh Matters direct matter file number in BRL_YYYYNNNNN format.");
  }

  return fileNumber;
}

export function buildLawsuitGroupFolderName(input: ClioStorageTargetInput): string {
  const lawsuitNumber = getLawsuitNumber(input);
  const match = lawsuitNumber.match(/^(\d{4})\.(\d{2})\.\d{5}$/);
  if (!match) return "Undated Lawsuits";
  return `${match[1]}-${match[2]}`;
}

export function buildIndividualMatterRangeFolderName(input: ClioStorageTargetInput): string {
  const fileNumber = getIndividualMatterFileNumber(input);
  const match = fileNumber.match(/^BRL_(\d{4})(\d{5})$/);
  if (!match) {
    throw new Error("Barsh Matters direct matter file number must use BRL_YYYYNNNNN format.");
  }
  const year = match[1];
  const sequence = Number(match[2]);
  if (!Number.isFinite(sequence) || sequence <= 0) {
    throw new Error("Barsh Matters direct matter file number sequence must be positive.");
  }
  const rangeStart = Math.floor((sequence - 1) / 999) * 999 + 1;
  const rangeEnd = rangeStart + 998;
  return `BRL-${year}${String(rangeStart).padStart(5, "0")}-BRL-${year}${String(rangeEnd).padStart(5, "0")}`;
}

export function buildRootFolderName(input: ClioStorageTargetInput): string {
  return getTargetKind(input) === "individual_matter" ? "Individual Matters" : "Lawsuits";
}

export function buildGroupFolderName(input: ClioStorageTargetInput): string {
  return getTargetKind(input) === "individual_matter"
    ? buildIndividualMatterRangeFolderName(input)
    : buildLawsuitGroupFolderName(input);
}

export function buildBucketFolderName(input: ClioStorageTargetInput): string {
  return buildRootFolderName(input);
}

export function buildMatterFolderName(input: ClioStorageTargetInput): string {
  return getTargetKind(input) === "individual_matter"
    ? getIndividualMatterFileNumber(input)
    : getLawsuitNumber(input);
}

export function buildClioStorageTargetPlan(input: ClioStorageTargetInput, config: ClioStorageConfig = getClioStorageConfig()): ClioStorageTargetPlan {
  if (!config.singleMasterEnabled || config.mode !== "single_master_matter") {
    throw new Error("Single-master storage mode is not enabled.");
  }

  const storageTargetKind = getTargetKind(input);
  const matterOrdinal = getMatterOrdinal(input);
  const bucketIndex = Math.floor((matterOrdinal - 1) / config.bucketSize) + 1;
  const bucketStart = (bucketIndex - 1) * config.bucketSize + 1;
  const bucketEnd = bucketIndex * config.bucketSize;
  const rootFolderName = buildRootFolderName(input);
  const groupFolderName = buildGroupFolderName(input);
  const finalFolderName = buildMatterFolderName(input);
  const folderSegments = [rootFolderName, groupFolderName, finalFolderName];
  const matterFolderPath = folderSegments.join("/");
  const masterMatterId = Number(config.masterMatterId);

  if (!Number.isFinite(masterMatterId) || masterMatterId <= 0) {
    throw new Error("Single-master storage mode requires a valid configured Clio master matter ID.");
  }

  return {
    mode: "single_master_matter",
    masterMatterId,
    masterMatterName: config.masterMatterName,
    bucketSize: config.bucketSize,
    storageTargetKind,
    rootFolderName,
    groupFolderName,
    finalFolderName,
    folderSegments,
    matterOrdinal,
    bucketIndex,
    bucketStart,
    bucketEnd,
    bucketFolderName: rootFolderName,
    matterFolderName: finalFolderName,
    matterFolderPath,
  };
}
