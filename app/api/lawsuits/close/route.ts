import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CHILD_CLOSED_REASON = "Closed Lawsuit";

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function parseMatterIds(lawsuitMatters: string | null | undefined): number[] {
  return String(lawsuitMatters || "")
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isFinite(value) && value > 0);
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

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const masterLawsuitId = text(body?.masterLawsuitId);
    const closeReason = text(body?.closeReason);
    const actorName = text(body?.actorName) || "Barsh Matters User";
    const actorEmail = text(body?.actorEmail);

    if (!masterLawsuitId) {
      return jsonError("masterLawsuitId is required.");
    }

    if (!closeReason) {
      return jsonError("Closed Reason is required.");
    }

    const existing = await prisma.lawsuit.findUnique({
      where: {
        masterLawsuitId,
      },
    });

    if (!existing) {
      return jsonError(`No local Lawsuit row found for ${masterLawsuitId}.`, 404, {
        masterLawsuitId,
      });
    }

    const childMatterIds = parseMatterIds(existing.lawsuitMatters);
    const existingOptions =
      existing.lawsuitOptions && typeof existing.lawsuitOptions === "object" && !Array.isArray(existing.lawsuitOptions)
        ? (existing.lawsuitOptions as Record<string, unknown>)
        : {};

    const result = await prisma.$transaction(async (tx) => {
      const lawsuit = await tx.lawsuit.update({
        where: {
          masterLawsuitId,
        },
        data: {
          lawsuitOptions: {
            ...existingOptions,
            finalStatus: "Closed",
            final_status: "Closed",
            closeReason,
            close_reason: closeReason,
            closedAt: new Date().toISOString(),
            closeWorkflow: "local-close-lawsuit",
            childCloseReason: CHILD_CLOSED_REASON,
            noClioWrite: true,
            noClioRead: true,
          },
        },
      });

      const childByMasterUpdate = await tx.claimIndex.updateMany({
        where: {
          master_lawsuit_id: masterLawsuitId,
        },
        data: {
          final_status: "Closed",
          close_reason: CHILD_CLOSED_REASON,
          indexed_at: new Date(),
        },
      });

      const childByMatterIdUpdate = childMatterIds.length
        ? await tx.claimIndex.updateMany({
            where: {
              matter_id: {
                in: childMatterIds,
              },
            },
            data: {
              final_status: "Closed",
              close_reason: CHILD_CLOSED_REASON,
              indexed_at: new Date(),
            },
          })
        : { count: 0 };

      await tx.auditLog.create({
        data: {
          action: "local-lawsuit-close",
          summary: `Closed lawsuit ${masterLawsuitId} locally; child matters marked Closed with reason ${CHILD_CLOSED_REASON}.`,
          entityType: "lawsuit",
          fieldName: "final_status",
          priorValue: {
            lawsuitOptions: existing.lawsuitOptions || null,
          },
          newValue: {
            finalStatus: "Closed",
            closeReason,
            childFinalStatus: "Closed",
            childCloseReason: CHILD_CLOSED_REASON,
          },
          details: {
            source: "local-close-lawsuit-route",
            storage: "Lawsuit.lawsuitOptions + ClaimIndex",
            childMatterIds,
            childByMasterUpdatedCount: childByMasterUpdate.count,
            childByMatterIdUpdatedCount: childByMatterIdUpdate.count,
            noClioWrite: true,
            noClioRead: true,
          },
          affectedMatterIds: childMatterIds,
          masterLawsuitId,
          sourcePage: "master-lawsuit",
          workflow: "local-close-lawsuit",
          actorName,
          actorEmail: actorEmail || null,
        },
      });

      return {
        lawsuit,
        childByMasterUpdatedCount: childByMasterUpdate.count,
        childByMatterIdUpdatedCount: childByMatterIdUpdate.count,
        childMatterIds,
      };
    });

    return NextResponse.json({
      ok: true,
      action: "local-close-lawsuit",
      source: "local-lawsuit-schema-and-claimindex",
      noClioWrite: true,
      noClioRead: true,
      masterLawsuitId,
      finalStatus: "Closed",
      closeReason,
      childFinalStatus: "Closed",
      childCloseReason: CHILD_CLOSED_REASON,
      childMatterIds: result.childMatterIds,
      childByMasterUpdatedCount: result.childByMasterUpdatedCount,
      childByMatterIdUpdatedCount: result.childByMatterIdUpdatedCount,
      lawsuit: result.lawsuit,
      safety: {
        clioWrite: false,
        clioRead: false,
        lawsuitUpdated: true,
        childClaimIndexUpdated: true,
        auditLogCreated: true,
      },
    });
  } catch (error: any) {
    return jsonError(error?.message || "Local lawsuit close failed.", 500);
  }
}
