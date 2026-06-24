export type TemplateBuilderMergeFieldKind = "canonical" | "custom";
export type TemplateBuilderFieldType = "text" | "date" | "currency";
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

export type TemplateBuilderMergeFieldCategory =
  | "Matter"
  | "Provider"
  | "Insurer"
  | "Claim"
  | "Lawsuit"
  | "Costs"
  | "General";

export type TemplateBuilderCategory = {
  id: string;
  label: TemplateBuilderMergeFieldCategory;
};

export type TemplateBuilderCanonicalMergeField = {
  kind: "canonical";
  category: TemplateBuilderMergeFieldCategory;
  subcategory?: string;
  fieldLabel: string;
  mergeField: string;
  aliases?: string[];
  fieldType: TemplateBuilderFieldType;
  compatibleModifiers: TemplateBuilderFormatModifier[];
  exampleOutput: string;
};

export type TemplateBuilderCustomPlaceholderField = {
  kind: "custom";
  category: TemplateBuilderMergeFieldCategory;
  subcategory?: string;
  fieldLabel: string;
  mergeField: string;
  aliases?: string[];
  fieldType: TemplateBuilderFieldType;
  compatibleModifiers: TemplateBuilderFormatModifier[];
  exampleOutput: string;
};

const TEXT_MODIFIERS: TemplateBuilderFormatModifier[] = ["upper", "lower", "title", "bold", "italic", "underline"];
const DATE_MODIFIERS: TemplateBuilderFormatModifier[] = ["date:MM/DD/YYYY", "date:Month D, YYYY", "bold", "italic", "underline"];
const CURRENCY_MODIFIERS: TemplateBuilderFormatModifier[] = ["currency", "bold", "italic", "underline"];

export const TEMPLATE_BUILDER_SUPPORTED_FORMAT_MODIFIERS: TemplateBuilderFormatModifier[] = [
  "bold",
  "italic",
  "underline",
  "upper",
  "lower",
  "title",
  "date:MM/DD/YYYY",
  "date:Month D, YYYY",
  "currency",
];

export const TEMPLATE_BUILDER_STARTING_CATEGORIES: TemplateBuilderCategory[] = [
  { id: "matter", label: "Matter" },
  { id: "provider", label: "Provider" },
  { id: "insurer", label: "Insurer" },
  { id: "claim", label: "Claim" },
  { id: "lawsuit", label: "Lawsuit" },
  { id: "costs", label: "Costs" },
  { id: "general", label: "General" },
];

export const TEMPLATE_BUILDER_CANONICAL_MERGE_FIELDS: TemplateBuilderCanonicalMergeField[] = [
  {
    kind: "canonical",
    category: "Matter",
    fieldLabel: "Matter File Number",
    mergeField: "{{matter.fileNumber}}",
    fieldType: "text",
    compatibleModifiers: TEXT_MODIFIERS,
    exampleOutput: "—",
  },
  {
    kind: "canonical",
    category: "Matter",
    fieldLabel: "Provider Name",
    mergeField: "{{matter.providerName}}",
    fieldType: "text",
    compatibleModifiers: TEXT_MODIFIERS,
    exampleOutput: "—",
  },
  {
    kind: "canonical",
    category: "Matter",
    fieldLabel: "Patient Name",
    mergeField: "{{matter.patientName}}",
    fieldType: "text",
    compatibleModifiers: TEXT_MODIFIERS,
    exampleOutput: "—",
  },
  {
    kind: "canonical",
    category: "Matter",
    fieldLabel: "Billed Amount",
    mergeField: "{{matter.billedAmount}}",
    fieldType: "currency",
    compatibleModifiers: CURRENCY_MODIFIERS,
    exampleOutput: "—",
  },
  {
    kind: "canonical",
    category: "Provider",
    fieldLabel: "Provider Tax ID",
    mergeField: "{{provider.taxId}}",
    fieldType: "text",
    compatibleModifiers: ["bold", "italic", "underline"],
    exampleOutput: "—",
  },
  {
    kind: "canonical",
    category: "Insurer",
    fieldLabel: "Insurer Name",
    mergeField: "{{insurer.name}}",
    fieldType: "text",
    compatibleModifiers: TEXT_MODIFIERS,
    exampleOutput: "—",
  },
  {
    kind: "canonical",
    category: "Insurer",
    fieldLabel: "Insurer Street",
    mergeField: "{{insurer.street}}",
    fieldType: "text",
    compatibleModifiers: TEXT_MODIFIERS,
    exampleOutput: "—",
  },
  {
    kind: "canonical",
    category: "Insurer",
    fieldLabel: "Insurer City",
    mergeField: "{{insurer.city}}",
    fieldType: "text",
    compatibleModifiers: TEXT_MODIFIERS,
    exampleOutput: "—",
  },
  {
    kind: "canonical",
    category: "Insurer",
    fieldLabel: "Insurer State",
    mergeField: "{{insurer.state}}",
    fieldType: "text",
    compatibleModifiers: TEXT_MODIFIERS,
    exampleOutput: "—",
  },
  {
    kind: "canonical",
    category: "Insurer",
    fieldLabel: "Insurer ZIP",
    mergeField: "{{insurer.zipcode}}",
    fieldType: "text",
    compatibleModifiers: TEXT_MODIFIERS,
    exampleOutput: "—",
  },
  {
    kind: "canonical",
    category: "Claim",
    fieldLabel: "Claim Number",
    mergeField: "{{claim.number}}",
    fieldType: "text",
    compatibleModifiers: ["bold", "italic", "underline"],
    exampleOutput: "—",
  },
  {
    kind: "canonical",
    category: "Claim",
    fieldLabel: "Date of Loss",
    mergeField: "{{claim.dateOfLoss}}",
    fieldType: "date",
    compatibleModifiers: DATE_MODIFIERS,
    exampleOutput: "—",
  },
  {
    kind: "canonical",
    category: "Claim",
    fieldLabel: "Date of Service",
    mergeField: "{{claim.dateOfService}}",
    fieldType: "date",
    compatibleModifiers: DATE_MODIFIERS,
    exampleOutput: "—",
  },
  {
    kind: "canonical",
    category: "Claim",
    fieldLabel: "Denial Reason",
    mergeField: "{{claim.denialReason}}",
    fieldType: "text",
    compatibleModifiers: TEXT_MODIFIERS,
    exampleOutput: "—",
  },
  {
    kind: "canonical",
    category: "Claim",
    fieldLabel: "Claim Balance",
    mergeField: "{{claim.balance}}",
    fieldType: "currency",
    compatibleModifiers: CURRENCY_MODIFIERS,
    exampleOutput: "—",
  },
  {
    kind: "canonical",
    category: "Claim",
    fieldLabel: "Claim Payments",
    mergeField: "{{claim.payments}}",
    fieldType: "currency",
    compatibleModifiers: CURRENCY_MODIFIERS,
    exampleOutput: "—",
  },
  {
    kind: "canonical",
    category: "Lawsuit",
    fieldLabel: "Index Number",
    mergeField: "{{lawsuit.indexNumber}}",
    fieldType: "text",
    compatibleModifiers: ["bold", "italic", "underline"],
    exampleOutput: "—",
  },
  {
    kind: "canonical",
    category: "Lawsuit",
    fieldLabel: "Court",
    mergeField: "{{lawsuit.court}}",
    fieldType: "text",
    compatibleModifiers: TEXT_MODIFIERS,
    exampleOutput: "—",
  },
  {
    kind: "canonical",
    category: "Lawsuit",
    fieldLabel: "Adversary Attorney Name",
    mergeField: "{{lawsuit.adversaryAttorney}}",
    fieldType: "text",
    compatibleModifiers: TEXT_MODIFIERS,
    exampleOutput: "—",
  },
  {
    kind: "canonical",
    category: "Lawsuit",
    fieldLabel: "Adversary Street",
    mergeField: "{{adversaryAttorney.street}}",
    fieldType: "text",
    compatibleModifiers: TEXT_MODIFIERS,
    exampleOutput: "—",
  },
  {
    kind: "canonical",
    category: "Lawsuit",
    fieldLabel: "Adversary City",
    mergeField: "{{adversaryAttorney.city}}",
    fieldType: "text",
    compatibleModifiers: TEXT_MODIFIERS,
    exampleOutput: "—",
  },
  {
    kind: "canonical",
    category: "Lawsuit",
    fieldLabel: "Adversary State",
    mergeField: "{{adversaryAttorney.state}}",
    fieldType: "text",
    compatibleModifiers: TEXT_MODIFIERS,
    exampleOutput: "—",
  },
  {
    kind: "canonical",
    category: "Lawsuit",
    fieldLabel: "Adversary ZIP",
    mergeField: "{{adversaryAttorney.zipcode}}",
    fieldType: "text",
    compatibleModifiers: TEXT_MODIFIERS,
    exampleOutput: "—",
  },
  {
    kind: "canonical",
    category: "Lawsuit",
    fieldLabel: "Date Filed",
    mergeField: "{{lawsuit.dateFiled}}",
    fieldType: "date",
    compatibleModifiers: DATE_MODIFIERS,
    exampleOutput: "—",
  },
  {
    kind: "canonical",
    category: "Lawsuit",
    fieldLabel: "Lawsuit Amount",
    mergeField: "{{lawsuit.amount}}",
    fieldType: "currency",
    compatibleModifiers: CURRENCY_MODIFIERS,
    exampleOutput: "—",
  },
  {
    kind: "canonical",
    category: "Lawsuit",
    fieldLabel: "Lawsuit Costs",
    mergeField: "{{lawsuit.costs}}",
    fieldType: "currency",
    compatibleModifiers: CURRENCY_MODIFIERS,
    exampleOutput: "—",
  },
  {
    kind: "canonical",
    category: "Lawsuit",
    fieldLabel: "Lawsuit Balance",
    mergeField: "{{lawsuit.balance}}",
    fieldType: "currency",
    compatibleModifiers: CURRENCY_MODIFIERS,
    exampleOutput: "—",
  },
  {
    kind: "canonical",
    category: "Costs",
    fieldLabel: "Index Fee",
    mergeField: "{{cost.indexFee}}",
    fieldType: "currency",
    compatibleModifiers: CURRENCY_MODIFIERS,
    exampleOutput: "—",
  },
  {
    kind: "canonical",
    category: "Costs",
    fieldLabel: "Service Fee",
    mergeField: "{{cost.serviceFee}}",
    fieldType: "currency",
    compatibleModifiers: CURRENCY_MODIFIERS,
    exampleOutput: "—",
  },
  {
    kind: "canonical",
    category: "Costs",
    fieldLabel: "Other Court Costs",
    mergeField: "{{cost.otherCourtCosts}}",
    fieldType: "currency",
    compatibleModifiers: CURRENCY_MODIFIERS,
    exampleOutput: "—",
  },
  {
    kind: "canonical",
    category: "Costs",
    fieldLabel: "Total Costs",
    mergeField: "{{cost.total}}",
    fieldType: "currency",
    compatibleModifiers: CURRENCY_MODIFIERS,
    exampleOutput: "—",
  },
];

export const TEMPLATE_BUILDER_CUSTOM_PLACEHOLDER_FIELDS: TemplateBuilderCustomPlaceholderField[] = [
  {
    kind: "custom",
    category: "General",
    fieldLabel: "Custom Placeholder",
    mergeField: "{{custom.placeholder}}",
    fieldType: "text",
    compatibleModifiers: TEXT_MODIFIERS,
    exampleOutput: "—",
  },
];

export function templateBuilderTokenForCustomLabel(label: string): string {
  const normalized = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "");
  return `{{custom.${normalized || "placeholder"}}}`;
}

export function templateBuilderIsCustomToken(token: string): boolean {
  return /^\{\{custom\.[a-z0-9.]+\}\}$/.test(token);
}

export function templateBuilderCustomTokenConflicts(token: string): boolean {
  return TEMPLATE_BUILDER_CANONICAL_MERGE_FIELDS.some((field) => field.mergeField === token);
}

export function templateBuilderMoveDeletedCategoryFieldsToGeneral<T extends { category: TemplateBuilderMergeFieldCategory }>(
  fields: T[],
  activeCategories: TemplateBuilderCategory[],
): T[] {
  const active = new Set(activeCategories.map((category) => category.label));
  return fields.map((field) => (active.has(field.category) ? field : { ...field, category: "General" }));
}
