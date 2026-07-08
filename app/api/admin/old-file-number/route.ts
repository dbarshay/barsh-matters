import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminRequestAuthorized, adminUnauthorizedJson } from "@/lib/adminAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Read/save the legacy paper file number during migration:
//   Individual Matter -> ClaimIndex.old_matter_number   ("445YY-NNNNNN")
//   Lawsuit Matter    -> Lawsuit.oldLawsuitNumber        ("445-PKTYY-NNNNNN")
// Admin-gated. Retired once the legacy files are closed out.
function clean(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}
const db = () => prisma as any;

export async function GET(req: NextRequest) {
  if (!isAdminRequestAuthorized(req)) return adminUnauthorizedJson();
  const sp = req.nextUrl.searchParams;
  const matterId = Number(sp.get("matterId"));
  const masterLawsuitId = clean(sp.get("masterLawsuitId"));
  try {
    if (Number.isFinite(matterId) && matterId > 0) {
      const r = await db().claimIndex.findUnique({ where: { matter_id: matterId }, select: { old_matter_number: true } });
      return NextResponse.json({ ok: true, kind: "matter", value: r?.old_matter_number || "" });
    }
    if (masterLawsuitId) {
      const r = await db().lawsuit.findUnique({ where: { masterLawsuitId }, select: { oldLawsuitNumber: true } });
      return NextResponse.json({ ok: true, kind: "lawsuit", value: r?.oldLawsuitNumber || "" });
    }
    return NextResponse.json({ ok: false, error: "matterId or masterLawsuitId required." }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Read failed." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!isAdminRequestAuthorized(req)) return adminUnauthorizedJson();
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }
  const matterId = Number(body?.matterId);
  const masterLawsuitId = clean(body?.masterLawsuitId);
  const value = clean(body?.value) || null; // empty clears the field
  try {
    if (Number.isFinite(matterId) && matterId > 0) {
      await db().claimIndex.update({ where: { matter_id: matterId }, data: { old_matter_number: value } });
      return NextResponse.json({ ok: true, kind: "matter", value: value || "" });
    }
    if (masterLawsuitId) {
      await db().lawsuit.update({ where: { masterLawsuitId }, data: { oldLawsuitNumber: value } });
      return NextResponse.json({ ok: true, kind: "lawsuit", value: value || "" });
    }
    return NextResponse.json({ ok: false, error: "matterId or masterLawsuitId required." }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Save failed." }, { status: 500 });
  }
}
