import { prisma } from "@/lib/prisma";

// Carisk Management Report tracker. "Saved Incomplete" bills (insurer rejected as incomplete) don't
// create a matter — they're parked here, keyed by CIC#, until the same bill later arrives as a
// "Carrier Submission" (which creates the matter and GRADUATES the item off the report). Weekly email
// digests the still-open rows.

export type SavedIncompleteInput = {
  cicNumber: string;
  patientName?: string;
  providerName?: string;
  carrierName?: string;
  dosStart?: string;
  dosEnd?: string;
  claimAmount?: number | null;
  statusDate?: string;
  rejectionDetail?: string;
  batchId?: string;
};

/** Add/keep Saved-Incomplete rows on the report (upsert by CIC#; refresh lastSeen + latest detail). */
export async function upsertSavedIncomplete(items: SavedIncompleteInput[]): Promise<number> {
  let n = 0;
  for (const it of items) {
    const cic = String(it.cicNumber || "").trim();
    if (!cic) continue;
    const data = {
      patientName: it.patientName || null,
      providerName: it.providerName || null,
      carrierName: it.carrierName || null,
      dosStart: it.dosStart || null,
      dosEnd: it.dosEnd || null,
      claimAmount: it.claimAmount ?? null,
      statusDate: it.statusDate || null,
      rejectionDetail: it.rejectionDetail || null,
      lastBatchId: it.batchId || null,
    };
    await prisma.cariskManagementReportItem.upsert({
      where: { cicNumber: cic },
      // Re-open if it had graduated then came back as Saved Incomplete again.
      update: { ...data, status: "open", lastSeen: new Date() },
      create: { cicNumber: cic, ...data, status: "open" },
    });
    n++;
  }
  return n;
}

/** Graduate CIC#s off the report (they arrived as Carrier Submission → a matter was created). */
export async function removeCicsFromReport(cics: string[]): Promise<number> {
  const clean = Array.from(new Set(cics.map((c) => String(c || "").trim()).filter(Boolean)));
  if (!clean.length) return 0;
  const res = await prisma.cariskManagementReportItem.updateMany({
    where: { cicNumber: { in: clean }, status: "open" },
    data: { status: "removed", updatedAt: new Date() },
  });
  return res.count;
}

/** The still-open report rows (what the weekly email + the admin view show). */
export async function listOpenReport() {
  return prisma.cariskManagementReportItem.findMany({
    where: { status: "open" },
    orderBy: [{ lastSeen: "desc" }],
    select: {
      id: true, cicNumber: true, patientName: true, providerName: true, carrierName: true,
      dosStart: true, dosEnd: true, claimAmount: true, statusDate: true, rejectionDetail: true,
      firstSeen: true, lastSeen: true,
    },
  });
}
