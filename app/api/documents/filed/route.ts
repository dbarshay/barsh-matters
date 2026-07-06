import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { fileDocument, type FileDocumentInput } from "@/lib/documents/fileDocument";
import { isAdminRequestAuthorized, adminUnauthorizedJson } from "@/lib/adminAuth";

// Read-only listing of documents FILED into the BM folder tree for a matter (Phase 2).
// The actual files live in Clio; these are BM metadata rows (folderKey/title/fields) pointing at
// clioDocumentId. The tree UI groups these by folderKey against the code taxonomy.
//
//   GET /api/documents/filed?matterId=123[&matterDisplayNumber=BRL_202600001][&level=matter|lawsuit]
// Matches on matterId OR matterDisplayNumber (either is sufficient), so callers that only know the
// BRL file number still resolve the same filed rows regardless of numeric-id ambiguity.
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const matterId = Number(sp.get("matterId"));
  const matterDisplayNumber = (sp.get("matterDisplayNumber") || "").trim();
  const masterLawsuitId = (sp.get("masterLawsuitId") || "").trim();
  const level = sp.get("level");

  const hasMatterId = Number.isFinite(matterId) && matterId > 0;
  if (!hasMatterId && !matterDisplayNumber && !masterLawsuitId) {
    return NextResponse.json(
      { ok: false, error: "matterId, matterDisplayNumber, or masterLawsuitId required" },
      { status: 400 },
    );
  }

  const or: any[] = [];
  if (hasMatterId) or.push({ matterId });
  if (matterDisplayNumber) or.push({ matterDisplayNumber });
  if (masterLawsuitId) or.push({ masterLawsuitId });

  const where: any = { status: "active", OR: or };
  if (level === "matter" || level === "lawsuit") where.level = level;

  const documents = await prisma.filedDocument.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      matterId: true,
      matterDisplayNumber: true,
      masterLawsuitId: true,
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

  return NextResponse.json({
    ok: true,
    matterId: hasMatterId ? matterId : null,
    matterDisplayNumber: matterDisplayNumber || null,
    count: documents.length,
    documents,
  });
}

// File a document into a folder with a controlled title (Phase 3). All the enforcement/dedup/audit
// logic lives in lib/documents/fileDocument.ts so it can be unit-tested headlessly; this handler
// just parses the request and maps the result to an HTTP response.
export async function POST(req: NextRequest) {
  let body: FileDocumentInput;
  try {
    body = (await req.json()) as FileDocumentInput;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const result = await fileDocument(prisma, body);
  if (result.ok) return NextResponse.json({ ok: true, document: result.document });
  return NextResponse.json(
    { ok: false, error: result.error, duplicate: result.duplicate, existing: result.existing },
    { status: result.status },
  );
}

// Remove a filing from the BM tree (archive, reversible). This does NOT touch Clio — it only
// clears the BM metadata pointer, e.g. when the underlying Clio document was deleted and the tree
// is left with an orphaned entry. Admin-gated.
//   DELETE /api/documents/filed?id=<filedDocumentId>
export async function DELETE(req: NextRequest) {
  if (!isAdminRequestAuthorized(req)) return adminUnauthorizedJson();

  const id = (req.nextUrl.searchParams.get("id") || "").trim();
  if (!id) {
    return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });
  }

  const existing = await prisma.filedDocument.findUnique({ where: { id }, select: { id: true, titleLabel: true } });
  if (!existing) {
    return NextResponse.json({ ok: false, error: "Filing not found." }, { status: 404 });
  }

  await prisma.filedDocument.update({ where: { id }, data: { status: "archived" } });
  return NextResponse.json({ ok: true, removed: { id, titleLabel: existing.titleLabel } });
}
