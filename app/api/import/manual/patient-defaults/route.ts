import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isImportEnabled, IMPORT_DISABLED_MESSAGE } from "@/lib/import/importConfig";
import { normalizeReferenceText } from "@/lib/referenceData";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// READ-ONLY carry-over defaults for the manual form: given a patientId, return the claim/accident-level
// field values from that patient's MOST RECENT matter, so a new bill for the same patient doesn't need
// re-keying. Entity-backed fields (insurer / provider / treating physician) are resolved from the
// stored canonical name back to their registry entity id so the form's dropdowns pre-select. Bill-level
// fields (DOS, amount, service type, denial reason) are intentionally NOT returned. Flag-gated.

async function entityIdFor(name: string | null | undefined, type: string): Promise<string | null> {
  const normalized = normalizeReferenceText(name ?? "");
  if (!normalized) return null;
  const e = await prisma.referenceEntity.findFirst({ where: { type, active: true, normalizedName: normalized }, select: { id: true } });
  return e?.id ?? null;
}

export async function GET(request: Request) {
  if (!isImportEnabled()) return NextResponse.json({ ok: false, error: IMPORT_DISABLED_MESSAGE }, { status: 403 });

  const patientId = new URL(request.url).searchParams.get("patientId") || "";
  if (!patientId) return NextResponse.json({ ok: false, error: "patientId is required." }, { status: 400 });

  const last = await prisma.claimIndex.findFirst({
    where: { patient_id: patientId },
    orderBy: { matter_id: "desc" },
    select: {
      claim_number_raw: true, policy_number: true, case_type: true, date_of_loss: true,
      insurer_name: true, provider_name: true, treating_provider: true, display_number: true,
    },
  });
  if (!last) return NextResponse.json({ ok: true, found: false });

  const [insurerEntityId, providerEntityId, treatingPhysicianId] = await Promise.all([
    entityIdFor(last.insurer_name, "insurer_company"),
    entityIdFor(last.provider_name, "provider_client"),
    entityIdFor(last.treating_provider, "treating_provider"),
  ]);

  return NextResponse.json({
    ok: true,
    found: true,
    fromMatter: last.display_number,
    defaults: {
      // sticky (claim/accident-level)
      claimNumber: last.claim_number_raw || "",
      policyNumber: last.policy_number || "",
      caseType: last.case_type || "",
      dateOfInjury: last.date_of_loss || "",
      insurerEntityId: insurerEntityId || "",
      // soft defaults (often the same, but expected to change)
      providerEntityId: providerEntityId || "",
      treatingPhysicianId: treatingPhysicianId || "",
    },
  });
}
