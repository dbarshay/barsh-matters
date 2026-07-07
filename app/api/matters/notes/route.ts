import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminRequestAuthorized, adminUnauthorizedJson } from "@/lib/adminAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Individual-matter Notes — stored locally on the matter (MatterLocalField, fieldName "matter_notes").
// GET falls back to the Carisk import note (ClaimIndex.status_notes) when the operator hasn't saved a
// local note yet, so the parsed StatusNotes shows up in the matter's Notes section by default.
const FIELD = "matter_notes";

function parseMatterId(v: string | null): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function GET(req: NextRequest) {
  const matterId = parseMatterId(new URL(req.url).searchParams.get("matterId"));
  if (matterId == null) return NextResponse.json({ ok: false, error: "matterId required." }, { status: 400 });
  try {
    const local = await prisma.matterLocalField.findUnique({
      where: { matterId_fieldName: { matterId, fieldName: FIELD } },
      select: { fieldValue: true },
    });
    if (local && local.fieldValue != null) {
      return NextResponse.json({ ok: true, notes: local.fieldValue, source: "local" });
    }
    const ci = await prisma.claimIndex.findUnique({ where: { matter_id: matterId }, select: { status_notes: true } });
    const carisk = (ci?.status_notes || "").trim();
    return NextResponse.json({ ok: true, notes: carisk, source: carisk ? "carisk-import" : "empty" });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Could not load notes." }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  if (!isAdminRequestAuthorized(req)) return adminUnauthorizedJson();
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }
  const matterId = parseMatterId(String(body?.matterId ?? ""));
  if (matterId == null) return NextResponse.json({ ok: false, error: "matterId required." }, { status: 400 });
  const notes = String(body?.notes ?? "");
  const matterDisplayNumber = body?.matterDisplayNumber ? String(body.matterDisplayNumber) : null;

  try {
    await prisma.matterLocalField.upsert({
      where: { matterId_fieldName: { matterId, fieldName: FIELD } },
      create: { matterId, matterDisplayNumber, fieldName: FIELD, fieldValue: notes, source: "matter-notes" },
      update: { fieldValue: notes, matterDisplayNumber },
    });
    return NextResponse.json({ ok: true, notes });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Could not save notes." }, { status: 500 });
  }
}
