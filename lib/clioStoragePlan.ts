import { getClioStorageConfig, type ClioStorageConfig } from "./clioStorageConfig";

export type ClioStorageTargetInput = {
  bmMatterId: string | number;
  displayNumber?: string | null;
  lawsuitId?: string | null;
  label?: string | null;
};

export type ClioStorageTargetPlan = {
  mode: "single_master_matter";
  masterMatterId: number;
  masterMatterName: string;
  bucketSize: number;
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

export function buildBucketFolderName(input: ClioStorageTargetInput): string {
  const { year, month } = getMatterYearMonth(input);
  return year === "undated" ? "Undated Matters" : `${year}-${month} Matters`;
}

export function buildMatterFolderName(input: ClioStorageTargetInput, matterOrdinal = getMatterOrdinal(input)): string {
  const displayNumber = safeFolderPart(input.displayNumber || "");
  if (displayNumber) return displayNumber;
  const bmMatterId = safeFolderPart(input.bmMatterId || "");
  if (bmMatterId) return bmMatterId;
  return String(matterOrdinal);
}

export function buildClioStorageTargetPlan(input: ClioStorageTargetInput, config: ClioStorageConfig = getClioStorageConfig()): ClioStorageTargetPlan {
  if (config.mode !== "single_master_matter" || !config.singleMasterEnabled || !config.masterMatterId) {
    throw new Error("[CLIO_STORAGE] Single-master storage mode is not enabled.");
  }

  const matterOrdinal = getMatterOrdinal(input);
  const range = getBucketRange(matterOrdinal, config.bucketSize);
  const bucketFolderName = buildBucketFolderName(input);
  const matterFolderName = buildMatterFolderName(input, matterOrdinal);

  return {
    mode: "single_master_matter",
    masterMatterId: config.masterMatterId,
    masterMatterName: config.masterMatterName,
    bucketSize: config.bucketSize,
    matterOrdinal,
    bucketIndex: range.bucketIndex,
    bucketStart: range.bucketStart,
    bucketEnd: range.bucketEnd,
    bucketFolderName,
    matterFolderName,
    matterFolderPath: `${bucketFolderName}/${matterFolderName}`,
  };
}
