import { prisma } from "@/lib/prisma";

// Individual matter numbering — mirrors lib/buildMasterId.ts (lawsuit numbering) but for matters.
//
// Display number format: BRL_{YYYY}{seq}
//   - `seq` RESETS each calendar year (year-scoped counter).
//   - zero-padded to a MINIMUM width (6 digits) so it holds hundreds of thousands/year, and it
//     GROWS automatically beyond 6 digits if a year ever exceeds 999,999.
//
// Scale: numbers are **batch-allocated** — one atomic counter increment by N returns a contiguous
// block — so importing thousands of rows is a couple of round-trips, never MAX()+1 per row.

const MIN_SEQ_WIDTH = 6;

// New locally-minted matter_id integers start no lower than this floor, AND always above the current
// MAX(ClaimIndex.matter_id) so they never collide with legacy Clio-era matter ids.
const MATTER_ID_FLOOR = 1_000_000;

/** BRL_{year}{seq}, seq zero-padded to a minimum of 6 digits (grows if larger). */
export function formatBrlDisplayNumber(year: number, seq: number): string {
  if (!Number.isInteger(year) || year < 2000) throw new Error("formatBrlDisplayNumber: invalid year.");
  if (!Number.isInteger(seq) || seq < 1) throw new Error("formatBrlDisplayNumber: seq must be a positive integer.");
  return `BRL_${year}${String(seq).padStart(MIN_SEQ_WIDTH, "0")}`;
}

export type AllocatedMatterNumbers = {
  year: number;
  matterIds: number[]; // contiguous block of new integer PKs, ascending
  displayNumbers: string[]; // BRL_{year}{seq}, same order/index as matterIds
  seqStart: number;
  seqEnd: number;
};

/**
 * Batch-allocate `count` new matter numbers atomically.
 *
 * Two counters are advanced inside one transaction (row locks serialize concurrent allocations, so
 * blocks are contiguous with no gaps or duplicates):
 *   1. `MatterSequenceCounter` (per year)  -> the display-number sequence (resets yearly).
 *   2. `MatterIdCounter` (singleton id=1)   -> the integer matter_id PK, kept above MAX existing.
 */
export async function allocateMatterNumbers(
  count: number,
  whenYear?: number
): Promise<AllocatedMatterNumbers> {
  if (!Number.isInteger(count) || count <= 0) {
    throw new Error("allocateMatterNumbers: count must be a positive integer.");
  }
  const year = whenYear ?? new Date().getFullYear();

  return prisma.$transaction(async (tx) => {
    // 1) Year-scoped display sequence — single atomic increment by `count` yields the block.
    const seqCounter = await tx.matterSequenceCounter.upsert({
      where: { year },
      update: { lastSequence: { increment: count } },
      create: { year, lastSequence: count },
    });
    const seqEnd = seqCounter.lastSequence; // last sequence allocated
    const seqStart = seqEnd - count + 1; // first sequence allocated

    // 2) Integer PK — keep the counter above any existing matter_id (incl. legacy Clio ids).
    const maxAgg = await tx.claimIndex.aggregate({ _max: { matter_id: true } });
    const currentMax = maxAgg._max.matter_id ?? 0;
    const idCounter = await tx.matterIdCounter.upsert({
      where: { id: 1 },
      update: {},
      create: { id: 1, lastId: 0 },
    });
    const idBase = Math.max(idCounter.lastId, currentMax, MATTER_ID_FLOOR);
    await tx.matterIdCounter.update({ where: { id: 1 }, data: { lastId: idBase + count } });

    const matterIds: number[] = [];
    const displayNumbers: string[] = [];
    for (let i = 0; i < count; i += 1) {
      matterIds.push(idBase + 1 + i);
      displayNumbers.push(formatBrlDisplayNumber(year, seqStart + i));
    }

    return { year, matterIds, displayNumbers, seqStart, seqEnd };
  });
}
