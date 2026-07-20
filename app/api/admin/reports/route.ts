/* eslint-disable @typescript-eslint/no-explicit-any -- saved-report config is dynamic JSON. */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { gateReports, reportOwnerId } from "@/lib/reports/reportsAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const gate = gateReports(req, "GET");
  if (!gate.ok) return gate.response;
  const me = reportOwnerId(gate.identity);
  const reports = await prisma.savedReport.findMany({
    where: { OR: [{ ownerId: me || "__none__" }, { isShared: true }] },
    orderBy: [{ updatedAt: "desc" }],
  });
  const list = reports.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    baseEntity: r.baseEntity,
    config: r.config,
    isShared: r.isShared,
    ownerUsername: r.ownerUsername,
    ownedByMe: (r.ownerId || "") === me,
    updatedAt: r.updatedAt,
  }));
  return NextResponse.json({ ok: true, reports: list, isOwner: gate.isOwner, me });
}

export async function POST(req: NextRequest) {
  const gate = gateReports(req, "POST");
  if (!gate.ok) return gate.response;
  const body = await req.json().catch(() => ({}));
  const name = String(body?.name ?? "").trim();
  if (!name) return NextResponse.json({ ok: false, error: "Report name is required." }, { status: 400 });
  const baseEntity = body?.baseEntity === "lawsuit" ? "lawsuit" : "matter";
  const config = body?.config && typeof body.config === "object" ? body.config : {};
  const created = await prisma.savedReport.create({
    data: {
      name,
      description: String(body?.description ?? "").trim() || null,
      baseEntity,
      config,
      ownerId: reportOwnerId(gate.identity) || null,
      ownerEmail: gate.identity?.email || null,
      ownerUsername: gate.identity?.username || gate.identity?.email || null,
      isShared: false,
    },
  });
  return NextResponse.json({ ok: true, id: created.id });
}
