import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  buildTemplateImportPreview,
  normalizeTemplateImportRows,
  safetyTemplateImportPreview,
  seededTemplateImportRows,
} from "@/lib/documents/templateImport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const mode = String(body?.mode || "rows").trim();
    const rows = mode === "seeded"
      ? seededTemplateImportRows(body?.category || "all")
      : normalizeTemplateImportRows(Array.isArray(body?.rows) ? body.rows : []);

    const existing = await prisma.documentTemplate.findMany({
      where: {
        key: {
          in: rows.map((row) => row.key),
        },
      },
      select: {
        key: true,
      },
    });

    const preview = buildTemplateImportPreview({
      rows,
      existingKeys: new Set(existing.map((row) => row.key)),
    });

    return NextResponse.json({
      action: "document-template-import-preview",
      localFirst: true,
      previewOnly: true,
      sourceOfTruth: "barsh-matters-local-template-repository",
      mode,
      ...preview,
      safety: safetyTemplateImportPreview(),
      note:
        "Preview-only document template import. It validates template rows and existing keys but does not write DocumentTemplate, DocumentTemplateVersion, DocumentTemplateMergeField, Clio, documents, print queue, drafts, or email.",
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        action: "document-template-import-preview",
        error: error?.message || "Document template import preview failed.",
        safety: safetyTemplateImportPreview(),
      },
      { status: 500 }
    );
  }
}
