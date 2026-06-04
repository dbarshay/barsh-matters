import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { attachLocalLawsuitMetadataToClaimRows } from "@/lib/claimIndexLawsuitMetadata";
import { buildClaimIndexWhere, CLAIM_INDEX_SELECT } from "@/lib/claimIndexQuery";

export async function GET(req: NextRequest) {
  const provider = req.nextUrl.searchParams.get("name") || "";

  if (!provider) {
    return NextResponse.json(
      { ok: false, error: "Missing name" },
      { status: 400 }
    );
  }

  const where = buildClaimIndexWhere({ provider });

  const rows = await prisma.claimIndex.findMany({
    where,
    orderBy: { matter_id: "asc" },
    select: CLAIM_INDEX_SELECT,
  });

  const rowsWithMetadata = await attachLocalLawsuitMetadataToClaimRows(rows);

  return NextResponse.json({
    ok: true,
    count: rowsWithMetadata.length,
    rows: rowsWithMetadata,
  });
}
