import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveTemplateBuilderExamplePreview } from "@/src/lib/templates/template-builder-live-example-preview";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const matter = request.nextUrl.searchParams.get("matter")?.trim() || "2026.06.00011";
  const result = await resolveTemplateBuilderExamplePreview(matter);

  // Dump the RAW court source so we can see the exact address key names instead of guessing.
  let courtDebug: any = null;
  try {
    const isLawsuit = /^\d{4}\.\d{2}\.\d+$/.test(matter);
    let masterLawsuitId = isLawsuit ? matter : "";
    if (!masterLawsuitId) {
      const claim = await prisma.claimIndex.findFirst({ where: { display_number: matter } }).catch(() => null);
      masterLawsuitId = (claim as any)?.master_lawsuit_id || "";
    }
    const lawsuit = masterLawsuitId
      ? await prisma.lawsuit.findUnique({ where: { masterLawsuitId } }).catch(() => null)
      : null;
    const opts: any =
      (lawsuit as any)?.lawsuitOptions && typeof (lawsuit as any).lawsuitOptions === "object"
        ? (lawsuit as any).lawsuitOptions
        : {};
    const venue = String(
      (lawsuit as any)?.venue || (lawsuit as any)?.venueSelection || opts.venue || opts.courtName || "",
    ).trim();
    const courtEntity = venue
      ? await prisma.referenceEntity
          .findFirst({
            where: {
              type: { in: ["court_venue", "court", "venue"] },
              OR: [{ displayName: { equals: venue, mode: "insensitive" } }],
            },
          })
          .catch(() => null)
      : null;
    const keysOf = (v: any) => (v && typeof v === "object" ? Object.keys(v) : null);
    courtDebug = {
      venue,
      selectedCourtDetails_keys: keysOf(opts.selectedCourtDetails),
      selectedCourtDetails: opts.selectedCourtDetails || null,
      matchedCourtEntity_detailKeys: keysOf((courtEntity as any)?.details),
      matchedCourtEntity_details: (courtEntity as any)?.details || null,
    };
  } catch (e: any) {
    courtDebug = { error: e?.message || String(e) };
  }

  return NextResponse.json({
    matter,
    resolvedKeys: Object.keys(result.exampleOutputMap || {}).filter((key) => result.exampleOutputMap[key]),
    diagnostics: result.diagnostics,
    resolved: result.exampleOutputMap,
    courtDebug,
  });
}
