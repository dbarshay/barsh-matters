import { NextRequest, NextResponse } from "next/server";
import { buildClioFolderCreateDryRunPlan } from "@/lib/clioFolderCreateDryRunPlan";

export const runtime = "nodejs";

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

export async function GET(req: NextRequest) {
  try {
    const bmMatterId =
      clean(req.nextUrl.searchParams.get("bmMatterId")) ||
      clean(req.nextUrl.searchParams.get("matterId")) ||
      clean(req.nextUrl.searchParams.get("directMatterId")) ||
      clean(req.nextUrl.searchParams.get("masterLawsuitId"));
    const displayNumber =
      clean(req.nextUrl.searchParams.get("displayNumber")) ||
      clean(req.nextUrl.searchParams.get("directMatterDisplayNumber"));
    const lawsuitId = clean(req.nextUrl.searchParams.get("lawsuitId")) || clean(req.nextUrl.searchParams.get("masterLawsuitId"));
    const label = clean(req.nextUrl.searchParams.get("label"));

    if (!bmMatterId && !displayNumber && !lawsuitId) {
      return NextResponse.json({
        ok: false,
        action: "clio-folder-create-dry-run-plan",
        error: "Missing bmMatterId, matterId, displayNumber, directMatterDisplayNumber, lawsuitId, or masterLawsuitId.",
        safety: {
          previewOnly: true,
          dryRunOnly: true,
          callsClio: false,
          createsFolders: false,
          uploadsDocuments: false,
          mutatesDatabase: false,
          finalizeRouteRewired: false,
        },
      }, { status: 400 });
    }

    const plan = buildClioFolderCreateDryRunPlan({
      bmMatterId: bmMatterId || displayNumber || lawsuitId,
      displayNumber,
      lawsuitId,
      label,
    });

    return NextResponse.json({
      ok: true,
      action: "clio-folder-create-dry-run-plan",
      plan,
      safety: {
        previewOnly: true,
        dryRunOnly: true,
        callsClio: false,
        createsFolders: false,
        uploadsDocuments: false,
        mutatesDatabase: false,
        finalizeRouteRewired: false,
      },
    });
  } catch (err: any) {
    return NextResponse.json({
      ok: false,
      action: "clio-folder-create-dry-run-plan",
      error: err?.message || "Could not build Clio folder-create dry-run plan.",
      safety: {
        previewOnly: true,
        dryRunOnly: true,
        callsClio: false,
        createsFolders: false,
        uploadsDocuments: false,
        mutatesDatabase: false,
        finalizeRouteRewired: false,
      },
    }, { status: 500 });
  }
}
