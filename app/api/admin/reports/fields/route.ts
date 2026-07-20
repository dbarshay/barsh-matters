/* eslint-disable @typescript-eslint/no-explicit-any -- dynamic distinct-column selection over Prisma. */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { gateReports } from "@/lib/reports/reportsAuth";
import { fieldsFor, OPERATORS_BY_TYPE, AGGREGATIONS } from "@/lib/reports/reportCatalog";
import { normalizeProviderName } from "@/lib/providerNameCase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function distinctNormalized(rows: any[], col: string): string[] {
  return Array.from(new Set(rows.map((r) => normalizeProviderName(r[col])).filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

export async function GET(req: NextRequest) {
  const gate = gateReports(req, "GET");
  if (!gate.ok) return gate.response;

  const fields = fieldsFor();
  const categoryValues: Record<string, string[]> = {};

  for (const f of fields.filter((x) => x.type === "category" && x.column)) {
    try {
      const rows: any[] = await prisma.claimIndex.findMany({
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

  // Top-line quick-filter dropdowns (normalized, deduped).
  let providers: string[] = [];
  let insurers: string[] = [];
  try {
    const [byClient, byProvider]: any[][] = await Promise.all([
      prisma.claimIndex.findMany({ distinct: ["client_name"] as any, select: { client_name: true } as any, take: 10000 }),
      prisma.claimIndex.findMany({ distinct: ["provider_name"] as any, select: { provider_name: true } as any, take: 10000 }),
    ]);
    const set = new Set<string>();
    for (const r of byClient) { const v = normalizeProviderName(r.client_name); if (v) set.add(v); }
    for (const r of byProvider) { const v = normalizeProviderName(r.provider_name); if (v) set.add(v); }
    providers = Array.from(set).sort((a, b) => a.localeCompare(b));
  } catch {}
  try {
    const insRows: any[] = await prisma.claimIndex.findMany({ distinct: ["insurer_name"] as any, select: { insurer_name: true } as any, take: 10000 });
    insurers = distinctNormalized(insRows, "insurer_name");
  } catch {}

  return NextResponse.json({
    ok: true,
    fields,
    operators: OPERATORS_BY_TYPE,
    aggregations: AGGREGATIONS,
    categoryValues,
    topLine: {
      providers,
      insurers,
      caseTypes: [
        { key: "nf", label: "No-Fault" },
        { key: "wc", label: "Workers' Comp" },
        { key: "lien", label: "Lien" },
      ],
    },
  });
}
