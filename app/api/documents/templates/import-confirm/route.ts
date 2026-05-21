import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  buildTemplateImportPreview,
  normalizeTemplateImportRows,
  safetyTemplateImportConfirm,
  seededTemplateImportRows,
} from "@/lib/documents/templateImport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function metadataFor(row: any) {
  return {
    ...(row.metadata || {}),
    templateSource: row.metadata?.templateSource || row.repositorySource || "barsh-matters-template-import",
    repositoryStatus: row.repositoryStatus,
    productionTemplateReady: Boolean(row.productionTemplateReady),
    finalProductionDocument: Boolean(row.finalProductionDocument),
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    if (body?.confirm !== true) {
      return NextResponse.json(
        {
          ok: false,
          action: "document-template-import-confirm",
          error: "Confirmed document template import requires confirm: true.",
          safety: safetyTemplateImportConfirm(false),
        },
        { status: 400 }
      );
    }

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

    if (!preview.ok) {
      return NextResponse.json(
        {
          ok: false,
          action: "document-template-import-confirm",
          error: "Template import blocked. Resolve invalid rows before confirming import.",
          preview,
          safety: safetyTemplateImportConfirm(false),
        },
        { status: 400 }
      );
    }

    const results: any[] = [];

    await prisma.$transaction(async (tx) => {
      for (const rowPreview of preview.rowPreviews) {
        const row = rowPreview.row;

        const template = await tx.documentTemplate.upsert({
          where: { key: row.key },
          update: {
            label: row.label,
            category: row.category,
            description: row.description || null,
            defaultFilenameSuffix: row.defaultFilenameSuffix || null,
            generationEndpoint: row.generationEndpoint || null,
            outputFormat: row.outputFormat || "docx",
            sourceOfTruth: row.sourceOfTruth || "barsh-matters-local",
            enabled: row.enabled !== false,
            editableInRepository: row.editableInRepository !== false,
            metadata: metadataFor(row),
          },
          create: {
            key: row.key,
            label: row.label,
            category: row.category,
            description: row.description || null,
            defaultFilenameSuffix: row.defaultFilenameSuffix || null,
            generationEndpoint: row.generationEndpoint || null,
            outputFormat: row.outputFormat || "docx",
            sourceOfTruth: row.sourceOfTruth || "barsh-matters-local",
            enabled: row.enabled !== false,
            editableInRepository: row.editableInRepository !== false,
            metadata: metadataFor(row),
          },
        });

        const latestVersion = await tx.documentTemplateVersion.findFirst({
          where: { templateId: template.id },
          orderBy: { versionNumber: "desc" },
          select: { versionNumber: true },
        });

        const versionNumber = latestVersion ? latestVersion.versionNumber + 1 : 1;

        const version = await tx.documentTemplateVersion.create({
          data: {
            templateId: template.id,
            versionNumber,
            status: row.productionTemplateReady ? "production-ready" : "draft",
            bodyFormat: "docx-template",
            storageKind: "metadata-only",
            contentText: null,
            contentJson: {
              importedFrom: mode,
              placeholderSeeded: row.repositorySource === "barsh-matters-code-registry-seed",
              productionTemplateReady: Boolean(row.productionTemplateReady),
              finalProductionDocument: Boolean(row.finalProductionDocument),
            },
            mergeFieldSet: row.mergeFieldSet || null,
          },
        });

        await tx.documentTemplate.update({
          where: { id: template.id },
          data: { currentVersionId: version.id },
        });

        for (const field of row.mergeFields || []) {
          await tx.documentTemplateMergeField.upsert({
            where: {
              templateId_key: {
                templateId: template.id,
                key: field.key,
              },
            },
            update: {
              label: field.label,
              description: field.description || null,
              source: field.source,
              required: Boolean(field.required),
              exampleValue: field.exampleValue || null,
              metadata: field.metadata || {},
            },
            create: {
              templateId: template.id,
              key: field.key,
              label: field.label,
              description: field.description || null,
              source: field.source,
              required: Boolean(field.required),
              exampleValue: field.exampleValue || null,
              metadata: field.metadata || {},
            },
          });
        }

        results.push({
          key: row.key,
          templateId: template.id,
          versionId: version.id,
          versionNumber,
          action: rowPreview.action,
          mergeFieldCount: row.mergeFields?.length || 0,
          productionTemplateReady: Boolean(row.productionTemplateReady),
          finalProductionDocument: Boolean(row.finalProductionDocument),
        });
      }
    });

    return NextResponse.json({
      ok: true,
      action: "document-template-import-confirm",
      localFirst: true,
      sourceOfTruth: "barsh-matters-local-template-repository",
      mode,
      summary: preview.summary,
      results,
      safety: safetyTemplateImportConfirm(true),
      note:
        "Confirmed document template import wrote only local Barsh Matters DocumentTemplate, DocumentTemplateVersion, and DocumentTemplateMergeField rows. It did not upload files, generate documents, write Clio, create drafts, send email, print, or queue documents.",
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        action: "document-template-import-confirm",
        error: error?.message || "Document template import confirm failed.",
        safety: safetyTemplateImportConfirm(false),
      },
      { status: 500 }
    );
  }
}
