export type TemplateBuilderMergeFieldKind = "canonical" | "signatureHeader" | "customManual";

export type TemplateBuilderFieldType = "Text" | "Date" | "Amount" | "Number";

export type TemplateBuilderFormatModifier =
  | "upper"
  | "lower"
  | "title"
  | "date:MM/DD/YYYY"
  | "date:Month D, YYYY"
  | "currency"
  | "bold"
  | "italic"
  | "underline";

export type TemplateBuilderCategory = {
  id: string;
  label: string;
  fixed?: boolean;
  deletable: boolean;
  renamable: boolean;
  appearsLast?: boolean;
  subcategories?: TemplateBuilderCategory[];
};

export type TemplateBuilderMergeFieldDefinition = {
  kind: TemplateBuilderMergeFieldKind;
  category: string;
  subcategory?: string;
  fieldLabel: string;
  mergeField: string;
  exampleOutput: string;
  aliases: string[];
  fieldType: TemplateBuilderFieldType;
  compatibleModifiers: TemplateBuilderFormatModifier[];
  uiLabelEditable: boolean;
  uiCategoryEditable: boolean;
  tokenEditable: boolean;
};

export type TemplateBuilderCustomPlaceholderDefinition = {
  category: string;
  fieldLabel: string;
  mergeFieldToken: string;
  generationPrompt: string;
  exampleValue: string;
  required: boolean;
  fieldType: TemplateBuilderFieldType;
};

export const TEMPLATE_BUILDER_GENERAL_CATEGORY_ID = "general" as const;

export const TEMPLATE_BUILDER_STARTING_CATEGORIES: TemplateBuilderCategory[] = [
  {
    id: "matter",
    label: "Matter",
    deletable: true,
    renamable: true,
  },
  {
    id: "people",
    label: "People",
    deletable: true,
    renamable: true,
    subcategories: [
      {
        id: "signature-header",
        label: "Signature/Header",
        deletable: true,
        renamable: true,
      },
    ],
  },
  {
    id: TEMPLATE_BUILDER_GENERAL_CATEGORY_ID,
    label: "General",
    fixed: true,
    deletable: false,
    renamable: false,
    appearsLast: true,
  },
];

export const TEMPLATE_BUILDER_SUPPORTED_FORMAT_MODIFIERS: TemplateBuilderFormatModifier[] = [
  "upper",
  "lower",
  "title",
  "date:MM/DD/YYYY",
  "date:Month D, YYYY",
  "currency",
  "bold",
  "italic",
  "underline",
];

export const TEMPLATE_BUILDER_CANONICAL_MERGE_FIELDS: TemplateBuilderMergeFieldDefinition[] = [
  {
    kind: "canonical",
    category: "Matter",
    fieldLabel: "Matter File Number",
    mergeField: "{{matter.fileNumber}}",
    exampleOutput: "BRL_202600003",
    aliases: ["matter id", "file number", "BM number", "BRL number"],
    fieldType: "Text",
    compatibleModifiers: ["upper", "lower", "title", "bold", "italic", "underline"],
    uiLabelEditable: true,
    uiCategoryEditable: true,
    tokenEditable: false,
  },
  {
    kind: "canonical",
    category: "Matter",
    fieldLabel: "Provider Name",
    mergeField: "{{matter.providerName}}",
    exampleOutput: "Atlantic Medical & Diagnostic, P.C.",
    aliases: ["client", "medical provider", "provider"],
    fieldType: "Text",
    compatibleModifiers: ["upper", "lower", "title", "bold", "italic", "underline"],
    uiLabelEditable: true,
    uiCategoryEditable: true,
    tokenEditable: false,
  },
  {
    kind: "canonical",
    category: "Matter",
    fieldLabel: "Patient Name",
    mergeField: "{{matter.patientName}}",
    exampleOutput: "David Barshay",
    aliases: ["claimant", "assignor", "patient"],
    fieldType: "Text",
    compatibleModifiers: ["upper", "lower", "title", "bold", "italic", "underline"],
    uiLabelEditable: true,
    uiCategoryEditable: true,
    tokenEditable: false,
  },
  {
    kind: "canonical",
    category: "Matter",
    fieldLabel: "Claim Number",
    mergeField: "{{matter.claimNumber}}",
    exampleOutput: "123456",
    aliases: ["claim", "insurer claim", "carrier claim"],
    fieldType: "Text",
    compatibleModifiers: ["upper", "lower", "bold", "italic", "underline"],
    uiLabelEditable: true,
    uiCategoryEditable: true,
    tokenEditable: false,
  },
  {
    kind: "canonical",
    category: "Matter",
    fieldLabel: "Billed Amount",
    mergeField: "{{matter.billedAmount}}",
    exampleOutput: "$1,234.56",
    aliases: ["bill", "amount billed", "charges"],
    fieldType: "Amount",
    compatibleModifiers: ["currency", "bold", "italic", "underline"],
    uiLabelEditable: true,
    uiCategoryEditable: true,
    tokenEditable: false,
  },
  {
    kind: "signatureHeader",
    category: "People",
    subcategory: "Signature/Header",
    fieldLabel: "Signature Phone Line",
    mergeField: "{{signature.phoneLine}}",
    exampleOutput: "Usage note: DOCX hard-codes Tel:. Token renders firm main number plus selected signer extension when present.",
    aliases: ["phone", "tel", "telephone", "extension", "header phone"],
    fieldType: "Text",
    compatibleModifiers: ["bold", "italic", "underline"],
    uiLabelEditable: true,
    uiCategoryEditable: true,
    tokenEditable: false,
  },
  {
    kind: "signatureHeader",
    category: "People",
    subcategory: "Signature/Header",
    fieldLabel: "Signature Fax Number",
    mergeField: "{{signature.faxNumber}}",
    exampleOutput: "Usage note: DOCX hard-codes Fax:. Token renders selected signer fax, or firm default.",
    aliases: ["fax", "facsimile", "header fax"],
    fieldType: "Text",
    compatibleModifiers: ["bold", "italic", "underline"],
    uiLabelEditable: true,
    uiCategoryEditable: true,
    tokenEditable: false,
  },
  {
    kind: "signatureHeader",
    category: "People",
    subcategory: "Signature/Header",
    fieldLabel: "Signature Email",
    mergeField: "{{signature.email}}",
    exampleOutput: "Usage note: DOCX hard-codes Email:. Token renders selected signer email, or firm default.",
    aliases: ["email", "mail", "header email"],
    fieldType: "Text",
    compatibleModifiers: ["lower", "bold", "italic", "underline"],
    uiLabelEditable: true,
    uiCategoryEditable: true,
    tokenEditable: false,
  },
  {
    kind: "signatureHeader",
    category: "People",
    subcategory: "Signature/Header",
    fieldLabel: "Signature Image",
    mergeField: "{{signature.image}}",
    exampleOutput: "Usage note: renders the selected signer PNG signature image when available and otherwise removes token text.",
    aliases: ["signature image", "signature png", "signer image"],
    fieldType: "Text",
    compatibleModifiers: [],
    uiLabelEditable: true,
    uiCategoryEditable: true,
    tokenEditable: false,
  },
  {
    kind: "signatureHeader",
    category: "People",
    subcategory: "Signature/Header",
    fieldLabel: "Signature Name",
    mergeField: "{{signature.name}}",
    exampleOutput: "Usage note: renders selected signer signatureBlockName, or Barshay, Rizzo & Lopez, PLLC for Firm.",
    aliases: ["signature name", "signer name", "closing name"],
    fieldType: "Text",
    compatibleModifiers: ["upper", "lower", "title", "bold", "italic", "underline"],
    uiLabelEditable: true,
    uiCategoryEditable: true,
    tokenEditable: false,
  },
  {
    kind: "signatureHeader",
    category: "People",
    subcategory: "Signature/Header",
    fieldLabel: "Signature Block",
    mergeField: "{{signature.block}}",
    exampleOutput: "Usage note: renders image if available followed by signature name. Spacing is controlled by the Word template. Not marked Recommended.",
    aliases: ["signature block", "combined signature", "closing block"],
    fieldType: "Text",
    compatibleModifiers: [],
    uiLabelEditable: true,
    uiCategoryEditable: true,
    tokenEditable: false,
  },

  {
    kind: "canonical",
    category: "Matter",
    fieldLabel: "Provider Tax ID",
    mergeField: "{{provider.taxId}}",
    exampleOutput: "11-1111111",
    aliases: ["provider tax id", "tin"],
    fieldType: "Text",
    compatibleModifiers: ["upper", "lower", "title", "bold", "italic", "underline"],
    uiLabelEditable: true,
    uiCategoryEditable: true,
    tokenEditable: false,
  },
  {
    kind: "canonical",
    category: "Matter",
    fieldLabel: "Treating Provider",
    mergeField: "{{treatingProvider.name}}",
    exampleOutput: "David J Weiss",
    aliases: ["treating provider", "doctor"],
    fieldType: "Text",
    compatibleModifiers: ["upper", "lower", "title", "bold", "italic", "underline"],
    uiLabelEditable: true,
    uiCategoryEditable: true,
    tokenEditable: false,
  },
  {
    kind: "canonical",
    category: "Matter",
    fieldLabel: "Insurer",
    mergeField: "{{insurer.name}}",
    exampleOutput: "Allstate Indemnity Company",
    aliases: ["insurer", "carrier"],
    fieldType: "Text",
    compatibleModifiers: ["upper", "lower", "title", "bold", "italic", "underline"],
    uiLabelEditable: true,
    uiCategoryEditable: true,
    tokenEditable: false,
  },
  {
    kind: "canonical",
    category: "Matter",
    fieldLabel: "Insurer Street",
    mergeField: "{{insurer.hidden_street}}",
    exampleOutput: "445 Broadhollow Road",
    aliases: ["insurer hidden street"],
    fieldType: "Text",
    compatibleModifiers: ["upper", "lower", "title", "bold", "italic", "underline"],
    uiLabelEditable: true,
    uiCategoryEditable: true,
    tokenEditable: false,
  },
  {
    kind: "canonical",
    category: "Matter",
    fieldLabel: "Insurer City",
    mergeField: "{{insurer.hidden_city}}",
    exampleOutput: "Melville",
    aliases: ["insurer hidden city"],
    fieldType: "Text",
    compatibleModifiers: ["upper", "lower", "title", "bold", "italic", "underline"],
    uiLabelEditable: true,
    uiCategoryEditable: true,
    tokenEditable: false,
  },
  {
    kind: "canonical",
    category: "Matter",
    fieldLabel: "Insurer State",
    mergeField: "{{insurer.hidden_state}}",
    exampleOutput: "NY",
    aliases: ["insurer hidden state"],
    fieldType: "Text",
    compatibleModifiers: ["upper", "lower", "title", "bold", "italic", "underline"],
    uiLabelEditable: true,
    uiCategoryEditable: true,
    tokenEditable: false,
  },
  {
    kind: "canonical",
    category: "Matter",
    fieldLabel: "Insurer Zipcode",
    mergeField: "{{insurer.hidden_zipcode}}",
    exampleOutput: "11747",
    aliases: ["insurer hidden zipcode"],
    fieldType: "Text",
    compatibleModifiers: ["upper", "lower", "title", "bold", "italic", "underline"],
    uiLabelEditable: true,
    uiCategoryEditable: true,
    tokenEditable: false,
  },
  {
    kind: "canonical",
    category: "Matter",
    fieldLabel: "Claim Number",
    mergeField: "{{claim.number}}",
    exampleOutput: "1111",
    aliases: ["claim number"],
    fieldType: "Text",
    compatibleModifiers: ["upper", "lower", "title", "bold", "italic", "underline"],
    uiLabelEditable: true,
    uiCategoryEditable: true,
    tokenEditable: false,
  },
  {
    kind: "canonical",
    category: "Matter",
    fieldLabel: "Policy Number",
    mergeField: "{{claim.policyNumber}}",
    exampleOutput: "POL-12345",
    aliases: ["policy number"],
    fieldType: "Text",
    compatibleModifiers: ["upper", "lower", "title", "bold", "italic", "underline"],
    uiLabelEditable: true,
    uiCategoryEditable: true,
    tokenEditable: false,
  },
  {
    kind: "canonical",
    category: "Matter",
    fieldLabel: "Date Of Loss",
    mergeField: "{{claim.dateOfLoss}}",
    exampleOutput: "01/01/2021",
    aliases: ["date of loss", "dol"],
    fieldType: "Date",
    compatibleModifiers: ["date:MM/DD/YYYY", "date:Month D, YYYY", "bold", "italic", "underline"],
    uiLabelEditable: true,
    uiCategoryEditable: true,
    tokenEditable: false,
  },
  {
    kind: "canonical",
    category: "Matter",
    fieldLabel: "Date Of Service",
    mergeField: "{{claim.dateOfService}}",
    exampleOutput: "01/16/2021",
    aliases: ["date of service", "dos"],
    fieldType: "Date",
    compatibleModifiers: ["date:MM/DD/YYYY", "date:Month D, YYYY", "bold", "italic", "underline"],
    uiLabelEditable: true,
    uiCategoryEditable: true,
    tokenEditable: false,
  },
  {
    kind: "canonical",
    category: "Matter",
    fieldLabel: "Claim Amount",
    mergeField: "{{claim.amount}}",
    exampleOutput: "$562.25",
    aliases: ["claim amount", "billed amount"],
    fieldType: "Amount",
    compatibleModifiers: ["currency", "bold", "italic", "underline"],
    uiLabelEditable: true,
    uiCategoryEditable: true,
    tokenEditable: false,
  },
  {
    kind: "canonical",
    category: "Matter",
    fieldLabel: "Claim Balance",
    mergeField: "{{claim.balance}}",
    exampleOutput: "$562.25",
    aliases: ["claim balance"],
    fieldType: "Amount",
    compatibleModifiers: ["currency", "bold", "italic", "underline"],
    uiLabelEditable: true,
    uiCategoryEditable: true,
    tokenEditable: false,
  },
  {
    kind: "canonical",
    category: "Matter",
    fieldLabel: "Claim Payments",
    mergeField: "{{claim.payments}}",
    exampleOutput: "$0.00",
    aliases: ["claim payments"],
    fieldType: "Amount",
    compatibleModifiers: ["currency", "bold", "italic", "underline"],
    uiLabelEditable: true,
    uiCategoryEditable: true,
    tokenEditable: false,
  },
  {
    kind: "canonical",
    category: "Matter",
    fieldLabel: "Denial Reason",
    mergeField: "{{claim.denialReason}}",
    exampleOutput: "Medical Necessity",
    aliases: ["denial reason"],
    fieldType: "Text",
    compatibleModifiers: ["upper", "lower", "title", "bold", "italic", "underline"],
    uiLabelEditable: true,
    uiCategoryEditable: true,
    tokenEditable: false,
  },
  {
    kind: "canonical",
    category: "Matter",
    fieldLabel: "Index / AAA Number",
    mergeField: "{{lawsuit.indexNumber}}",
    exampleOutput: "123444/2026",
    aliases: ["index number", "aaa number"],
    fieldType: "Text",
    compatibleModifiers: ["upper", "lower", "title", "bold", "italic", "underline"],
    uiLabelEditable: true,
    uiCategoryEditable: true,
    tokenEditable: false,
  },
  {
    kind: "canonical",
    category: "Matter",
    fieldLabel: "Court",
    mergeField: "{{lawsuit.court}}",
    exampleOutput: "Nassau District-Hempstead (2nd)",
    aliases: ["court"],
    fieldType: "Text",
    compatibleModifiers: ["upper", "lower", "title", "bold", "italic", "underline"],
    uiLabelEditable: true,
    uiCategoryEditable: true,
    tokenEditable: false,
  },
  {
    kind: "canonical",
    category: "Matter",
    fieldLabel: "Adversary Attorney",
    mergeField: "{{lawsuit.adversaryAttorney}}",
    exampleOutput: "Martyn, Smith, Murray & Yong, Esqs.",
    aliases: ["adversary attorney"],
    fieldType: "Text",
    compatibleModifiers: ["upper", "lower", "title", "bold", "italic", "underline"],
    uiLabelEditable: true,
    uiCategoryEditable: true,
    tokenEditable: false,
  },
  {
    kind: "canonical",
    category: "Matter",
    fieldLabel: "Date Filed",
    mergeField: "{{lawsuit.dateFiled}}",
    exampleOutput: "06/01/2026",
    aliases: ["date filed"],
    fieldType: "Date",
    compatibleModifiers: ["date:MM/DD/YYYY", "date:Month D, YYYY", "bold", "italic", "underline"],
    uiLabelEditable: true,
    uiCategoryEditable: true,
    tokenEditable: false,
  },
  {
    kind: "canonical",
    category: "Matter",
    fieldLabel: "Lawsuit Amount",
    mergeField: "{{lawsuit.amount}}",
    exampleOutput: "$1,261.75",
    aliases: ["lawsuit amount"],
    fieldType: "Amount",
    compatibleModifiers: ["currency", "bold", "italic", "underline"],
    uiLabelEditable: true,
    uiCategoryEditable: true,
    tokenEditable: false,
  },
  {
    kind: "canonical",
    category: "Matter",
    fieldLabel: "Lawsuit Costs",
    mergeField: "{{lawsuit.costs}}",
    exampleOutput: "$0.00",
    aliases: ["lawsuit costs"],
    fieldType: "Amount",
    compatibleModifiers: ["currency", "bold", "italic", "underline"],
    uiLabelEditable: true,
    uiCategoryEditable: true,
    tokenEditable: false,
  },
  {
    kind: "canonical",
    category: "Matter",
    fieldLabel: "Lawsuit Payments Posted",
    mergeField: "{{lawsuit.paymentsPosted}}",
    exampleOutput: "$0.00",
    aliases: ["lawsuit payments posted"],
    fieldType: "Amount",
    compatibleModifiers: ["currency", "bold", "italic", "underline"],
    uiLabelEditable: true,
    uiCategoryEditable: true,
    tokenEditable: false,
  },
  {
    kind: "canonical",
    category: "Matter",
    fieldLabel: "Lawsuit Balance",
    mergeField: "{{lawsuit.balance}}",
    exampleOutput: "$1,261.75",
    aliases: ["lawsuit balance"],
    fieldType: "Amount",
    compatibleModifiers: ["currency", "bold", "italic", "underline"],
    uiLabelEditable: true,
    uiCategoryEditable: true,
    tokenEditable: false,
  },
  {
    kind: "canonical",
    category: "Matter",
    fieldLabel: "Index Fee",
    mergeField: "{{cost.indexFee}}",
    exampleOutput: "$0.00",
    aliases: ["index fee"],
    fieldType: "Amount",
    compatibleModifiers: ["currency", "bold", "italic", "underline"],
    uiLabelEditable: true,
    uiCategoryEditable: true,
    tokenEditable: false,
  },
  {
    kind: "canonical",
    category: "Matter",
    fieldLabel: "Service Fee",
    mergeField: "{{cost.serviceFee}}",
    exampleOutput: "$0.00",
    aliases: ["service fee"],
    fieldType: "Amount",
    compatibleModifiers: ["currency", "bold", "italic", "underline"],
    uiLabelEditable: true,
    uiCategoryEditable: true,
    tokenEditable: false,
  },
  {
    kind: "canonical",
    category: "Matter",
    fieldLabel: "Other Court Costs",
    mergeField: "{{cost.otherCourtCosts}}",
    exampleOutput: "$0.00",
    aliases: ["other court costs"],
    fieldType: "Amount",
    compatibleModifiers: ["currency", "bold", "italic", "underline"],
    uiLabelEditable: true,
    uiCategoryEditable: true,
    tokenEditable: false,
  },
  {
    kind: "canonical",
    category: "Matter",
    fieldLabel: "Total Costs",
    mergeField: "{{cost.total}}",
    exampleOutput: "$0.00",
    aliases: ["cost total"],
    fieldType: "Amount",
    compatibleModifiers: ["currency", "bold", "italic", "underline"],
    uiLabelEditable: true,
    uiCategoryEditable: true,
    tokenEditable: false,
  },
];

export const TEMPLATE_BUILDER_CUSTOM_PLACEHOLDER_FIELDS = [
  "Category",
  "Field Label",
  "Merge Field Token",
  "Prompt shown during document generation",
  "Example value",
  "Required",
  "Field Type",
] as const;

export const TEMPLATE_BUILDER_CUSTOM_PLACEHOLDER_FIELD_TYPES: TemplateBuilderFieldType[] = [
  "Text",
  "Date",
  "Amount",
  "Number",
];

export const TEMPLATE_BUILDER_CUSTOM_TOKEN_PREFIX = "{{custom" as const;

export function templateBuilderTokenForCustomLabel(fieldLabel: string) {
  const words = String(fieldLabel || "")
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .split(" ")
    .filter(Boolean);

  const pascal = words
    .map((word) => word.slice(0, 1).toUpperCase() + word.slice(1))
    .join("");

  if (!pascal) return "{{custom.placeholder}}";
  return "{{custom." + pascal.slice(0, 1).toLowerCase() + pascal.slice(1) + "}}";
}

export function templateBuilderCanonicalTokenSet() {
  return new Set(TEMPLATE_BUILDER_CANONICAL_MERGE_FIELDS.map((field) => field.mergeField));
}

export function templateBuilderIsCustomToken(token: string) {
  return /^\{\{custom\.[a-zA-Z][a-zA-Z0-9]*\}\}$/.test(String(token || "").trim());
}

export function templateBuilderCustomTokenConflicts(token: string, existingCustomTokens: string[] = []) {
  const cleanToken = String(token || "").trim();
  return templateBuilderCanonicalTokenSet().has(cleanToken) || existingCustomTokens.includes(cleanToken);
}

export function templateBuilderSortFieldsByLabel<T extends { fieldLabel: string }>(fields: T[]) {
  return [...fields].sort((a, b) => a.fieldLabel.localeCompare(b.fieldLabel));
}

export function templateBuilderMoveDeletedCategoryFieldsToGeneral<T extends { category: string }>(fields: T[], deletedCategory: string) {
  return fields.map((field) => field.category === deletedCategory ? { ...field, category: "General" } : field);
}
