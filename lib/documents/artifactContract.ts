export type BarshDocumentTemplateSource =
  | "placeholder-seeded"
  | "template-repository-db"
  | "uploaded-production-template"
  | "external-generated"
  | "unknown";

export type BarshDocumentArtifactKind =
  | "placeholder-seeded-generated-docx-route"
  | "template-repository-generated-docx-route"
  | "finalized-docx-file"
  | "finalized-pdf-file"
  | "external-document-reference"
  | "metadata-only-placeholder";

export type BarshDocumentWorkflowSource =
  | "settlement"
  | "master-lawsuit"
  | "direct-matter"
  | "payment"
  | "general";

export type BarshDocumentArtifactContractInput = {
  artifactKind: BarshDocumentArtifactKind;
  workflowSource: BarshDocumentWorkflowSource;
  templateSource: BarshDocumentTemplateSource;
  templateKey: string;
  templateLabel?: string | null;
  templateId?: string | null;
  templateVersionId?: string | null;
  productionTemplateReady?: boolean;
  finalProductionDocument?: boolean;
  outputFormat?: "docx" | "pdf" | "both" | "unknown";
  filename?: string | null;
  contentType?: string | null;
  generationEndpoint?: string | null;
  downloadUrl?: string | null;
  persistentFileCreated?: boolean;
  finalizedPdfGenerated?: boolean;
  pdfDownloadUrl?: string | null;
  routeBackedArtifact?: boolean;
  emailAttachmentReady?: boolean;
  printableFileReady?: boolean;
  clioUploaded?: boolean;
  clioDocumentId?: string | null;
  clioDocumentName?: string | null;
  clioDocumentVersionUuid?: string | null;
  notes?: string | null;
  metadata?: Record<string, unknown> | null;
};

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

export function buildDocumentArtifactContract(input: BarshDocumentArtifactContractInput) {
  const artifactKind = input.artifactKind || "metadata-only-placeholder";
  const templateSource = input.templateSource || "unknown";
  const outputFormat = input.outputFormat || "unknown";
  const downloadUrl = clean(input.downloadUrl);
  const pdfDownloadUrl = clean(input.pdfDownloadUrl);

  const productionTemplateReady = Boolean(input.productionTemplateReady);
  const finalProductionDocument = Boolean(input.finalProductionDocument);

  return {
    contractVersion: 1,
    artifactKind,
    workflowSource: input.workflowSource,
    templateSource,
    templateKey: clean(input.templateKey),
    templateLabel: clean(input.templateLabel),
    templateId: clean(input.templateId) || null,
    templateVersionId: clean(input.templateVersionId) || null,
    productionTemplateReady,
    finalProductionDocument,
    outputFormat,
    filename: clean(input.filename) || null,
    contentType: clean(input.contentType) || contentTypeForOutputFormat(outputFormat),
    generationEndpoint: clean(input.generationEndpoint) || null,
    downloadUrl: downloadUrl || null,
    routeBackedArtifact: Boolean(input.routeBackedArtifact ?? downloadUrl),
    persistentFileCreated: Boolean(input.persistentFileCreated),
    finalizedPdfGenerated: Boolean(input.finalizedPdfGenerated),
    pdfDownloadUrl: pdfDownloadUrl || null,
    emailAttachmentReady: Boolean(input.emailAttachmentReady),
    printableFileReady: Boolean(input.printableFileReady),
    clioUploaded: Boolean(input.clioUploaded),
    clioDocumentId: clean(input.clioDocumentId) || null,
    clioDocumentName: clean(input.clioDocumentName) || null,
    clioDocumentVersionUuid: clean(input.clioDocumentVersionUuid) || null,
    deliveryReadiness: {
      canPreviewDocxRoute: Boolean(downloadUrl),
      canAttachToEmail: Boolean(input.emailAttachmentReady),
      canPrintDirectly: Boolean(input.printableFileReady),
      canSendToPrintQueue: Boolean(input.persistentFileCreated || downloadUrl),
      canUploadToClioVault: Boolean(input.persistentFileCreated || downloadUrl),
    },
    safety: {
      placeholderOnly: templateSource === "placeholder-seeded" || !finalProductionDocument,
      noPdfPretended: !input.finalizedPdfGenerated && !pdfDownloadUrl,
      noProductionTemplatePretended: !productionTemplateReady || !finalProductionDocument,
      noClioUploadPretended: !input.clioUploaded,
      noEmailAttachmentPretended: !input.emailAttachmentReady,
      noPrintReadyPdfPretended: !input.printableFileReady,
    },
    notes: clean(input.notes) || null,
    metadata: input.metadata && typeof input.metadata === "object" && !Array.isArray(input.metadata)
      ? input.metadata
      : null,
  };
}

export function buildPlaceholderSeededDocxRouteArtifact(input: {
  workflowSource: BarshDocumentWorkflowSource;
  templateKey: string;
  templateLabel?: string | null;
  filename?: string | null;
  generationEndpoint?: string | null;
  downloadUrl?: string | null;
  metadata?: Record<string, unknown> | null;
}) {
  return buildDocumentArtifactContract({
    artifactKind: "placeholder-seeded-generated-docx-route",
    workflowSource: input.workflowSource,
    templateSource: "placeholder-seeded",
    templateKey: input.templateKey,
    templateLabel: input.templateLabel,
    productionTemplateReady: false,
    finalProductionDocument: false,
    outputFormat: "docx",
    filename: input.filename,
    contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    generationEndpoint: input.generationEndpoint,
    downloadUrl: input.downloadUrl,
    routeBackedArtifact: Boolean(input.downloadUrl),
    persistentFileCreated: false,
    finalizedPdfGenerated: false,
    pdfDownloadUrl: null,
    emailAttachmentReady: false,
    printableFileReady: false,
    clioUploaded: false,
    notes:
      "Placeholder-seeded DOCX route artifact for testing document workflow. This is not a final production template/document.",
    metadata: input.metadata,
  });
}

export function buildTemplateRepositoryDocxRouteArtifact(input: {
  workflowSource: BarshDocumentWorkflowSource;
  templateKey: string;
  templateLabel?: string | null;
  templateId?: string | null;
  templateVersionId?: string | null;
  productionTemplateReady: boolean;
  finalProductionDocument: boolean;
  filename?: string | null;
  generationEndpoint?: string | null;
  downloadUrl?: string | null;
  metadata?: Record<string, unknown> | null;
}) {
  return buildDocumentArtifactContract({
    artifactKind: "template-repository-generated-docx-route",
    workflowSource: input.workflowSource,
    templateSource: "template-repository-db",
    templateKey: input.templateKey,
    templateLabel: input.templateLabel,
    templateId: input.templateId,
    templateVersionId: input.templateVersionId,
    productionTemplateReady: input.productionTemplateReady,
    finalProductionDocument: input.finalProductionDocument,
    outputFormat: "docx",
    filename: input.filename,
    contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    generationEndpoint: input.generationEndpoint,
    downloadUrl: input.downloadUrl,
    routeBackedArtifact: Boolean(input.downloadUrl),
    persistentFileCreated: false,
    finalizedPdfGenerated: false,
    pdfDownloadUrl: null,
    emailAttachmentReady: false,
    printableFileReady: false,
    clioUploaded: false,
    notes:
      input.finalProductionDocument
        ? "Template repository DOCX route artifact from a production-ready template."
        : "Template repository DOCX route artifact from a non-production or draft template.",
    metadata: input.metadata,
  });
}

export function contentTypeForOutputFormat(outputFormat: string) {
  if (outputFormat === "docx") {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }

  if (outputFormat === "pdf") {
    return "application/pdf";
  }

  return null;
}
