import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncClioMattersClosed } from "@/lib/clioCloseSync";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CHILD_CLOSED_REASON = "Closed Lawsuit";

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function numericId(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : 0;
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

function clioCloseSyncAuditSummary(result: {
  ok: boolean;
  attemptedMatterIds: number[];
  syncedMatterIds: number[];
  failed: Array<{
    matterId: number;
    ok: boolean;
    status: number;
    endpoint: string;
    attemptedStatus: "Closed";
    error?: string;
  }>;
  results: Array<{
    matterId: number;
    ok: boolean;
    status: number;
    endpoint: string;
    attemptedStatus: "Closed";
    error?: string;
  }>;
}) {
  return {
    ok: result.ok,
    attemptedMatterIds: result.attemptedMatterIds,
    syncedMatterIds: result.syncedMatterIds,
    failed: result.failed.map((item) => ({
      matterId: item.matterId,
      ok: item.ok,
      status: item.status,
      endpoint: item.endpoint,
      attemptedStatus: item.attemptedStatus,
      error: item.error || null,
    })),
    results: result.results.map((item) => ({
      matterId: item.matterId,
      ok: item.ok,
      status: item.status,
      endpoint: item.endpoint,
      attemptedStatus: item.attemptedStatus,
      error: item.error || null,
    })),
  };
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

    const clioMatterIdsToClose = Array.from(
      new Set([
        numericId((existing as any).clioMasterMatterId),
        ...childMatterIds.map((id) => numericId(id)),
      ].filter((id) => id > 0))
    );

    if (!clioMatterIdsToClose.length) {
      return jsonError("No Clio matter IDs were available for guarded lawsuit close sync. Local lawsuit close was not committed.", 409, {
        masterLawsuitId,
        childMatterIds,
        safety: {
          clioCloseSyncAttempted: false,
          clioClosed: false,
          lawsuitUpdated: false,
          childClaimIndexUpdated: false,
          auditLogCreated: false,
        },
      });
    }

    const clioCloseSync = await syncClioMattersClosed({
      matterIds: clioMatterIdsToClose,
      reason: closeReason,
      source: "close-lawsuit",
    });

    if (!clioCloseSync.ok) {
      return jsonError("Clio close sync failed. Local lawsuit close was not committed.", 502, {
        masterLawsuitId,
        closeReason,
        childMatterIds,
        clioCloseSync,
        safety: {
          clioCloseSyncAttempted: true,
          clioClosed: false,
          lawsuitUpdated: false,
          childClaimIndexUpdated: false,
          auditLogCreated: false,
        },
      });
    }

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
            closeWorkflow: "guarded-close-lawsuit",
            childCloseReason: CHILD_CLOSED_REASON,
            clioCloseSyncRequired: true,
            clioCloseSyncReadOnly: false,
            clioCloseSync: clioCloseSyncAuditSummary(clioCloseSync),
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
          summary: `Closed lawsuit ${masterLawsuitId} locally and in Clio; child matters marked Closed with reason ${CHILD_CLOSED_REASON}.`,
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
            source: "guarded-close-lawsuit-route",
            storage: "Lawsuit.lawsuitOptions + ClaimIndex + Clio matter status",
            childMatterIds,
            childByMasterUpdatedCount: childByMasterUpdate.count,
            childByMatterIdUpdatedCount: childByMatterIdUpdate.count,
            clioCloseSyncRequired: true,
            clioCloseSyncReadOnly: false,
            clioCloseSync: clioCloseSyncAuditSummary(clioCloseSync),
          },
          affectedMatterIds: childMatterIds,
          masterLawsuitId,
          sourcePage: "master-lawsuit",
          workflow: "guarded-close-lawsuit",
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
      action: "guarded-close-lawsuit",
      source: "local-lawsuit-schema-claimindex-and-clio",
      clioCloseSyncRequired: true,
      clioCloseSyncReadOnly: false,
      masterLawsuitId,
      finalStatus: "Closed",
      closeReason,
      childFinalStatus: "Closed",
      childCloseReason: CHILD_CLOSED_REASON,
      childMatterIds: result.childMatterIds,
      childByMasterUpdatedCount: result.childByMasterUpdatedCount,
      childByMatterIdUpdatedCount: result.childByMatterIdUpdatedCount,
      lawsuit: result.lawsuit,
      clioCloseSync,
      safety: {
        clioCloseSyncAttempted: true,
        clioClosed: true,
        clioWrite: true,
        clioRead: false,
        lawsuitUpdated: true,
        childClaimIndexUpdated: true,
        auditLogCreated: true,
      },
    });
  } catch (error: any) {
    return jsonError(error?.message || "Guarded lawsuit close failed.", 500);
  }
}
