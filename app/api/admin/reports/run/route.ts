/* eslint-disable @typescript-eslint/no-explicit-any -- dynamic report config. */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { gateReports, reportOwnerId } from "@/lib/reports/reportsAuth";
import { runReport, type ReportConfig } from "@/lib/reports/runReport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const gate = gateReports(req, "POST");
  if (!gate.ok) return gate.response;
  const body = await req.json().catch(() => ({}));

  let config: ReportConfig | null = null;
  if (body?.savedReportId) {
    const r = await prisma.savedReport.findUnique({ where: { id: String(body.savedReportId) } });
    if (!r) return NextResponse.json({ ok: false, error: "Saved report not found." }, { status: 404 });
    const me = reportOwnerId(gate.identity);
    if (!(r.isShared || (r.ownerId || "") === me)) return NextResponse.json({ ok: false, error: "Not visible to you." }, { status: 403 });
    config = { ...((r.config as any) || {}) };
  } else if (body?.config && typeof body.config === "object") {
    config = { ...body.config };
  }
  if (!config) return NextResponse.json({ ok: false, error: "No report config provided." }, { status: 400 });

  try {
    const result = await runReport(config);
    return NextResponse.json({ ok: true, result });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "Report run failed." }, { status: 500 });
  }
}
