import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function looksLikeClioDisplayNumber(value: unknown): boolean {
  return /^BRL\d+$/i.test(clean(value));
}

function normalizeBrl(value: unknown): string {
  const raw = clean(value).toUpperCase();
  if (!raw) return "";
  if (/^BRL\d+$/.test(raw)) return raw;
  if (/^\d+$/.test(raw)) return `BRL${raw}`;
  return raw;
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const masterLawsuitId = clean(url.searchParams.get("masterLawsuitId")) || "2026.05.00001";

    const lawsuits = await prisma.lawsuit.findMany({
      where: { masterLawsuitId },
      take: 10,
    });

    const claimIndexRows = await prisma.claimIndex.findMany({
      where: { master_lawsuit_id: masterLawsuitId },
      select: {
        matter_id: true,
        display_number: true,
        master_lawsuit_id: true,
        provider_name: true,
        patient_name: true,
        insurer_name: true,
        claim_number_raw: true,
        index_aaa_number: true,
        settled_with: true,
      },
      orderBy: [{ display_number: "asc" }],
      take: 100,
    });

    const brlCandidates = claimIndexRows
      .filter((row) => looksLikeClioDisplayNumber(row.display_number))
      .map((row) => ({
        localMatterId: row.matter_id,
        clioMatterId: row.matter_id,
        clioDisplayNumber: normalizeBrl(row.display_number),
        localMasterLawsuitId: row.master_lawsuit_id,
        possibleRole:
          normalizeBrl(row.display_number) === "BRL30121" ||
          normalizeBrl(row.display_number) === "BRL30122"
            ? "known Clio tester child matter"
            : "mapped local ClaimIndex matter",
      }));

    const possibleMasterClioMappings = brlCandidates.filter((candidate) => {
      const display = clean(candidate.clioDisplayNumber);
      return display && display !== "BRL30121" && display !== "BRL30122";
    });

    return NextResponse.json({
      ok: true,
      action: "master-clio-mapping-inspection",
      readOnly: true,
      clioRecordsChanged: false,
      databaseRecordsChanged: false,
      masterLawsuitId,
      note:
        "Read-only local inspection.  The Barsh Matters master lawsuit ID is not a Clio matter number.  Clio uses BRLXXXXX display numbers, so Barsh Matters must map masterLawsuitId to a Clio matter id/display number before reading Clio Maildrop or documents.",
      local: {
        lawsuits,
        claimIndexRows,
        brlCandidates,
        possibleMasterClioMappings,
      },
      summary: {
        lawsuitRows: lawsuits.length,
        claimIndexRows: claimIndexRows.length,
        brlCandidateCount: brlCandidates.length,
        possibleMasterClioMappingCount: possibleMasterClioMappings.length,
        knownClioTesterMattersPresent: brlCandidates
          .filter((row) => row.clioDisplayNumber === "BRL30121" || row.clioDisplayNumber === "BRL30122")
          .map((row) => row.clioDisplayNumber),
        masterAppearsMappedToClio:
          possibleMasterClioMappings.length > 0,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        action: "master-clio-mapping-inspection",
        readOnly: true,
        clioRecordsChanged: false,
        databaseRecordsChanged: false,
        error: error?.message || "Master Clio mapping inspection failed.",
      },
      { status: 500 }
    );
  }
}
