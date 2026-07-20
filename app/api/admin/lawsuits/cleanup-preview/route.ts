/* eslint-disable @typescript-eslint/no-explicit-any -- Pre-existing loosely-typed Clio/claim rows; messaging-only change. */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

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

export async function GET(request: Request) {
  const url = new URL(request.url);

  const keepMaster = text(url.searchParams.get("keepMaster")) || "2026.05.00001";
  const includeEmpty = url.searchParams.get("includeEmpty") !== "false";
  const onlyWithChildren = url.searchParams.get("onlyWithChildren") === "true";
  const onlyWithClioShell = url.searchParams.get("onlyWithClioShell") === "true";

  const lawsuits = await prisma.lawsuit.findMany({
    orderBy: { masterLawsuitId: "asc" },
  });

  const candidateLawsuits = lawsuits.filter((lawsuit: any) => {
    const master = text(lawsuit.masterLawsuitId);
    if (!master) return false;
    return master !== keepMaster;
  });

  const keepRows = await prisma.claimIndex.findMany({
    where: { master_lawsuit_id: keepMaster },
    orderBy: [{ display_number: "asc" }, { matter_id: "asc" }],
  });

  const candidateMasterIds = candidateLawsuits
    .map((lawsuit: any) => text(lawsuit.masterLawsuitId))
    .filter(Boolean);

  const candidateChildRows = candidateMasterIds.length
    ? await prisma.claimIndex.findMany({
        where: { master_lawsuit_id: { in: candidateMasterIds } },
        orderBy: [{ master_lawsuit_id: "asc" }, { display_number: "asc" }, { matter_id: "asc" }],
      })
    : [];

  const childRowsByMaster = new Map<string, any[]>();
  for (const row of candidateChildRows as any[]) {
    const key = text(row.master_lawsuit_id);
    const existing = childRowsByMaster.get(key) || [];
    existing.push(row);
    childRowsByMaster.set(key, existing);
  }

  const candidateRows = candidateLawsuits
    .map((lawsuit: any) => {
      const master = text(lawsuit.masterLawsuitId);
      const children = childRowsByMaster.get(master) || [];
      const clioMasterMatterId = text(lawsuit.clioMasterMatterId);
      const clioMasterDisplayNumber = text(lawsuit.clioMasterDisplayNumber);

      return {
        masterLawsuitId: master,
        amountSought: money(lawsuit.amountSought),
        venue: text(lawsuit.venue || lawsuit.venueSelection),
        indexAaaNumber: text(lawsuit.indexAaaNumber),
        clioMasterMatterId,
        clioMasterDisplayNumber,
        clioMasterMappingSource: text(lawsuit.clioMasterMappingSource),
        hasClioShell: Boolean(clioMasterMatterId || clioMasterDisplayNumber),
        childCount: children.length,
        children: children.map(claimIndexRow),
      };
    })
    .filter((lawsuit) => includeEmpty || lawsuit.childCount > 0 || lawsuit.hasClioShell)
    .filter((lawsuit) => !onlyWithChildren || lawsuit.childCount > 0)
    .filter((lawsuit) => !onlyWithClioShell || lawsuit.hasClioShell);

  const clioDeleteCandidates = candidateRows
    .filter((lawsuit) => lawsuit.hasClioShell)
    .map((lawsuit) => ({
      localMaster: lawsuit.masterLawsuitId,
      clioMatterId: lawsuit.clioMasterMatterId,
      clioDisplayNumber: lawsuit.clioMasterDisplayNumber,
      mappingSource: lawsuit.clioMasterMappingSource,
    }));

  const cleanupHistory = await prisma.auditLog.findMany({
    where: {
      action: "admin-lawsuit-cleanup-confirm",
      entityType: "lawsuit",
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return NextResponse.json({
    ok: true,
    previewOnly: true,
    route: "/api/admin/lawsuits/cleanup-preview",
    keepMaster,
    filters: {
      includeEmpty,
      onlyWithChildren,
      onlyWithClioShell,
    },
    localLawsuitCount: lawsuits.length,
    candidateLocalLawsuitCount: candidateRows.length,
    keepMasterChildCount: keepRows.length,
    wouldClearChildClaimIndexLinkCount: candidateRows.reduce((sum, lawsuit) => sum + lawsuit.childCount, 0),
    clioDeleteCandidateCount: clioDeleteCandidates.length,
    writesLocalDb: false,
    writesClio: false,
    deletesClio: false,
    destructiveActionAvailable: false,
    keepMasterChildren: (keepRows as any[]).map(claimIndexRow),
    candidateLawsuits: candidateRows,
    clioDeleteCandidates,
    cleanupHistory: cleanupHistory.map((entry: any) => ({
      id: text(entry.id),
      createdAt: entry.createdAt?.toISOString?.() || text(entry.createdAt),
      action: text(entry.action),
      summary: text(entry.summary),
      masterLawsuitId: text(entry.masterLawsuitId),
      actorName: text(entry.actorName),
      actorEmail: text(entry.actorEmail),
      details: entry.details || null,
    })),
    safetyDecision:
      "Loading this candidate list is read-only \u2014 it makes no changes. Deaggregation happens only when a guarded Confirm action is run on a candidate (exact confirmation required), which unlinks child matters, deletes the local Lawsuit row, and writes an audit entry. No Clio writes, document uploads, email, or print-queue changes occur.",
  });
}
