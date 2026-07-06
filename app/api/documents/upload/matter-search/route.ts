import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { isAdminRequestAuthorized, adminUnauthorizedJson } from "@/lib/adminAuth";
import { isUploadDocsEnabled, UPLOAD_DOCS_DISABLED_MESSAGE } from "@/lib/documents/uploadDocsConfig";
import { buildBarshMatterDisplayNumberScopeWhere } from "@/lib/claimIndexQuery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Matter picker for Upload Docs. One free-text box: matches a matter number
// (display_number / matter_id) OR a patient name OR a claim number. Scoped to
// Barsh Matters-owned BRL_ matters. Read-only. Admin + flag gated.
export async function GET(req: NextRequest) {
  if (!isUploadDocsEnabled()) {
    return NextResponse.json({ ok: false, error: UPLOAD_DOCS_DISABLED_MESSAGE }, { status: 403 });
  }
  if (!isAdminRequestAuthorized(req)) return adminUnauthorizedJson();

  const q = (req.nextUrl.searchParams.get("q") || "").trim();
  if (q.length < 2) {
    return NextResponse.json({ ok: false, error: "Enter at least 2 characters." }, { status: 400 });
  }

  const or: Prisma.ClaimIndexWhereInput[] = [
    { display_number: { contains: q, mode: "insensitive" } },
    { patient_name: { contains: q, mode: "insensitive" } },
    { claim_number_normalized: { contains: q, mode: "insensitive" } },
    { policy_number: { contains: q, mode: "insensitive" } },
  ];
  const asNumber = Number(q.replace(/\D/g, ""));
  if (Number.isFinite(asNumber) && asNumber > 0 && /\d/.test(q)) {
    or.push({ matter_id: asNumber });
  }

  const rows = await prisma.claimIndex.findMany({
    where: { AND: [buildBarshMatterDisplayNumberScopeWhere(), { OR: or }] },
    orderBy: { matter_id: "asc" },
    take: 25,
    select: {
      matter_id: true,
      display_number: true,
      patient_name: true,
      insurer_name: true,
      provider_name: true,
      case_type: true,
      date_of_loss: true,
      final_status: true,
      matter_stage_name: true,
    },
  });

  return NextResponse.json({
    ok: true,
    count: rows.length,
    query: q,
    matters: rows.map((r) => ({
      matterId: r.matter_id,
      displayNumber: r.display_number,
      patientName: r.patient_name,
      insurerName: r.insurer_name,
      providerName: r.provider_name,
      caseType: r.case_type,
      dateOfLoss: r.date_of_loss,
      finalStatus: r.final_status,
      stage: r.matter_stage_name,
    })),
  });
}
