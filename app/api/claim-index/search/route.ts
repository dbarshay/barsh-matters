import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { attachLocalLawsuitMetadataToClaimRows } from "@/lib/claimIndexLawsuitMetadata";
import { buildClaimIndexWhere, CLAIM_INDEX_SELECT } from "@/lib/claimIndexQuery";

export async function GET(req: NextRequest) {
  const patient  = req.nextUrl.searchParams.get("patient")  || "";
  const provider = req.nextUrl.searchParams.get("provider") || "";
  const insurer  = req.nextUrl.searchParams.get("insurer")  || "";
  const claim    = req.nextUrl.searchParams.get("claim")    || "";

  if (!patient && !provider && !insurer && !claim) {
    return NextResponse.json(
      { ok: false, error: "At least one search parameter required" },
      { status: 400 }
    );
  }

  const where = buildClaimIndexWhere({
    patient,
    provider,
    insurer,
    claim,
  });

  const rows = await prisma.claimIndex.findMany({
    where,
    orderBy: { matter_id: "asc" },
    select: CLAIM_INDEX_SELECT,
  });

  const rowsWithMetadata = await attachLocalLawsuitMetadataToClaimRows(rows);

  return NextResponse.json({
    ok: true,
    count: rowsWithMetadata.length,
    filters: { patient, provider, insurer, claim },
    rows: rowsWithMetadata,
  });
}
