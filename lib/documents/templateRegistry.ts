export type BarshDocumentTemplateCategory =
  | "settlement"
  | "lawsuit"
  | "direct_matter"
  | "payment"
  | "general";

export type BarshDocumentMergeFieldDefinition = {
  key: string;
  label: string;
  description: string;
  source: "local-settlement-record" | "local-settlement-row" | "local-master-lawsuit" | "reference-data" | "computed";
  required: boolean;
};

export type BarshDocumentTemplateDefinition = {
  key: string;
  label: string;
  category: BarshDocumentTemplateCategory;
  description: string;
  defaultFilenameSuffix: string;
  generationEndpoint: string;
  outputFormat: "docx" | "pdf" | "both";
  sourceOfTruth: "barsh-matters-local";
  requiresFinalizationBeforeDelivery: boolean;
  enabled: boolean;
  mergeFieldSet: string;
  editableInRepository: boolean;
  versioningPlanned: boolean;
};

export const SETTLEMENT_DOCUMENT_TEMPLATES: BarshDocumentTemplateDefinition[] = [
  {
    key: "settlement-summary",
    label: "Settlement Summary",
    category: "settlement",
    description: "Summary of the active local settlement record and settlement totals.",
    defaultFilenameSuffix: "Settlement Summary",
    generationEndpoint: "/api/settlements/settlement-summary",
    outputFormat: "docx",
    sourceOfTruth: "barsh-matters-local",
    requiresFinalizationBeforeDelivery: true,
    enabled: true,
    mergeFieldSet: "settlement",
    editableInRepository: true,
    versioningPlanned: true,
  },
  {
    key: "provider-remittance-breakdown",
    label: "Provider Remittance Breakdown",
    category: "settlement",
    description: "Provider remittance breakdown using local settlement rows, provider fees, and provider net amounts.",
    defaultFilenameSuffix: "Provider Remittance Breakdown",
    generationEndpoint: "/api/settlements/provider-remittance-breakdown",
    outputFormat: "docx",
    sourceOfTruth: "barsh-matters-local",
    requiresFinalizationBeforeDelivery: true,
    enabled: true,
    mergeFieldSet: "settlement",
    editableInRepository: true,
    versioningPlanned: true,
  },
  {
    key: "attorney-fee-breakdown",
    label: "Attorney Fee Breakdown",
    category: "settlement",
    description: "Attorney fee breakdown using local settlement row allocations and fee calculations.",
    defaultFilenameSuffix: "Attorney Fee Breakdown",
    generationEndpoint: "/api/settlements/attorney-fee-breakdown",
    outputFormat: "docx",
    sourceOfTruth: "barsh-matters-local",
    requiresFinalizationBeforeDelivery: true,
    enabled: true,
    mergeFieldSet: "settlement",
    editableInRepository: true,
    versioningPlanned: true,
  },
];

export const SETTLEMENT_MERGE_FIELDS: BarshDocumentMergeFieldDefinition[] = [
  {
    key: "masterLawsuitId",
    label: "Lawsuit ID",
    description: "Local Barsh Matters master lawsuit identifier.",
    source: "local-settlement-record",
    required: true,
  },
  {
    key: "settlementRecordId",
    label: "Settlement Record ID",
    description: "Local settlement record identifier.",
    source: "local-settlement-record",
    required: true,
  },
  {
    key: "settledWith",
    label: "Settled With",
    description: "Settlement contact or entity recorded in Barsh Matters.",
    source: "local-settlement-record",
    required: false,
  },
  {
    key: "settlementDate",
    label: "Settlement Date",
    description: "Date the settlement was recorded or reached.",
    source: "local-settlement-record",
    required: false,
  },
  {
    key: "paymentExpectedDate",
    label: "Payment Due Date",
    description: "Expected payment date used for follow-up ticklers.",
    source: "local-settlement-record",
    required: false,
  },
  {
    key: "provider",
    label: "Provider",
    description: "Provider from the local settlement rows.",
    source: "local-settlement-row",
    required: true,
  },
  {
    key: "patient",
    label: "Patient",
    description: "Patient from the local settlement rows.",
    source: "local-settlement-row",
    required: true,
  },
  {
    key: "insurer",
    label: "Insurer",
    description: "Insurer from the local settlement rows.",
    source: "local-settlement-row",
    required: false,
  },
  {
    key: "claimNumber",
    label: "Claim Number",
    description: "Claim number from the local settlement rows.",
    source: "local-settlement-row",
    required: false,
  },
  {
    key: "grossSettlementAmount",
    label: "Gross Settlement Amount",
    description: "Gross settlement amount recorded locally.",
    source: "local-settlement-record",
    required: true,
  },
  {
    key: "principal",
    label: "Principal",
    description: "Allocated settlement principal total.",
    source: "computed",
    required: false,
  },
  {
    key: "interest",
    label: "Interest",
    description: "Settlement interest total.",
    source: "computed",
    required: false,
  },
  {
    key: "attorneyFee",
    label: "Attorney Fee",
    description: "Total attorney fee calculated from local settlement data.",
    source: "computed",
    required: false,
  },
  {
    key: "providerNet",
    label: "Provider Net",
    description: "Provider net amount after fee calculations.",
    source: "computed",
    required: false,
  },
];

export function mergeFieldsForTemplate(template: BarshDocumentTemplateDefinition) {
  if (template.mergeFieldSet === "settlement") return SETTLEMENT_MERGE_FIELDS;
  return [];
}

export function documentTemplatesForCategory(category?: BarshDocumentTemplateCategory | "all") {
  const allTemplates = [
    ...SETTLEMENT_DOCUMENT_TEMPLATES,
  ];

  return allTemplates.filter((template) => {
    if (!template.enabled) return false;
    if (!category || category === "all") return true;
    return template.category === category;
  });
}

export function templateRepositoryRecords(category?: BarshDocumentTemplateCategory | "all") {
  return documentTemplatesForCategory(category).map((template) => ({
    ...template,
    repositorySource: "barsh-matters-code-registry",
    repositoryStatus: "seed-template",
    editableNow: false,
    editableLater: template.editableInRepository,
    mergeFields: mergeFieldsForTemplate(template),
  }));
}

export function enabledSettlementDocumentTemplates() {
  return SETTLEMENT_DOCUMENT_TEMPLATES.filter((template) => template.enabled);
}

export function buildSettlementPlannedDocuments(params: {
  baseName: string;
  blockingErrors: string[];
  masterLawsuitId: string;
}) {
  const { baseName, blockingErrors, masterLawsuitId } = params;
  const ready = blockingErrors.length === 0;
  const encodedMasterLawsuitId = encodeURIComponent(masterLawsuitId);

  return enabledSettlementDocumentTemplates().map((template) => ({
    key: template.key,
    label: template.label,
    description: template.description,
    filename: `${baseName} - ${template.defaultFilenameSuffix}.docx`,
    status: ready ? "ready-local-settlement-template-docx" : "blocked",
    availableNow: ready,
    wouldGenerate: ready,
    sourceEndpoint: `${template.generationEndpoint}?masterLawsuitId=${encodedMasterLawsuitId}`,
    generationEndpoint: template.generationEndpoint,
    routeOnly: true,
    category: template.category,
    outputFormat: template.outputFormat,
    sourceOfTruth: template.sourceOfTruth,
    requiresFinalizationBeforeDelivery: template.requiresFinalizationBeforeDelivery,
    mergeFieldSet: template.mergeFieldSet,
    templateRepositorySource: "barsh-matters-code-registry",
    templateRepositoryFuture: "database-backed editable template repository",
  }));
}
