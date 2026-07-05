import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

// Read-only listing of documents FILED into the BM folder tree for a matter (Phase 2).
// The actual files live in Clio; these are BM metadata rows (folderKey/title/fields) pointing at
// clioDocumentId. The tree UI groups these by folderKey against the code taxonomy.
//
//   GET /api/documents/filed?matterId=123[&level=matter|lawsuit]
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const matterId = Number(sp.get("matterId"));
  const level = sp.get("level");

  if (!Number.isFinite(matterId) || matterId <= 0) {
    return NextResponse.json({ ok: false, error: "matterId (positive integer) required" }, { status: 400 });
  }

  const where: { matterId: number; status: string; level?: string } = { matterId, status: "active" };
  if (level === "matter" || level === "lawsuit") where.level = level;

  const documents = await prisma.filedDocument.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      folderKey: true,
      titleKey: true,
      titleLabel: true,
      freehandTitle: true,
      fields: true,
      level: true,
      clioDocumentId: true,
      fileName: true,
      contentType: true,
      sourceType: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ ok: true, matterId, count: documents.length, documents });
}
