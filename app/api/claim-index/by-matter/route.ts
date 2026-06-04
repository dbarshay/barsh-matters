import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { attachLocalLawsuitMetadataToClaimRows } from "@/lib/claimIndexLawsuitMetadata";

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

    const hasValidMatterId = Number.isFinite(matterId) && matterId > 0;
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
      where: hasValidMatterId
        ? { matter_id: matterId }
        : displayNumberWhere,
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
        final_status: true,
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

    const [metadataRow] = await attachLocalLawsuitMetadataToClaimRows([row as any]);
    const rowWithMetadata = metadataRow || row;

    const overlay = {
      id: rowWithMetadata.matter_id,
      matterId: rowWithMetadata.matter_id,
      matter_id: rowWithMetadata.matter_id,
      displayNumber: rowWithMetadata.display_number || "",
      display_number: rowWithMetadata.display_number || "",
      description: rowWithMetadata.description || "",
      patient: rowWithMetadata.patient_name ? { name: rowWithMetadata.patient_name } : "",
      patientName: rowWithMetadata.patient_name || "",
      patient_name: rowWithMetadata.patient_name || "",
      client: rowWithMetadata.client_name ? { name: rowWithMetadata.client_name } : "",
      clientName: rowWithMetadata.client_name || "",
      client_name: rowWithMetadata.client_name || "",
      provider: rowWithMetadata.client_name || rowWithMetadata.provider_name || "",
      providerName: rowWithMetadata.provider_name || rowWithMetadata.client_name || "",
      provider_name: rowWithMetadata.provider_name || rowWithMetadata.client_name || "",
      insurer: rowWithMetadata.insurer_name || "",
      insurerName: rowWithMetadata.insurer_name || "",
      insurer_name: rowWithMetadata.insurer_name || "",
      claimNumber: rowWithMetadata.claim_number_raw || rowWithMetadata.claim_number_normalized || "",
      claim_number: rowWithMetadata.claim_number_raw || rowWithMetadata.claim_number_normalized || "",
      claimNumberRaw: rowWithMetadata.claim_number_raw || "",
      claim_number_raw: rowWithMetadata.claim_number_raw || "",
      claimNumberNormalized: rowWithMetadata.claim_number_normalized || "",
      claim_number_normalized: rowWithMetadata.claim_number_normalized || "",
      claimAmount: rowWithMetadata.claim_amount,
      claim_amount: rowWithMetadata.claim_amount,
      paymentVoluntary: rowWithMetadata.payment_voluntary,
      payment_voluntary: rowWithMetadata.payment_voluntary,
      balancePresuit: rowWithMetadata.balance_presuit,
      balance_presuit: rowWithMetadata.balance_presuit,
      billNumber: rowWithMetadata.bill_number || "",
      bill_number: rowWithMetadata.bill_number || "",
      dosStart: rowWithMetadata.dos_start || "",
      dos_start: rowWithMetadata.dos_start || "",
      dosEnd: rowWithMetadata.dos_end || "",
      dos_end: rowWithMetadata.dos_end || "",
      denialReason: rowWithMetadata.denial_reason || "",
      denial_reason: rowWithMetadata.denial_reason || "",
      serviceType: rowWithMetadata.service_type || "",
      service_type: rowWithMetadata.service_type || "",
      policyNumber: rowWithMetadata.policy_number || "",
      policy_number: rowWithMetadata.policy_number || "",
      dateOfLoss: rowWithMetadata.date_of_loss || "",
      date_of_loss: rowWithMetadata.date_of_loss || "",
      masterLawsuitId: rowWithMetadata.master_lawsuit_id || "",
      master_lawsuit_id: rowWithMetadata.master_lawsuit_id || "",
      matterStage: rowWithMetadata.matter_stage_name ? { name: rowWithMetadata.matter_stage_name } : null,
      matterStageName: rowWithMetadata.matter_stage_name || "",
      matter_stage_name: rowWithMetadata.matter_stage_name || "",
      status: rowWithMetadata.status || "",
      closeReason: rowWithMetadata.close_reason || "",
      close_reason: rowWithMetadata.close_reason || "",
      finalStatus: rowWithMetadata.final_status || "",
      final_status: rowWithMetadata.final_status || "",
      indexAaaNumber: rowWithMetadata.index_aaa_number || "",
      index_aaa_number: rowWithMetadata.index_aaa_number || "",
      treatingProvider: rowWithMetadata.treating_provider || "",
      treating_provider: rowWithMetadata.treating_provider || "",
    };

    return NextResponse.json({
      ok: true,
      source: "claimindex",
      noClioWrite: true,
      noClioRead: true,
      matterId: rowWithMetadata.matter_id,
      displayNumber: rowWithMetadata.display_number || "",
      row: rowWithMetadata,
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
