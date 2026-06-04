import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { attachLocalLawsuitMetadataToClaimRows } from "@/lib/claimIndexLawsuitMetadata";

export async function GET(req: NextRequest) {
  const name = (req.nextUrl.searchParams.get("name") || "").toUpperCase();

  if (!name) {
    return NextResponse.json({ ok: false, error: "Missing name" }, { status: 400 });
  }

  const rows = await prisma.claimIndex.findMany({
    where: {
      patient_name: {
        contains: name,
        mode: "insensitive",
      },
    },
    orderBy: { matter_id: "asc" },
  });

  const rowsWithMetadata = await attachLocalLawsuitMetadataToClaimRows(rows);

  return NextResponse.json({ ok: true, count: rowsWithMetadata.length, rows: rowsWithMetadata });
}
