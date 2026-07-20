/* eslint-disable @typescript-eslint/no-explicit-any -- dynamic distinct-column selection over Prisma. */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { gateReports } from "@/lib/reports/reportsAuth";
import { fieldsFor, OPERATORS_BY_TYPE, AGGREGATIONS, type ReportBase } from "@/lib/reports/reportCatalog";
import { normalizeProviderName } from "@/lib/providerNameCase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const gate = gateReports(req, "GET");
  if (!gate.ok) return gate.response;

  const base: ReportBase = new URL(req.url).searchParams.get("base") === "lawsuit" ? "lawsuit" : "matter";
  const fields = fieldsFor(base);
  const categoryValues: Record<string, string[]> = {};

  for (const f of fields.filter((x) => x.type === "category" && x.column)) {
    try {
      const model: any = base === "matter" ? prisma.claimIndex : prisma.lawsuit;
      const rows: any[] = await model.findMany({
        distinct: [f.column as any],
        select: { [f.column as string]: true } as any,
        take: 1000,
      });
      const rawVals = rows.map((r) => String(r[f.column as string] ?? "").trim()).filter(Boolean);
      const shown = f.format === "provider" ? Array.from(new Set(rawVals.map((v) => normalizeProviderName(v)))) : rawVals;
      categoryValues[f.key] = shown.sort((a, b) => a.localeCompare(b)).slice(0, 300);
    } catch {
      categoryValues[f.key] = [];
    }
  }

  return NextResponse.json({ ok: true, base, fields, operators: OPERATORS_BY_TYPE, aggregations: AGGREGATIONS, categoryValues });
}
