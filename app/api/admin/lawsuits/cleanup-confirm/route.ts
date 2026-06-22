import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clioFetch } from "@/lib/clio";

export const dynamic = "force-dynamic";

const KEEP_MASTER = "2026.05.00001";
const APPROVED_CLIO_SHELL_MAPPING_SOURCE = "barsh-matters-create-lawsuit-confirm";

function text(value: unknown) {
  return value == null ? "" : String(value).trim();
}

function money(value: unknown) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function claimIndexRow(row: any) {
  return {
    displayNumber: text(row.display_number),
    matterId: text(row.matter_id),
    masterLawsuitId: text(row.master_lawsuit_id),
    patient: text(row.patient_name),
    provider: text(row.client_name || row.provider_name),
    insurer: text(row.insurer_name),
    claimNumber: text(row.claim_number_raw || row.claim_number_normalized),
    claimAmount: money(row.claim_amount),
    balancePresuit: money(row.balance_presuit || row.balance_amount),
  };
}

async function deleteMappedClioShell(clioMatterId: number) {
  const response = await clioFetch(`/api/v4/matters/${encodeURIComponent(String(clioMatterId))}.json`, {
    method: "DELETE",
  });

  const bodyText = await response.text().catch(() => "");

  return {
    clioMatterId,
    status: response.status,
    ok: response.ok || response.status === 404,
    alreadyGone: response.status === 404,
    body: bodyText.slice(0, 500),
  };
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  const masterLawsuitId = text(body?.masterLawsuitId);
  const confirmation = text(body?.confirmation);
  const deleteClioShell = Boolean(body?.deleteClioShell);
  const actorName = text(body?.actorName) || "Admin Lawsuit Cleanup";
  const actorEmail = text(body?.actorEmail);

  const expectedConfirmation = `DEAGGREGATE AND DELETE ${masterLawsuitId}`;

  if (!masterLawsuitId) {
    return NextResponse.json(
      {
        ok: false,
        error: "masterLawsuitId is required.",
        writesLocalDb: false,
        writesClio: false,
        deletesClio: false,
      },
      { status: 400 }
    );
  }

  if (masterLawsuitId === KEEP_MASTER) {
    return NextResponse.json(
      {
        ok: false,
        error: `Protected keep-master lawsuit ${KEEP_MASTER} cannot be deaggregated or deleted by this route.`,
        writesLocalDb: false,
        writesClio: false,
        deletesClio: false,
      },
      { status: 409 }
    );
  }

  if (confirmation !== expectedConfirmation) {
    return NextResponse.json(
      {
        ok: false,
        error: `Exact confirmation required: ${expectedConfirmation}`,
        expectedConfirmation,
        writesLocalDb: false,
        writesClio: false,
        deletesClio: false,
      },
      { status: 400 }
    );
  }

  const lawsuit = await prisma.lawsuit.findUnique({
    where: { masterLawsuitId },
  });

  if (!lawsuit) {
    return NextResponse.json(
      {
        ok: false,
        error: `No local Lawsuit row found for ${masterLawsuitId}.`,
        writesLocalDb: false,
        writesClio: false,
        deletesClio: false,
      },
      { status: 404 }
    );
  }

  const childRows = await prisma.claimIndex.findMany({
    where: { master_lawsuit_id: masterLawsuitId },
    orderBy: [{ display_number: "asc" }, { matter_id: "asc" }],
  });

  const clioMasterMatterId = typeof lawsuit.clioMasterMatterId === "number" ? lawsuit.clioMasterMatterId : null;
  const clioMasterDisplayNumber = text(lawsuit.clioMasterDisplayNumber);
  const clioMasterMappingSource = text(lawsuit.clioMasterMappingSource);
  const hasClioShell = Boolean(clioMasterMatterId || clioMasterDisplayNumber);

  if (hasClioShell && !deleteClioShell) {
    return NextResponse.json(
      {
        ok: false,
        error: "This lawsuit has legacy Clio shell metadata. Legacy shell cleanup is blocked under the current single-repository architecture.",
        masterLawsuitId,
        clioMasterMatterId,
        clioMasterDisplayNumber,
        writesLocalDb: false,
        writesClio: false,
        deletesClio: false,
      },
      { status: 409 }
    );
  }

  if (hasClioShell && clioMasterMappingSource !== APPROVED_CLIO_SHELL_MAPPING_SOURCE) {
    return NextResponse.json(
      {
        ok: false,
        error: "Legacy Clio storage reference was not created by the approved Create Lawsuit workflow.  Refusing Clio deletion.",
        masterLawsuitId,
        clioMasterMatterId,
        clioMasterDisplayNumber,
        clioMasterMappingSource,
        requiredMappingSource: APPROVED_CLIO_SHELL_MAPPING_SOURCE,
        writesLocalDb: false,
        writesClio: false,
        deletesClio: false,
      },
      { status: 409 }
    );
  }

  if (hasClioShell && !clioMasterMatterId) {
    return NextResponse.json(
      {
        ok: false,
        error: "Legacy Clio storage reference display number exists, but clioMasterMatterId is missing.  Refusing cleanup to avoid an orphan Clio shell.",
        masterLawsuitId,
        clioMasterDisplayNumber,
        writesLocalDb: false,
        writesClio: false,
        deletesClio: false,
      },
      { status: 409 }
    );
  }

  let clioDeleteResult: Awaited<ReturnType<typeof deleteMappedClioShell>> | null = null;

  if (hasClioShell && clioMasterMatterId) {
    clioDeleteResult = await deleteMappedClioShell(clioMasterMatterId);

    if (!clioDeleteResult.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: "Clio master shell deletion failed.  Local deaggregation was not performed.",
          masterLawsuitId,
          clioDeleteResult,
          writesLocalDb: false,
          writesClio: true,
          deletesClio: true,
        },
        { status: 502 }
      );
    }
  }

  const childSnapshot = (childRows as any[]).map(claimIndexRow);

  const localResult = await prisma.$transaction(async (tx: any) => {
    const cleared = await tx.claimIndex.updateMany({
      where: { master_lawsuit_id: masterLawsuitId },
      data: { master_lawsuit_id: null },
    });

    const deleted = await tx.lawsuit.delete({
      where: { masterLawsuitId },
    });

    const auditEntry = await tx.auditLog.create({
      data: {
        action: "admin-lawsuit-cleanup-confirm",
        summary: `Admin deaggregated and deleted lawsuit ${masterLawsuitId}.`,
        entityType: "lawsuit",
        masterLawsuitId,
        actorName,
        actorEmail: actorEmail || null,
        details: {
          masterLawsuitId,
          amountSought: money((lawsuit as any).amountSought),
          venue: text((lawsuit as any).venue || (lawsuit as any).venueSelection),
          indexAaaNumber: text((lawsuit as any).indexAaaNumber),
          childCount: childSnapshot.length,
          children: childSnapshot,
          clioShell: {
            deleteRequested: deleteClioShell,
            deleted: Boolean(clioDeleteResult?.ok),
            clioMasterMatterId,
            clioMasterDisplayNumber,
            clioMasterMappingSource,
            result: clioDeleteResult,
          },
          safety: {
            keepMasterProtected: KEEP_MASTER,
            noChildClioMatterDeletion: true,
            noDocumentUpload: true,
            noEmail: true,
            noPrintQueue: true,
          },
        },
      },
    });

    return {
      clearedClaimIndexLinks: cleared.count,
      deletedLocalLawsuit: {
        masterLawsuitId: deleted.masterLawsuitId,
        clioMasterMatterId: deleted.clioMasterMatterId,
        clioMasterDisplayNumber: deleted.clioMasterDisplayNumber,
      },
      auditLogId: auditEntry.id,
    };
  });

  return NextResponse.json({
    ok: true,
    destructiveCleanupCompleted: true,
    masterLawsuitId,
    childCount: childSnapshot.length,
    children: childSnapshot,
    clioDeleteResult,
    localResult,
    writesLocalDb: true,
    writesClio: Boolean(clioDeleteResult),
    deletesClio: Boolean(clioDeleteResult),
    deletedClioShellOnly: Boolean(clioDeleteResult),
    deletedChildClioMatters: false,
    safetyDecision:
      "Completed guarded Admin Lawsuit Cleanup. Cleared local child lawsuit links, deleted the local Lawsuit row, left repository storage untouched, and wrote an AuditLog entry.",
  });
}
