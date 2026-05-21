import {
  BarshDocumentTemplateCategory,
  templateRepositoryRecords,
} from "@/lib/documents/templateRegistry";

export type TemplateImportRow = {
  key: string;
  label: string;
  category: BarshDocumentTemplateCategory;
  description?: string;
  defaultFilenameSuffix?: string;
  generationEndpoint?: string;
  outputFormat?: string;
  sourceOfTruth?: string;
  enabled?: boolean;
  editableInRepository?: boolean;
  mergeFieldSet?: string;
  repositorySource?: string;
  repositoryStatus?: string;
  productionTemplateReady?: boolean;
  finalProductionDocument?: boolean;
  metadata?: Record<string, unknown>;
  mergeFields?: Array<{
    key: string;
    label: string;
    description?: string;
    source: string;
    required?: boolean;
    exampleValue?: string;
    metadata?: Record<string, unknown>;
  }>;
};

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function bool(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  const text = clean(value).toLowerCase();
  if (!text) return fallback;
  return ["true", "1", "yes", "y"].includes(text);
}

function category(value: unknown): BarshDocumentTemplateCategory {
  const text = clean(value);
  if (text === "settlement" || text === "lawsuit" || text === "direct_matter" || text === "payment" || text === "general") {
    return text;
  }
  return "general";
}

export function safetyTemplateImportPreview() {
  return {
    action: "document-template-import-preview",
    localFirst: true,
    sourceOfTruth: "barsh-matters-local-template-repository",
    previewOnly: true,
    databaseRecordsChanged: false,
    templateRepositoryWrites: false,
    clioRecordsChanged: false,
    documentsGenerated: false,
    persistentFilesCreated: false,
    printQueueChanged: false,
    emailsSent: false,
    productionTemplateReadinessChanged: false,
  };
}

export function safetyTemplateImportConfirm(databaseRecordsChanged = true) {
  return {
    action: "document-template-import-confirm",
    localFirst: true,
    sourceOfTruth: "barsh-matters-local-template-repository",
    previewOnly: false,
    databaseRecordsChanged,
    templateRepositoryWrites: databaseRecordsChanged,
    clioRecordsChanged: false,
    documentsGenerated: false,
    persistentFilesCreated: false,
    printQueueChanged: false,
    emailsSent: false,
    productionTemplateReadinessChanged: databaseRecordsChanged,
  };
}

export function normalizeTemplateImportRows(inputRows: unknown[]): TemplateImportRow[] {
  return inputRows
    .filter((row) => row && typeof row === "object" && !Array.isArray(row))
    .map((row: any) => ({
      key: clean(row.key),
      label: clean(row.label || row.key),
      category: category(row.category),
      description: clean(row.description),
      defaultFilenameSuffix: clean(row.defaultFilenameSuffix || row.default_filename_suffix),
      generationEndpoint: clean(row.generationEndpoint || row.generation_endpoint),
      outputFormat: clean(row.outputFormat || row.output_format || "docx") || "docx",
      sourceOfTruth: clean(row.sourceOfTruth || row.source_of_truth || "barsh-matters-local") || "barsh-matters-local",
      enabled: row.enabled == null ? true : bool(row.enabled, true),
      editableInRepository: row.editableInRepository == null ? true : bool(row.editableInRepository, true),
      mergeFieldSet: clean(row.mergeFieldSet || row.merge_field_set),
      repositorySource: clean(row.repositorySource || row.repository_source || "barsh-matters-template-import"),
      repositoryStatus: clean(row.repositoryStatus || row.repository_status || "imported-template"),
      productionTemplateReady: bool(row.productionTemplateReady ?? row.production_template_ready, false),
      finalProductionDocument: bool(row.finalProductionDocument ?? row.final_production_document, false),
      metadata:
        row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
          ? row.metadata
          : {},
      mergeFields: Array.isArray(row.mergeFields)
        ? row.mergeFields
            .filter((field: any) => field && typeof field === "object" && !Array.isArray(field))
            .map((field: any) => ({
              key: clean(field.key),
              label: clean(field.label || field.key),
              description: clean(field.description),
              source: clean(field.source || "manual-template-import"),
              required: bool(field.required, false),
              exampleValue: clean(field.exampleValue || field.example_value),
              metadata:
                field.metadata && typeof field.metadata === "object" && !Array.isArray(field.metadata)
                  ? field.metadata
                  : {},
            }))
            .filter((field: any) => field.key)
        : [],
    }))
    .filter((row) => row.key);
}

export function seededTemplateImportRows(category?: BarshDocumentTemplateCategory | "all"): TemplateImportRow[] {
  return templateRepositoryRecords(category || "all").map((row: any) => ({
    key: row.key,
    label: row.label,
    category: row.category,
    description: row.description,
    defaultFilenameSuffix: row.defaultFilenameSuffix,
    generationEndpoint: row.generationEndpoint,
    outputFormat: row.outputFormat,
    sourceOfTruth: row.sourceOfTruth,
    enabled: row.enabled !== false,
    editableInRepository: row.editableLater !== false,
    mergeFieldSet: row.mergeFieldSet,
    repositorySource: "barsh-matters-code-registry-seed",
    repositoryStatus: "placeholder-seeded-import",
    productionTemplateReady: false,
    finalProductionDocument: false,
    metadata: {
      templateSource: "placeholder-seeded",
      productionTemplateReady: false,
      finalProductionDocument: false,
      note: "Seeded placeholder template record. This is not a final production template/document.",
    },
    mergeFields: Array.isArray(row.mergeFields) ? row.mergeFields : [],
  }));
}

export function buildTemplateImportPreview(params: {
  rows: TemplateImportRow[];
  existingKeys: Set<string>;
}) {
  const seen = new Set<string>();
  const rowPreviews = params.rows.map((row, index) => {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!row.key) errors.push("Missing template key.");
    if (!row.label) errors.push("Missing template label.");
    if (seen.has(row.key)) errors.push("Duplicate template key in import payload.");
    if (params.existingKeys.has(row.key)) warnings.push("Template key already exists and will be updated.");
    if (row.finalProductionDocument && !row.productionTemplateReady) {
      errors.push("finalProductionDocument cannot be true unless productionTemplateReady is true.");
    }

    seen.add(row.key);

    return {
      rowNumber: index + 1,
      key: row.key,
      label: row.label,
      category: row.category,
      action: params.existingKeys.has(row.key) ? "update" : "create",
      valid: errors.length === 0,
      errors,
      warnings,
      productionTemplateReady: row.productionTemplateReady,
      finalProductionDocument: row.finalProductionDocument,
      mergeFieldCount: row.mergeFields?.length || 0,
      row,
    };
  });

  const invalidRows = rowPreviews.filter((row) => !row.valid).length;
  const createRows = rowPreviews.filter((row) => row.valid && row.action === "create").length;
  const updateRows = rowPreviews.filter((row) => row.valid && row.action === "update").length;

  return {
    ok: invalidRows === 0,
    summary: {
      totalRows: rowPreviews.length,
      validRows: rowPreviews.length - invalidRows,
      invalidRows,
      rowsToCreate: createRows,
      rowsToUpdate: updateRows,
      productionReadyRows: rowPreviews.filter((row) => row.productionTemplateReady).length,
      finalProductionRows: rowPreviews.filter((row) => row.finalProductionDocument).length,
    },
    rowPreviews,
  };
}
