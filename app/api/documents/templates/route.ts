import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  BarshDocumentTemplateCategory,
  mergeFieldsForTemplate,
  templateRepositoryRecords,
} from "@/lib/documents/templateRegistry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeCategory(value: string): BarshDocumentTemplateCategory | "all" {
  const v = clean(value);
  if (
    v === "settlement" ||
    v === "lawsuit" ||
    v === "direct_matter" ||
    v === "payment" ||
    v === "general"
  ) {
    return v;
  }
  return "all";
}

function safetyDocumentTemplateRepository() {
  return {
    action: "document-template-repository-preview",
    localFirst: true,
    sourceOfTruth: "barsh-matters-local-template-repository",
    dryRun: true,
    previewOnly: true,
    readOnly: true,
    clioRecordsChanged: false,
    databaseRecordsChanged: false,
    documentsGenerated: false,
    persistentFilesCreated: false,
    printQueueChanged: false,
    emailsSent: false,
    templatesEdited: false,
    templateRepositoryWrites: false,
  };
}

function readOnlyDbTemplateToRepositoryRecord(row: any) {
  const currentVersion =
    Array.isArray(row?.versions) && row.versions.length > 0
      ? row.versions[0]
      : null;

  return {
    id: row.id,
    key: row.key,
    label: row.label,
    category: row.category,
    description: row.description || "",
    defaultFilenameSuffix: row.defaultFilenameSuffix || "",
    generationEndpoint: row.generationEndpoint || "",
    outputFormat: row.outputFormat || "docx",
    sourceOfTruth: row.sourceOfTruth || "barsh-matters-local",
    enabled: row.enabled !== false,
    editableInRepository: row.editableInRepository !== false,
    versioningPlanned: true,
    currentVersionId: row.currentVersionId || currentVersion?.id || null,
    currentVersion: currentVersion
      ? {
          id: currentVersion.id,
          versionNumber: currentVersion.versionNumber,
          status: currentVersion.status,
          bodyFormat: currentVersion.bodyFormat,
          storageKind: currentVersion.storageKind,
          hasStoredDocx:
            currentVersion.storageKind === "db-docx-base64" && Boolean(currentVersion.contentText),
          storedDocxBytes:
            currentVersion.storageKind === "db-docx-base64" && currentVersion.contentText
              ? Math.floor((String(currentVersion.contentText).length * 3) / 4)
              : 0,
          uploadedTemplateFile:
            currentVersion.contentJson &&
            typeof currentVersion.contentJson === "object" &&
            !Array.isArray(currentVersion.contentJson)
              ? (currentVersion.contentJson as any).uploadedTemplateFile || null
              : null,
          mergeFieldSet: currentVersion.mergeFieldSet || "",
        }
      : null,
    repositorySource: "barsh-matters-db",
    repositoryStatus: "database-template",
    editableNow: false,
    editableLater: row.editableInRepository !== false,
    mergeFieldSet: currentVersion?.mergeFieldSet || row?.metadata?.mergeFieldSet || "",
    mergeFields: Array.isArray(row?.mergeFields)
      ? row.mergeFields.map((field: any) => ({
          key: field.key,
          label: field.label,
          description: field.description || "",
          source: field.source,
          required: Boolean(field.required),
          exampleValue: field.exampleValue || "",
          metadata: field.metadata || null,
        }))
      : [],
    metadata: row.metadata || null,
  };
}

async function readDatabaseTemplates(category: BarshDocumentTemplateCategory | "all") {
  const where =
    category === "all"
      ? { enabled: true }
      : { enabled: true, category };

  const rows = await prisma.documentTemplate.findMany({
    where,
    orderBy: [
      { category: "asc" },
      { label: "asc" },
      { key: "asc" },
    ],
    include: {
      versions: {
        orderBy: {
          versionNumber: "desc",
        },
        take: 1,
      },
      mergeFields: {
        orderBy: {
          key: "asc",
        },
      },
    },
  });

  return rows.map(readOnlyDbTemplateToRepositoryRecord);
}

function fallbackRegistryTemplates(category: BarshDocumentTemplateCategory | "all") {
  return templateRepositoryRecords(category).map((template: any) => ({
    ...template,
    repositorySource: "barsh-matters-code-registry",
    repositoryStatus: "seed-template-fallback",
    editableNow: false,
    editableLater: Boolean(template.editableLater),
    mergeFields: Array.isArray(template.mergeFields)
      ? template.mergeFields
      : mergeFieldsForTemplate(template),
  }));
}

export async function GET(req: NextRequest) {
  try {
    const category = normalizeCategory(req.nextUrl.searchParams.get("category") || "all");
    const allowFallbackRegistry =
      req.nextUrl.searchParams.get("includeFallbackRegistry") === "1" ||
      process.env.BARSH_DOCUMENT_TEMPLATE_ALLOW_CODE_REGISTRY_FALLBACK === "1";

    let repositorySource = "barsh-matters-db";
    let templates = await readDatabaseTemplates(category);
    let fallbackSuppressed = false;

    if (templates.length === 0 && allowFallbackRegistry) {
      repositorySource = "barsh-matters-code-registry-fallback";
      templates = fallbackRegistryTemplates(category);
    } else if (templates.length === 0) {
      fallbackSuppressed = true;
    }

    return NextResponse.json({
      ok: true,
      action: "document-template-repository-preview",
      localFirst: true,
      sourceOfTruth: "barsh-matters-local-template-repository",
      repositoryMode: "database-ready-read-only",
      repositorySource,
      fallbackSuppressed,
      fallbackRegistryAvailable: templates.length === 0 && fallbackSuppressed,
      fallbackRegistryOptIn: allowFallbackRegistry,
      repositoryFuture: "editable document-template repository with versioning, merge fields, uploaded Word templates, and finalized document vault integration",
      category,
      count: templates.length,
      templates,
      safety: {
        ...safetyDocumentTemplateRepository(),
        databaseTemplateRowsOnlyByDefault: true,
        codeRegistryFallbackHiddenByDefault: true,
        codeRegistryFallbackRequiresExplicitOptIn: true,
      },
      note:
        repositorySource === "barsh-matters-db" && templates.length > 0
          ? "Templates loaded from the local Barsh Matters database repository."
          : repositorySource === "barsh-matters-code-registry-fallback"
            ? "Fallback registry templates are shown because includeFallbackRegistry=1 or BARSH_DOCUMENT_TEMPLATE_ALLOW_CODE_REGISTRY_FALLBACK=1 was explicitly provided."
            : "No database templates exist for this category. Code-registry fallback templates are hidden by default after test template cleanup.",
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        action: "document-template-repository-preview",
        localFirst: true,
        sourceOfTruth: "barsh-matters-local-template-repository",
        error: error?.message || "Document template repository preview failed.",
        safety: safetyDocumentTemplateRepository(),
      },
      { status: 500 }
    );
  }
}
