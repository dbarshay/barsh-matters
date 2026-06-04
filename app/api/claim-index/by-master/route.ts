import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { attachLocalLawsuitMetadataToClaimRows } from "@/lib/claimIndexLawsuitMetadata";

export async function GET(req: NextRequest) {
  const masterLawsuitId = (req.nextUrl.searchParams.get("masterLawsuitId") || "").trim();

  if (!masterLawsuitId) {
    return NextResponse.json(
      { ok: false, error: "Missing masterLawsuitId" },
      { status: 400 }
    );
  }

  const rows = await prisma.claimIndex.findMany({
    where: {
      master_lawsuit_id: masterLawsuitId,
    },
    orderBy: [
      { display_number: "asc" },
      { matter_id: "asc" },
    ],
  });

  const rowsWithMetadata = await attachLocalLawsuitMetadataToClaimRows(rows);

  return NextResponse.json({
    ok: true,
    action: "claim-index-by-master",
    readOnly: true,
    noClioRecordsChanged: true,
    noDatabaseRecordsChanged: true,
    noDocumentsGenerated: true,
    noPrintQueueRecordsChanged: true,
    count: rowsWithMetadata.length,
    masterLawsuitId,
    rows: rowsWithMetadata,
  });
}
