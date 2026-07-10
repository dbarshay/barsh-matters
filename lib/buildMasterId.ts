import { prisma } from "@/lib/prisma";

/** Mint a lawsuit master id `YYYY.MM.NNNNN` for an EXPLICIT year/month (month-scoped atomic sequence).
 *  Used by the bulk importer to number legacy lawsuits under their ORIGINAL year (from the 445-PKTYY
 *  number), not the import year. */
export async function buildMasterIdAt(year: number, month: number) {
  const mm = String(month).padStart(2, "0");
  const counter = await prisma.lawsuitSequenceCounter.upsert({
    where: { year_month: { year, month } },
    update: { lastSequence: { increment: 1 } },
    create: { year, month, lastSequence: 1 },
  });
  const seq = String(counter.lastSequence).padStart(5, "0");
  return `${year}.${mm}.${seq}`;
}

export async function buildMasterId() {
  const now = new Date();
  return buildMasterIdAt(now.getFullYear(), now.getMonth() + 1);
}
