import { NextRequest, NextResponse } from "next/server";
import { isAdminRequestAuthorized } from "@/lib/adminAuth";
import { prisma } from "@/lib/prisma";
import {
  listAttachableDocumentsForLawsuit,
  listAttachableDocumentsForMatterTarget,
} from "@/lib/documents/attachableDocuments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

// Read-only listing of documents a user can attach to a generated document, for the attachment picker.
// Pass masterLawsuitId for a lawsuit (its own Clio folder + each sibling's Clio folder + siblings' legacy
// trees) or matter=BRL_... for an individual matter (that matter's Clio folder + its legacy tree).
export async function GET(req: NextRequest) {
  try {
    if (!isAdminRequestAuthorized(req)) {
      return NextResponse.json(
        { ok: false, action: "attachable-documents-list", error: "Authenticated administrator session required." },
        { status: 401 },
      );
    }

    const params = req.nextUrl.searchParams;
    const masterLawsuitId = clean(params.get("masterLawsuitId"));
    const matterDisplayNumber = clean(params.get("matter") || params.get("directMatterDisplayNumber")).toUpperCase();

    if (masterLawsuitId) {
      const result = await listAttachableDocumentsForLawsuit(masterLawsuitId);
      return NextResponse.json({ ok: true, action: "attachable-documents-list", readOnly: true, ...result });
    }

    if (matterDisplayNumber) {
      const row = await prisma.claimIndex.findFirst({
        where: { display_number: matterDisplayNumber },
        select: { matter_id: true, display_number: true, patient_name: true },
      });
      const result = await listAttachableDocumentsForMatterTarget({
        matterId: row?.matter_id ?? null,
        displayNumber: row?.display_number ?? matterDisplayNumber,
        patientName: row?.patient_name ?? null,
      });
      return NextResponse.json({ ok: true, action: "attachable-documents-list", readOnly: true, ...result });
    }

    return NextResponse.json(
      {
        ok: false,
        action: "attachable-documents-list",
        error: "Provide masterLawsuitId (lawsuit) or matter=BRL_... (individual matter) to list attachable documents.",
      },
      { status: 400 },
    );
  } catch (error) {
    return NextResponse.json(
      { ok: false, action: "attachable-documents-list", error: error instanceof Error ? error.message : "Attachable documents listing failed." },
      { status: 500 },
    );
  }
}
