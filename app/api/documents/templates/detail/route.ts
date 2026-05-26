import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  BarshDocumentTemplateCategory,
  mergeFieldsForTemplate,
  templateRepositoryRecords,
} from "@/lib/documents/templateRegistry";

function clean(value: unknown): string {
  return String(value || "").trim();
}

function normalizeCategory(value: string): BarshDocumentTemplateCategory | "all" {
  const cleaned = clean(value);
  if (
    cleaned === "settlement" ||
    cleaned === "lawsuit" ||
    cleaned === "direct_matter" ||
    cleaned === "payment" ||
    cleaned === "general" ||
    cleaned === "all"
  ) {
    return cleaned as BarshDocumentTemplateCategory | "all";
  }
  return "all";
}

function safeJsonObject(value: any): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function versionSummary(version: any) {
  const contentText = clean(version?.contentText);
  return {
    id: version?.id || null,
    versionNumber: version?.versionNumber || 0,
    status: version?.status || "",
    bodyFormat: version?.bodyFormat || "",
    storageKind: version?.storageKind || "",
    hasStoredDocx: version?.storageKind === "db-docx-base64" && Boolean(contentText),
    storedDocxBytes:
      version?.storageKind === "db-docx-base64" && contentText
        ? Buffer.from(contentText, "base64").byteLength
        : 0,
    mergeFieldSet: version?.mergeFieldSet || "",
    metadata: safeJsonObject(version?.contentJson),
    createdAt: version?.createdAt || null,
    updatedAt: version?.updatedAt || null,
    storedDocxUrl:
      version?.storageKind === "db-docx-base64" && version?.id
        ? `/api/documents/templates/stored-docx?versionId=${encodeURIComponent(version.id)}`
        : "",
  };
}

function dbTemplateDetail(row: any) {
  const versions = Array.isArray(row?.versions) ? row.versions : [];
  const currentVersion =
    versions.find((version: any) => clean(version.id) === clean(row.currentVersionId)) ||
    versions[0] ||
    null;

  const mergeFields = Array.isArray(row?.mergeFields) ? row.mergeFields : [];

  return {
    key: row.key,
    label: row.label,
    category: row.category,
    description: row.description || "",
    defaultFilenameSuffix: row.defaultFilenameSuffix || "",
    generationEndpoint: row.generationEndpoint || "",
    outputFormat: row.outputFormat || "",
    sourceOfTruth: row.sourceOfTruth || "",
    enabled: Boolean(row.enabled),
    editableInRepository: Boolean(row.editableInRepository),
    currentVersionId: row.currentVersionId || "",
    metadata: safeJsonObject((row as any).metadata),
    repositorySource: "barsh-matters-db",
    repositoryStatus: "database-template",
    currentVersion: currentVersion ? versionSummary(currentVersion) : null,
    versions: versions.map(versionSummary),
    mergeFields: mergeFields.map((field: any) => ({
      id: field.id,
      key: field.key,
      label: field.label,
      description: field.description || "",
      source: field.source || "",
      required: Boolean(field.required),
      exampleValue: field.exampleValue || "",
      metadata: safeJsonObject(field.metadata),
      visibility:
        safeJsonObject(field.metadata).visibility ||
        safeJsonObject(field.metadata).mergeFieldVisibility ||
        "visible_ui",
      createdAt: field.createdAt || null,
      updatedAt: field.updatedAt || null,
    })),
    createdAt: row.createdAt || null,
    updatedAt: row.updatedAt || null,
  };
}

function fallbackTemplateDetail(key: string, category: BarshDocumentTemplateCategory | "all") {
  const row = templateRepositoryRecords(category).find((template: any) => template.key === key);
  if (!row) return null;

  const mergeFields = Array.isArray(row.mergeFields) ? row.mergeFields : mergeFieldsForTemplate(row);

  return {
    ...row,
    repositorySource: "barsh-matters-code-registry-fallback",
    repositoryStatus: "seed-template-fallback",
    currentVersion: null,
    versions: [],
    mergeFields,
    metadata: safeJsonObject((row as any).metadata),
  };
}

function safetyTemplateDetail() {
  return {
    action: "document-template-detail-preview",
    previewOnly: true,
    databaseRecordsChanged: false,
    templateRepositoryWrites: false,
    clioWrites: false,
    graphWrites: false,
    draftsCreated: false,
    emailsSent: false,
    documentsGenerated: false,
    printQueued: false,
  };
}

export async function GET(req: NextRequest) {
  try {
    const key = clean(req.nextUrl.searchParams.get("key"));
    const category = normalizeCategory(req.nextUrl.searchParams.get("category") || "all");

    if (!key) {
      return NextResponse.json(
        {
          ok: false,
          action: "document-template-detail-preview",
          error: "Missing template key.",
          safety: safetyTemplateDetail(),
        },
        { status: 400 }
      );
    }

    const row = await prisma.documentTemplate.findUnique({
      where: { key },
      include: {
        versions: {
          orderBy: [{ versionNumber: "desc" }, { createdAt: "desc" }],
        },
        mergeFields: {
          orderBy: [{ source: "asc" }, { key: "asc" }],
        },
      },
    });

    const template = row ? dbTemplateDetail(row) : fallbackTemplateDetail(key, category);

    if (!template) {
      return NextResponse.json(
        {
          ok: false,
          action: "document-template-detail-preview",
          error: "Template was not found in the database repository or fallback registry.",
          key,
          category,
          safety: safetyTemplateDetail(),
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      action: "document-template-detail-preview",
      sourceOfTruth: "barsh-matters-local-template-repository",
      repositoryMode: "database-first-detail-read-only",
      key,
      category,
      template,
      workflows: {
        replacement:
          "Future replacement workflow should create a new DocumentTemplateVersion row, preserve prior versions, update currentVersionId, and leave document generation/finalization behavior unchanged until explicitly selected.",
        mergeFields:
          "Future merge-field management should preserve visible_ui, hidden_internal, computed, and system visibility metadata while allowing additions and revisions without deleting historical template versions.",
        versioning:
          "Version history is append-only by default: new uploaded DOCX or metadata changes should create the next versionNumber rather than mutating older versions.",
      },
      safety: safetyTemplateDetail(),
      note:
        "Read-only template detail endpoint.  It reads one template, its versions, and merge fields.  It does not edit templates, upload files, generate documents, write Clio, create drafts, send email, print, or queue documents.",
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        action: "document-template-detail-preview",
        error: error?.message || "Document template detail lookup failed.",
        safety: safetyTemplateDetail(),
      },
      { status: 500 }
    );
  }
}
