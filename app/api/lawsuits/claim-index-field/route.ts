import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type MasterClaimInfoField = "provider" | "patient" | "insurer" | "claimNumber" | "dateOfLoss";

function text(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function normalizeDateInput(value: string): string {
  const raw = text(value);
  if (!raw || raw === "—") return "";
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const slash = raw.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (slash) return `${slash[3]}-${slash[1].padStart(2, "0")}-${slash[2].padStart(2, "0")}`;
  return raw;
}

function claimIndexUpdateData(field: MasterClaimInfoField, rawValue: string): Record<string, unknown> {
  const value = text(rawValue);
  if (field === "provider") return { provider_name: value || null, client_name: value || null };
  if (field === "patient") return { patient_name: value || null };
  if (field === "insurer") return { insurer_name: value || null };
  if (field === "claimNumber") return { claim_number_raw: value || null, claim_number_normalized: value || null };
  if (field === "dateOfLoss") return { date_of_loss: normalizeDateInput(value) || null };
  return {};
}

const FIELD_LABELS: Record<MasterClaimInfoField, string> = {
  provider: "Provider",
  patient: "Patient",
  insurer: "Insurer",
  claimNumber: "Claim Number",
  dateOfLoss: "Date of Loss",
};

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const masterLawsuitId = text(body?.masterLawsuitId);
    const field = text(body?.field) as MasterClaimInfoField;
    const value = text(body?.value);
    const actorName = text(body?.actorName) || "Master Info Edit";

    if (!masterLawsuitId) return NextResponse.json({ ok: false, error: "masterLawsuitId is required." }, { status: 400 });
    if (!["provider", "patient", "insurer", "claimNumber", "dateOfLoss"].includes(field)) {
      return NextResponse.json({ ok: false, error: `Unsupported ClaimIndex master info field: ${field}` }, { status: 400 });
    }

    const existingRows = await prisma.claimIndex.findMany({
      where: { master_lawsuit_id: masterLawsuitId },
      select: {
        matter_id: true,
        display_number: true,
        provider_name: true,
        client_name: true,
        patient_name: true,
        insurer_name: true,
        claim_number_raw: true,
        claim_number_normalized: true,
        date_of_loss: true,
        master_lawsuit_id: true,
      },
      orderBy: [{ display_number: "asc" }],
    });

    if (existingRows.length === 0) {
      return NextResponse.json({ ok: false, error: `No ClaimIndex child rows found for ${masterLawsuitId}.` }, { status: 404 });
    }

    const data = claimIndexUpdateData(field, value) as any;

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.claimIndex.updateMany({
        where: { master_lawsuit_id: masterLawsuitId },
        data,
      });

      await tx.auditLog.create({
        data: {
          action: "master-claimindex-field-update",
          summary: `Updated ${FIELD_LABELS[field]} on ${updated.count} ClaimIndex child row(s) for ${masterLawsuitId}.`,
          entityType: "claim-index-master-info",
          fieldName: field,
          priorValue: JSON.stringify(existingRows.slice(0, 20)),
          newValue: value,
          details: {
            masterLawsuitId,
            field,
            label: FIELD_LABELS[field],
            value,
            updatedCount: updated.count,
            storage: "ClaimIndex child rows linked by master_lawsuit_id",
            source: "app/api/lawsuits/claim-index-field",
            clioWriteAttempted: false,
          },
          actorName,
          masterLawsuitId,
        } as any,
      });

      const rows = await tx.claimIndex.findMany({
        where: { master_lawsuit_id: masterLawsuitId },
        select: {
          matter_id: true,
          display_number: true,
          provider_name: true,
          client_name: true,
          patient_name: true,
          insurer_name: true,
          claim_number_raw: true,
          claim_number_normalized: true,
          date_of_loss: true,
          master_lawsuit_id: true,
        },
        orderBy: [{ display_number: "asc" }],
      });

      return { updated, rows };
    });

    return NextResponse.json({
      ok: true,
      action: "master-claimindex-field-update",
      sourceOfTruth: "ClaimIndex child rows",
      masterLawsuitId,
      field,
      value,
      updatedCount: result.updated.count,
      rows: result.rows,
      safety: {
        clioRecordsChanged: false,
        lawsuitMetadataChanged: false,
        claimIndexRowsChanged: true,
        externalCalendarEventsCreated: false,
        emailsSent: false,
        documentsGenerated: false,
        printQueueChanged: false,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "Master ClaimIndex field update failed." }, { status: 500 });
  }
}
