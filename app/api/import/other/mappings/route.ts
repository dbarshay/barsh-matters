import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isImportEnabled, IMPORT_DISABLED_MESSAGE } from "@/lib/import/importConfig";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Saved column-mapping templates for the generic "other spreadsheet" importer. GET lists them; POST
// upserts one by name; DELETE removes by id. Flag-gated. (Owner governance attaches with RBAC.)

export async function GET() {
  if (!isImportEnabled()) return NextResponse.json({ ok: false, error: IMPORT_DISABLED_MESSAGE }, { status: 403 });
  const mappings = await prisma.importMapping.findMany({
    where: { source: "other" },
    orderBy: { name: "asc" },
    select: { id: true, name: true, mapping: true, fixed: true, updatedAt: true },
  });
  return NextResponse.json({ ok: true, mappings });
}

export async function POST(request: Request) {
  if (!isImportEnabled()) return NextResponse.json({ ok: false, error: IMPORT_DISABLED_MESSAGE }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const name = String(body?.name || "").trim();
  const mapping = body?.mapping ?? {};
  const fixed = body?.fixed ?? {};
  if (!name) return NextResponse.json({ ok: false, error: "name is required." }, { status: 400 });

  const saved = await prisma.importMapping.upsert({
    where: { name },
    update: { mapping, fixed, source: "other" },
    create: { name, mapping, fixed, source: "other" },
    select: { id: true, name: true },
  });
  return NextResponse.json({ ok: true, saved });
}

export async function DELETE(request: Request) {
  if (!isImportEnabled()) return NextResponse.json({ ok: false, error: IMPORT_DISABLED_MESSAGE }, { status: 403 });
  const id = new URL(request.url).searchParams.get("id") || "";
  if (!id) return NextResponse.json({ ok: false, error: "id is required." }, { status: 400 });
  await prisma.importMapping.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
