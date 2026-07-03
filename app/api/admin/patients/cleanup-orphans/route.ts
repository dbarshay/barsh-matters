import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isImportEnabled, IMPORT_DISABLED_MESSAGE } from "@/lib/import/importConfig";
import { isAdminRequestAuthorized, adminUnauthorizedJson } from "@/lib/adminAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Delete ORPHANED patients — Patient master records with zero linked ClaimIndex matters. A patient
// should never persist without a matter; imports/undo now clean up after themselves, this clears the
// existing backlog (e.g. patients left behind by earlier test imports that were undone). Owner-gated
// (data deletion) + import-flag-gated. GET returns the count without deleting.

export async function GET(req: NextRequest) {
  if (!isImportEnabled()) return NextResponse.json({ ok: false, error: IMPORT_DISABLED_MESSAGE }, { status: 403 });
  if (!isAdminRequestAuthorized(req)) return adminUnauthorizedJson();
  const count = await prisma.patient.count({ where: { matters: { none: {} } } });
  return NextResponse.json({ ok: true, orphans: count });
}

export async function POST(req: NextRequest) {
  if (!isImportEnabled()) return NextResponse.json({ ok: false, error: IMPORT_DISABLED_MESSAGE }, { status: 403 });
  if (!isAdminRequestAuthorized(req)) return adminUnauthorizedJson();
  const del = await prisma.patient.deleteMany({ where: { matters: { none: {} } } });
  return NextResponse.json({ ok: true, removed: del.count });
}
