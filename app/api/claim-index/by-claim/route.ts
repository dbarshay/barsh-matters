import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { attachLocalLawsuitMetadataToClaimRows } from "@/lib/claimIndexLawsuitMetadata";
import { normalizeClaimNumber } from "@/lib/claimIndex";

export async function GET(req: NextRequest) {
  const claimNumber = req.nextUrl.searchParams.get("claimNumber");

  if (!claimNumber) {
    return NextResponse.json(
      { ok: false, error: "Missing claimNumber" },
      { status: 400 }
    );
  }

  const normalized = normalizeClaimNumber(claimNumber);

  const rows = await prisma.claimIndex.findMany({
    where: {
      claim_number_normalized: normalized,
    },
    orderBy: [
      { master_lawsuit_id: "asc" },
      { display_number: "asc" },
    ],
  });

  const rowsWithMetadata = await attachLocalLawsuitMetadataToClaimRows(rows);

  return NextResponse.json({
    ok: true,
    count: rowsWithMetadata.length,
    claimNumber,
    normalized,
    rows: rowsWithMetadata,
  });
}
