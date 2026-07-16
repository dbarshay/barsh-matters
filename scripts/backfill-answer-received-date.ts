// Backfill lawsuitOptions.dateAnswerReceived from the earliest Answer already filed into
// Litigation → Pleadings/Receipts (folderKey=litigation.pleadings_receipts, titleKey=answer).
// The upload date (FiledDocument.createdAt) is the received date, per the operator. Only fills
// lawsuits whose dateAnswerReceived is currently blank (never overrides a manual value).
//
// Run:  npx tsx scripts/backfill-answer-received-date.ts          (dry run — reports only)
//       npx tsx scripts/backfill-answer-received-date.ts --write  (apply)

import { prisma } from "@/lib/prisma";
import { populateAnswerReceivedDate } from "@/lib/documents/populateLitigationFields";

async function main() {
  const write = process.argv.includes("--write");

  // Earliest Answer filing per lawsuit.
  const answers = await prisma.filedDocument.findMany({
    where: {
      folderKey: "litigation.pleadings_receipts",
      titleKey: "answer",
      status: "active",
      masterLawsuitId: { not: null },
    },
    orderBy: { createdAt: "asc" },
    select: { masterLawsuitId: true, createdAt: true },
  });

  const earliest = new Map<string, Date>();
  for (const a of answers) {
    const id = a.masterLawsuitId as string;
    if (!earliest.has(id)) earliest.set(id, a.createdAt);
  }

  console.log(`Found Answer filings on ${earliest.size} lawsuit(s).`);
  let filled = 0;
  let skipped = 0;

  for (const [masterLawsuitId, filedAt] of earliest) {
    if (!write) {
      const lawsuit = await prisma.lawsuit.findUnique({
        where: { masterLawsuitId },
        select: { lawsuitOptions: true },
      });
      const opts = (lawsuit?.lawsuitOptions as Record<string, any>) || {};
      const has = opts.dateAnswerReceived && String(opts.dateAnswerReceived).trim();
      console.log(`${has ? "SKIP (set)" : "WOULD FILL"}  ${masterLawsuitId}  ${filedAt.toISOString().slice(0, 10)}`);
      has ? skipped++ : filled++;
      continue;
    }
    const res = await populateAnswerReceivedDate(prisma, { masterLawsuitId, filedAt, actorEmail: "backfill-script" });
    if (res.populated) {
      filled++;
      console.log(`FILLED ${masterLawsuitId} = ${res.date}`);
    } else {
      skipped++;
    }
  }

  console.log(`\n${write ? "Filled" : "Would fill"} ${filled}; skipped ${skipped} (already set / no lawsuit).`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
