import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function textValue(value: unknown): string {
  return String(value ?? "").trim();
}

const DENIAL_REASON_LABELS: Record<string, string> = {
  "12497975": "Medical Necessity (IME)",
  "12497990": "Medical Necessity (Peer Review)",
};

function denialReasonLabel(value: unknown): string {
  const cleaned = textValue(value);
  if (!cleaned) return "";
  return DENIAL_REASON_LABELS[cleaned] || cleaned;
}



function jsonError(message: string, status = 400, details: Record<string, unknown> = {}) {
  return NextResponse.json(
    {
      ok: false,
      error: message,
      ...details,
    },
    { status }
  );
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const matterId = Number(url.searchParams.get("matterId") || "");
    const displayNumber = textValue(
      url.searchParams.get("displayNumber") ||
      url.searchParams.get("matterDisplayNumber")
    );
    const normalizedDisplayNumber =
      displayNumber && /^\d+$/.test(displayNumber)
        ? `BRL${displayNumber}`
        : displayNumber;

    if ((!Number.isFinite(matterId) || matterId <= 0) && !displayNumber) {
      return jsonError("A valid matterId or displayNumber is required.");
    }

    const displayNumberWhere =
      displayNumber && normalizedDisplayNumber && normalizedDisplayNumber !== displayNumber
        ? {
            OR: [
              { display_number: displayNumber },
              { display_number: normalizedDisplayNumber },
            ],
          }
        : { display_number: displayNumber };

    const row = await prisma.claimIndex.findFirst({
      where: displayNumber
        ? displayNumberWhere
        : { matter_id: matterId },
      select: {
        matter_id: true,
        display_number: true,
        description: true,
        claim_number_raw: true,
        claim_number_normalized: true,
        patient_name: true,
        client_name: true,
        provider_name: true,
        insurer_name: true,
        claim_amount: true,
        payment_voluntary: true,
        balance_presuit: true,
        bill_number: true,
        dos_start: true,
        dos_end: true,
        denial_reason: true,
        service_type: true,
        policy_number: true,
        date_of_loss: true,
        master_lawsuit_id: true,
        status: true,
        close_reason: true,
        matter_stage_name: true,
        index_aaa_number: true,
        treating_provider: true,
        indexed_at: true,
      },
    });

    if (!row) {
      return jsonError("No ClaimIndex row was found for this matter.", 404, {
        matterId: Number.isFinite(matterId) ? matterId : null,
        displayNumber,
      });
    }

    const overlay = {
      id: row.matter_id,
      matterId: row.matter_id,
      matter_id: row.matter_id,
      displayNumber: row.display_number || "",
      display_number: row.display_number || "",
      description: row.description || "",
      patient: row.patient_name ? { name: row.patient_name } : "",
      patientName: row.patient_name || "",
      patient_name: row.patient_name || "",
      client: row.client_name ? { name: row.client_name } : "",
      clientName: row.client_name || "",
      client_name: row.client_name || "",
      provider: row.client_name || row.provider_name || "",
      providerName: row.provider_name || row.client_name || "",
      provider_name: row.provider_name || row.client_name || "",
      insurer: row.insurer_name || "",
      insurerName: row.insurer_name || "",
      insurer_name: row.insurer_name || "",
      claimNumber: row.claim_number_raw || row.claim_number_normalized || "",
      claim_number: row.claim_number_raw || row.claim_number_normalized || "",
      claimNumberRaw: row.claim_number_raw || "",
      claim_number_raw: row.claim_number_raw || "",
      claimNumberNormalized: row.claim_number_normalized || "",
      claim_number_normalized: row.claim_number_normalized || "",
      claimAmount: row.claim_amount,
      claim_amount: row.claim_amount,
      paymentVoluntary: row.payment_voluntary,
      payment_voluntary: row.payment_voluntary,
      balancePresuit: row.balance_presuit,
      balance_presuit: row.balance_presuit,
      billNumber: row.bill_number || "",
      bill_number: row.bill_number || "",
      dosStart: row.dos_start || "",
      dos_start: row.dos_start || "",
      dosEnd: row.dos_end || "",
      dos_end: row.dos_end || "",
      denialReason: row.denial_reason || "",
      denial_reason: row.denial_reason || "",
      serviceType: row.service_type || "",
      service_type: row.service_type || "",
      policyNumber: row.policy_number || "",
      policy_number: row.policy_number || "",
      dateOfLoss: row.date_of_loss || "",
      date_of_loss: row.date_of_loss || "",
      masterLawsuitId: row.master_lawsuit_id || "",
      master_lawsuit_id: row.master_lawsuit_id || "",
      matterStage: row.matter_stage_name ? { name: row.matter_stage_name } : null,
      matterStageName: row.matter_stage_name || "",
      matter_stage_name: row.matter_stage_name || "",
      status: row.status || "",
      closeReason: row.close_reason || "",
      close_reason: row.close_reason || "",
      indexAaaNumber: row.index_aaa_number || "",
      index_aaa_number: row.index_aaa_number || "",
      treatingProvider: row.treating_provider || "",
      treating_provider: row.treating_provider || "",
    };

    return NextResponse.json({
      ok: true,
      source: "claimindex",
      noClioWrite: true,
      noClioRead: true,
      matterId: row.matter_id,
      displayNumber: row.display_number || "",
      row,
      overlay,
      safety: {
        clioWrite: false,
        clioRead: false,
        storage: "ClaimIndex",
      },
    });
  } catch (err: any) {
    return jsonError(err?.message || "ClaimIndex matter lookup failed.", 500);
  }
}
