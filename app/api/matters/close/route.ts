import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncClioMatterClosed } from "@/lib/clioCloseSync";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function text(value: unknown): string {
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

function clioCloseSyncAuditSummary(result: {
  matterId: number;
  ok: boolean;
  status: number;
  endpoint: string;
  attemptedStatus: "Closed";
  error?: string;
}) {
  return {
    matterId: result.matterId,
    ok: result.ok,
    status: result.status,
    endpoint: result.endpoint,
    attemptedStatus: result.attemptedStatus,
    error: result.error || null,
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const matterId = Number(body?.matterId);
    const closeReason = text(body?.closeReason);
    const actorName = text(body?.actorName) || "Barsh Matters User";
    const actorEmail = text(body?.actorEmail);

    if (!Number.isFinite(matterId) || matterId <= 0) {
      return jsonError("A valid matterId is required.");
    }

    if (!closeReason) {
      return jsonError("Closed Reason is required.");
    }

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
        master_lawsuit_id: true,
        status: true,
        matter_stage_name: true,
        final_status: true,
        close_reason: true,
      },
    });

    if (!existing) {
      return jsonError("No local ClaimIndex row exists for this matter.", 404, {
        matterId,
      });
    }

    const clioCloseSync = await syncClioMatterClosed({
      matterId,
      reason: closeReason,
      source: "close-matter",
    });

    if (!clioCloseSync.ok) {
      return jsonError("Clio close sync failed. Local matter close was not committed.", 502, {
        matterId,
        displayNumber: existing.display_number || "",
        clioCloseSync,
        safety: {
          clioCloseSyncAttempted: true,
          clioClosed: false,
          claimIndexUpdated: false,
          auditLogCreated: false,
        },
      });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const claimIndex = await tx.claimIndex.update({
        where: {
          matter_id: matterId,
        },
        data: {
          final_status: "Closed",
          close_reason: closeReason,
          indexed_at: new Date(),
        },
        select: {
          matter_id: true,
          display_number: true,
          patient_name: true,
          client_name: true,
          insurer_name: true,
          master_lawsuit_id: true,
          status: true,
          matter_stage_name: true,
          final_status: true,
          close_reason: true,
        },
      });

      await tx.auditLog.create({
        data: {
          action: "claimindex-matter-close",
          summary: `Closed matter ${claimIndex.display_number || claimIndex.matter_id} locally and in Clio with reason ${closeReason}.`,
          entityType: "matter",
          fieldName: "final_status",
          priorValue: {
            finalStatus: existing.final_status || null,
            closeReason: existing.close_reason || null,
          },
          newValue: {
            finalStatus: "Closed",
            closeReason,
          },
          details: {
            source: "guarded-close-matter-route",
            storage: "ClaimIndex + Clio matter status",
            clioCloseSyncRequired: true,
            clioCloseSyncReadOnly: false,
            clioCloseSync: clioCloseSyncAuditSummary(clioCloseSync),
          },
          affectedMatterIds: [matterId],
          matterId,
          matterDisplayNumber: claimIndex.display_number || null,
          masterLawsuitId: claimIndex.master_lawsuit_id || null,
          sourcePage: "direct-matter",
          workflow: "guarded-close-matter",
          actorName,
          actorEmail: actorEmail || null,
        },
      });

      return claimIndex;
    });

    return NextResponse.json({
      ok: true,
      action: "guarded-close-matter",
      source: "claimindex-and-clio",
      clioCloseSyncRequired: true,
      clioCloseSyncReadOnly: false,
      matterId,
      displayNumber: updated.display_number || "",
      finalStatus: updated.final_status || "",
      closeReason: updated.close_reason || "",
      matter: {
        id: updated.matter_id,
        matterId: updated.matter_id,
        matter_id: updated.matter_id,
        displayNumber: updated.display_number || "",
        display_number: updated.display_number || "",
        finalStatus: updated.final_status || "",
        final_status: updated.final_status || "",
        closeReason: updated.close_reason || "",
        close_reason: updated.close_reason || "",
      },
      claimIndex: updated,
      clioCloseSync,
      safety: {
        clioCloseSyncAttempted: true,
        clioClosed: true,
        clioWrite: true,
        clioRead: false,
        claimIndexUpdated: true,
        auditLogCreated: true,
      },
    });
  } catch (error: any) {
    return jsonError(error?.message || "Guarded matter close failed.", 500);
  }
}
