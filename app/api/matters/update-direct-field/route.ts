import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type DirectField = "claimAmount" | "dos" | "denialReason" | "status" | "policyNumber";

function textValue(value: unknown): string {
  return String(value ?? "").trim();
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

function labelForField(field: DirectField): string {
  if (field === "claimAmount") return "Claim Amount";
  if (field === "dos") return "Date of Service";
  if (field === "denialReason") return "Denial Reason";
  if (field === "policyNumber") return "Policy Number";
  return "Status";
}

function priorValueForField(existing: any, field: DirectField) {
  if (field === "claimAmount") return existing?.claim_amount ?? null;

  if (field === "dos") {
    return {
      dosStart: existing?.dos_start || null,
      dosEnd: existing?.dos_end || null,
    };
  }

  if (field === "denialReason") return existing?.denial_reason || null;
  if (field === "status") return existing?.matter_stage_name || existing?.status || null;
  if (field === "policyNumber") return existing?.policy_number || null;

  return null;
}

async function referenceDisplayNameFromSubmittedValue(referenceType: string, submittedValue: string): Promise<string> {
  const value = textValue(submittedValue);
  if (!value) return "";

  const byId = await prisma.referenceEntity.findFirst({
    where: {
      id: value,
      type: referenceType,
      active: true,
    },
    select: {
      displayName: true,
    },
  });

  if (byId?.displayName) return byId.displayName;

  const normalized = value.toLowerCase().replace(/\s+/g, " ").trim();

  const byName = await prisma.referenceEntity.findFirst({
    where: {
      type: referenceType,
      active: true,
      OR: [
        { displayName: value },
        { normalizedName: normalized },
      ],
    },
    select: {
      displayName: true,
    },
  });

  return textValue(byName?.displayName || value);
}

async function newValueForField(field: DirectField, body: any) {
  if (field === "claimAmount") {
    const raw = textValue(body?.claimAmount).replace(/[$,]/g, "");
    const claimAmount = Number(raw);

    if (!raw || !Number.isFinite(claimAmount) || claimAmount < 0) {
      throw new Error("A valid Claim Amount is required.");
    }

    return { claimAmount };
  }

  if (field === "dos") {
    const dosStart = textValue(body?.dosStart);
    const dosEnd = textValue(body?.dosEnd);

    if (!dosStart || !dosEnd) {
      throw new Error("DOS Start and DOS End are required.");
    }

    return {
      dosStart,
      dosEnd,
    };
  }

  if (field === "denialReason") {
    const value = textValue(body?.denialReasonLabel || body?.denialReasonValue);
    if (!value) throw new Error("Denial Reason is required.");
    return referenceDisplayNameFromSubmittedValue("denial_reason", value);
  }

  if (field === "status") {
    const value = textValue(body?.statusLabel || body?.statusValue || body?.matterStageValue || body?.matterStageName);
    if (!value) throw new Error("Status is required.");
    return value;
  }

  if (field === "policyNumber") {
    // Free-form alphanumeric; blank is allowed (clears the policy number).
    return textValue(body?.policyNumber);
  }

  throw new Error("Unsupported direct matter field.");
}

function numberValue(value: any): number {
  const parsed = Number(String(value ?? "").replace(/[$,]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function claimIndexUpdateData(field: DirectField, value: any, existing?: any) {
  if (field === "claimAmount") {
    const claimAmount = numberValue(value?.claimAmount);
    const payments = numberValue(existing?.payment_amount ?? existing?.payment_voluntary);
    const balance = Math.max(claimAmount - payments, 0);

    return {
      claim_amount: claimAmount,
      balance_presuit: balance,
      balance_amount: balance,
      indexed_at: new Date(),
    };
  }

  if (field === "dos") {
    return {
      dos_start: value.dosStart,
      dos_end: value.dosEnd,
      indexed_at: new Date(),
    };
  }

  if (field === "denialReason") {
    return {
      denial_reason: String(value),
      indexed_at: new Date(),
    };
  }

  if (field === "status") {
    return {
      matter_stage_name: String(value),
      status: String(value),
      indexed_at: new Date(),
    };
  }

  if (field === "policyNumber") {
    return {
      policy_number: String(value ?? ""),
      indexed_at: new Date(),
    };
  }

  return {
    indexed_at: new Date(),
  };
}

function clientMatterPatch(field: DirectField, value: any, updated: any) {
  if (field === "claimAmount") {
    return {
      claimAmount: updated.claim_amount,
      claim_amount: updated.claim_amount,
      balancePresuit: updated.balance_presuit,
      balance_presuit: updated.balance_presuit,
      balanceAmount: updated.balance_amount,
      balance_amount: updated.balance_amount,
      paymentVoluntary: updated.payment_voluntary,
      payment_voluntary: updated.payment_voluntary,
    };
  }

  if (field === "dos") {
    return {
      dosStart: value.dosStart,
      dos_start: value.dosStart,
      dosEnd: value.dosEnd,
      dos_end: value.dosEnd,
    };
  }

  if (field === "denialReason") {
    return {
      denialReason: String(value),
      denial_reason: String(value),
    };
  }

  if (field === "status") {
    return {
      status: String(value),
      matterStage: {
        name: String(value),
      },
      matter_stage_name: String(value),
    };
  }

  if (field === "policyNumber") {
    return {
      policyNumber: String(value ?? ""),
      policy_number: String(value ?? ""),
    };
  }

  return {};
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));

    const matterId = Number(body?.matterId || "");
    const field = textValue(body?.field) as DirectField;
    const actorName = textValue(body?.actorName) || "Barsh Matters User";
    const actorEmail = textValue(body?.actorEmail);

    if (!Number.isFinite(matterId) || matterId <= 0) {
      return jsonError("Valid matterId is required.");
    }

    const supported: DirectField[] = ["claimAmount", "dos", "denialReason", "status", "policyNumber"];
    if (!supported.includes(field)) {
      return jsonError("Unsupported direct matter field.");
    }

    const nextValue = await newValueForField(field, body);

    const existing = await prisma.claimIndex.findUnique({
      where: {
        matter_id: matterId,
      },
      select: {
        matter_id: true,
        display_number: true,
        patient_name: true,
        client_name: true,
        insurer_name: true,
        claim_number_raw: true,
        claim_number_normalized: true,
        policy_number: true,
        master_lawsuit_id: true,
        claim_amount: true,
        payment_amount: true,
        payment_voluntary: true,
        balance_presuit: true,
        balance_amount: true,
        dos_start: true,
        dos_end: true,
        denial_reason: true,
        matter_stage_name: true,
        status: true,
        close_reason: true,
        final_status: true,
      },
    });

    if (!existing) {
      return jsonError("No local matter index row exists for this matter. Import or locally create the matter before saving direct fields.", 404, {
        matterId,
        field,
      });
    }

    const priorValue = priorValueForField(existing, field);

    const updated = await prisma.$transaction(async (tx) => {
      const claimIndex = await tx.claimIndex.update({
        where: {
          matter_id: matterId,
        },
        data: claimIndexUpdateData(field, nextValue, existing),
        select: {
          matter_id: true,
          display_number: true,
          patient_name: true,
          client_name: true,
          insurer_name: true,
          claim_number_raw: true,
          claim_number_normalized: true,
          policy_number: true,
          master_lawsuit_id: true,
          dos_start: true,
          dos_end: true,
          denial_reason: true,
          matter_stage_name: true,
          status: true,
          close_reason: true,
          final_status: true,
        },
      });

      await tx.auditLog.create({
        data: {
          action: "claimindex-direct-field-update",
          summary: `${labelForField(field)} changed locally in ClaimIndex.`,
          entityType: "matter",
          fieldName: field,
          priorValue,
          newValue: nextValue,
          details: {
            source: "claimindex-local-direct-field-route",
            storage: "ClaimIndex",
            noClioWrite: true,
            noClioRead: true,
          },
          affectedMatterIds: [matterId],
          matterId,
          matterDisplayNumber: claimIndex.display_number || null,
          masterLawsuitId: claimIndex.master_lawsuit_id || null,
          sourcePage: "direct-matter",
          workflow: "local-direct-field",
          actorName,
          actorEmail: actorEmail || null,
        },
      });

      return claimIndex;
    });

    return NextResponse.json({
      ok: true,
      action: "update-direct-matter-field",
      source: "claimindex",
      noClioWrite: true,
      noClioRead: true,
      field,
      label: labelForField(field),
      matterId,
      displayNumber: updated.display_number || "",
      matter: clientMatterPatch(field, nextValue, updated),
      claimIndex: updated,
      safety: {
        clioWriteback: false,
        clioRead: false,
        claimIndexUpdated: true,
        auditLogCreated: true,
      },
    });
  } catch (error: any) {
    return jsonError(error?.message || String(error), 500);
  }
}
