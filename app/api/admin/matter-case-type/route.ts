import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminRequestAuthorized } from "@/lib/adminAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const CASE_TYPE_OPTIONS = ["No-Fault", "Workers' Comp", "Lien"];

export async function GET(req: NextRequest) {
  if (!isAdminRequestAuthorized(req)) return NextResponse.json({ ok: false, error: "Not signed in." }, { status: 401 });
  const matterId = Number(new URL(req.url).searchParams.get("matterId"));
  if (!Number.isFinite(matterId) || matterId <= 0) return NextResponse.json({ ok: false, error: "matterId required." }, { status: 400 });
  const row = await prisma.claimIndex.findUnique({ where: { matter_id: matterId }, select: { case_type: true } });
  return NextResponse.json({ ok: true, value: row?.case_type || "", options: CASE_TYPE_OPTIONS });
}

export async function POST(req: NextRequest) {
  if (!isAdminRequestAuthorized(req)) return NextResponse.json({ ok: false, error: "Not signed in." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const matterId = Number(body?.matterId);
  if (!Number.isFinite(matterId) || matterId <= 0) return NextResponse.json({ ok: false, error: "matterId required." }, { status: 400 });
  const value = String(body?.value ?? "").trim();
  if (value && !CASE_TYPE_OPTIONS.includes(value)) return NextResponse.json({ ok: false, error: "Invalid case type." }, { status: 400 });
  const updated = await prisma.claimIndex.update({ where: { matter_id: matterId }, data: { case_type: value || null }, select: { case_type: true } });
  return NextResponse.json({ ok: true, value: updated.case_type || "" });
}
