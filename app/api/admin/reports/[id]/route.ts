/* eslint-disable @typescript-eslint/no-explicit-any -- saved-report config is dynamic JSON. */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { gateReports, reportOwnerId } from "@/lib/reports/reportsAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function load(id: string) {
  return prisma.savedReport.findUnique({ where: { id } });
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = gateReports(req, "GET");
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;
  const r = await load(id);
  if (!r) return NextResponse.json({ ok: false, error: "Report not found." }, { status: 404 });
  const me = reportOwnerId(gate.identity);
  if (!(r.isShared || (r.ownerId || "") === me)) {
    return NextResponse.json({ ok: false, error: "Not visible to you." }, { status: 403 });
  }
  return NextResponse.json({ ok: true, report: { id: r.id, name: r.name, description: r.description, baseEntity: r.baseEntity, config: r.config, isShared: r.isShared, ownedByMe: (r.ownerId || "") === me } });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = gateReports(req, "PATCH");
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;
  const r = await load(id);
  if (!r) return NextResponse.json({ ok: false, error: "Report not found." }, { status: 404 });
  const me = reportOwnerId(gate.identity);
  const ownsReport = (r.ownerId || "") === me;
  const body = await req.json().catch(() => ({}));

  if (typeof body?.isShared === "boolean") {
    if (!gate.isOwner) return NextResponse.json({ ok: false, error: "Only the owner can change sharing." }, { status: 403 });
    await prisma.savedReport.update({ where: { id }, data: { isShared: body.isShared } });
    return NextResponse.json({ ok: true, id, isShared: body.isShared });
  }

  if (!ownsReport && !gate.isOwner) return NextResponse.json({ ok: false, error: "Only the report's creator or the owner can edit it." }, { status: 403 });
  const data: any = {};
  if (typeof body?.name === "string" && body.name.trim()) data.name = body.name.trim();
  if (typeof body?.description === "string") data.description = body.description.trim() || null;
  if (body?.config && typeof body.config === "object") data.config = body.config;
  if (body?.baseEntity === "matter" || body?.baseEntity === "lawsuit") data.baseEntity = body.baseEntity;
  if (!Object.keys(data).length) return NextResponse.json({ ok: false, error: "Nothing to update." }, { status: 400 });
  await prisma.savedReport.update({ where: { id }, data });
  return NextResponse.json({ ok: true, id });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = gateReports(req, "DELETE");
  if (!gate.ok) return gate.response;
  const { id } = await ctx.params;
  const r = await load(id);
  if (!r) return NextResponse.json({ ok: false, error: "Report not found." }, { status: 404 });
  const me = reportOwnerId(gate.identity);
  if ((r.ownerId || "") !== me && !gate.isOwner) {
    return NextResponse.json({ ok: false, error: "Only the report's creator or the owner can delete it." }, { status: 403 });
  }
  await prisma.savedReport.delete({ where: { id } });
  return NextResponse.json({ ok: true, id });
}
