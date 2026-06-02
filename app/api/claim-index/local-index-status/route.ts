// Local index status route.
// This is the local-source replacement for the legacy ClaimIndex rebuild-status terminology.
// It is read-only local database status inspection with no Clio access and no write behavior.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function brlNumber(displayNumber?: string | null): number | null {
  const match = String(displayNumber || "").match(/^BRL(\d+)$/i);

  if (!match) return null;

  const n = Number(match[1]);

  return Number.isFinite(n) ? n : null;
}

export async function GET(req: NextRequest) {
  try {
    const name = req.nextUrl.searchParams.get("name") || undefined;

    const start = Number(
      req.nextUrl.searchParams.get("start") || "30000"
    );

    const end = Number(
      req.nextUrl.searchParams.get("end") || "39999"
    );

    const states = await prisma.claimIndexRebuildState.findMany({
      where: name ? { name } : undefined,
      orderBy: {
        updatedAt: "desc",
      },
    });

    const rows = await prisma.claimIndex.findMany({
      where: {
        display_number: {
          startsWith: "BRL",
        },
      },
      select: {
        matter_id: true,
        display_number: true,
        indexed_at: true,
        status: true,
        close_reason: true,
        service_type: true,
        policy_number: true,
        date_of_loss: true,
        matter_stage_name: true,
        denial_reason: true,
      },
      orderBy: {
        matter_id: "asc",
      },
      take: 20000,
    });

    const parsed = rows
      .map((row) => ({
        matterId: row.matter_id,
        displayNumber: row.display_number,
        brlNumber: brlNumber(row.display_number),
        indexedAt: row.indexed_at,
        status: row.status,
        closeReason: row.close_reason,
        serviceType: row.service_type,
        policyNumber: row.policy_number,
        dateOfLoss: row.date_of_loss,
        matterStageName: row.matter_stage_name,
        denialReason: row.denial_reason,
      }))
      .filter((row) => row.brlNumber !== null)
      .sort((a, b) => Number(a.brlNumber) - Number(b.brlNumber));

    const inScope = parsed.filter(
      (row) =>
        Number(row.brlNumber) >= start &&
        Number(row.brlNumber) <= end
    );

    const indexedAtValues = inScope
      .map((row) => row.indexedAt)
      .filter((value): value is Date => Boolean(value))
      .sort((a, b) => a.getTime() - b.getTime());

    const oldestIndexedAt = indexedAtValues[0] || null;

    const newestIndexedAt =
      indexedAtValues[indexedAtValues.length - 1] || null;

    const fieldCoverage = {
      closeReason: inScope.filter((row) => row.closeReason).length,
      serviceType: inScope.filter((row) => row.serviceType).length,
      policyNumber: inScope.filter((row) => row.policyNumber).length,
      dateOfLoss: inScope.filter((row) => row.dateOfLoss).length,
      matterStageName: inScope.filter((row) => row.matterStageName).length,
      denialReason: inScope.filter((row) => row.denialReason).length,
      status: inScope.filter((row) => row.status).length,
    };

    const progress = states.map((state) => {
      const current = state.currentBrlNumber || null;
      const denominator = Math.max(end - start + 1, 1);
      const numerator =
        current == null ? 0 : Math.max(0, Math.min(current, end) - start + 1);

      return {
        name: state.name,
        status: state.status,
        currentBrlNumber: state.currentBrlNumber,
        lastProcessedAt: state.lastProcessedAt,
        lastError: state.lastError,
        updatedAt: state.updatedAt,
        rangeStart: start,
        rangeEnd: end,
        processedInRangeEstimate: numerator,
        totalInRangeEstimate: denominator,
        percentEstimate:
          Math.round((numerator / denominator) * 10000) / 100,
      };
    });

    return NextResponse.json({
      ok: true,
      range: {
        start,
        end,
      },
      states,
      progress,
      coverage: {
        totalBrlRowsSeen: parsed.length,
        inScopeCount: inScope.length,
        fieldCoverage,
        oldestIndexedAt,
        newestIndexedAt,
        minInScope: inScope[0] || null,
        maxInScope: inScope[inScope.length - 1] || null,
        firstInScope: inScope.slice(0, 10),
        lastInScope: inScope.slice(-10),
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        error: err?.message || "Failed to read local index status.",
      },
      {
        status: 500,
      }
    );
  }
}
