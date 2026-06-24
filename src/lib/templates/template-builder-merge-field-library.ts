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
