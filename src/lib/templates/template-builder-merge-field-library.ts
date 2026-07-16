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
  | "Settlement"
  | "Signer"
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
  { id: "settlement", label: "Settlement" },
  { id: "signer", label: "Signer" },
  { id: "general", label: "General" },
];

export const TEMPLATE_BUILDER_CANONICAL_MERGE_FIELDS: TemplateBuilderCanonicalMergeField[] = [
  {
    kind: "canonical",
    category: "Signer",
    fieldLabel: "Signer email",
    mergeField: "{{signer.email}}",
    fieldType: "text",
    compatibleModifiers: TEXT_MODIFIERS,
    exampleOutput: "info@brlfirm.com",
    aliases: ["selected signer email", "attorney email", "user email"],
  },
  {
    kind: "canonical",
    category: "Signer",
    fieldLabel: "Signer fax",
    mergeField: "{{signer.fax}}",
    fieldType: "text",
    compatibleModifiers: TEXT_MODIFIERS,
    exampleOutput: "(516) 706-5055",
    aliases: ["selected signer fax", "attorney fax", "user fax"],
  },
  {
    kind: "canonical",
    category: "Signer",
    fieldLabel: "Signer extension",
    mergeField: "{{signer.extension}}",
    fieldType: "text",
    compatibleModifiers: TEXT_MODIFIERS,
    exampleOutput: "101",
    aliases: ["selected signer extension", "attorney extension", "phone extension"],
  },
  {
    kind: "canonical",
    category: "Signer",
    fieldLabel: "Signer display name",
    mergeField: "{{signer.displayName}}",
    fieldType: "text",
    compatibleModifiers: TEXT_MODIFIERS,
    exampleOutput: "Selected Signer",
    aliases: ["selected signer display name", "attorney display name", "user display name"],
  },
  {
    kind: "canonical",
    category: "Signer",
    fieldLabel: "Signer signature name",
    mergeField: "{{signer.signatureName}}",
    fieldType: "text",
    compatibleModifiers: TEXT_MODIFIERS,
    exampleOutput: "Selected Signer",
    aliases: ["selected signer signature name", "signature block name", "attorney signature name"],
  },
  {
    kind: "canonical",
    category: "Signer",
    fieldLabel: "Signer title",
    mergeField: "{{signer.title}}",
    fieldType: "text",
    compatibleModifiers: TEXT_MODIFIERS,
    exampleOutput: "Attorney",
    aliases: ["selected signer title", "attorney title", "user title"],
  },

  {
    kind: "canonical",
    category: "Settlement",
    fieldLabel: "Settled With Name",
    mergeField: "{{settledWith.name}}",
    fieldType: "text",
    compatibleModifiers: TEXT_MODIFIERS,
    exampleOutput: "—",
    aliases: ["settled with", "settling party", "settlement contact name"],
  },
  {
    kind: "canonical",
    category: "Settlement",
    fieldLabel: "Settled With Email",
    mergeField: "{{settledWith.email}}",
    fieldType: "text",
    compatibleModifiers: TEXT_MODIFIERS,
    exampleOutput: "—",
    aliases: ["settled with email", "settlement contact email"],
  },
  {
    kind: "canonical",
    category: "Settlement",
    fieldLabel: "Settled With Fax",
    mergeField: "{{settledWith.fax}}",
    fieldType: "text",
    compatibleModifiers: TEXT_MODIFIERS,
    exampleOutput: "—",
    aliases: ["settled with fax", "settlement contact fax"],
  },
  {
    kind: "canonical",
    category: "Settlement",
    fieldLabel: "Settled With Phone",
    mergeField: "{{settledWith.phone}}",
    fieldType: "text",
    compatibleModifiers: TEXT_MODIFIERS,
    exampleOutput: "—",
    aliases: ["settled with phone", "settlement contact phone"],
  },
  {
    kind: "canonical",
    category: "Settlement",
    fieldLabel: "Settled With Company",
    mergeField: "{{settledWith.company}}",
    fieldType: "text",
    compatibleModifiers: TEXT_MODIFIERS,
    exampleOutput: "—",
    aliases: ["settled with company", "settlement contact company"],
  },
  {
    kind: "canonical",
    category: "Settlement",
    fieldLabel: "Settlement Date",
    mergeField: "{{settlement.date}}",
    fieldType: "date",
    compatibleModifiers: DATE_MODIFIERS,
    exampleOutput: "—",
    aliases: ["date settled", "settlement date"],
  },
  {
    kind: "canonical",
    category: "Settlement",
    fieldLabel: "Payment Expected Date",
    mergeField: "{{settlement.paymentExpectedDate}}",
    fieldType: "date",
    compatibleModifiers: DATE_MODIFIERS,
    exampleOutput: "—",
    aliases: ["payment expected", "expected payment date"],
  },
  {
    kind: "canonical",
    category: "Settlement",
    fieldLabel: "Gross Settlement Amount",
    mergeField: "{{settlement.grossAmount}}",
    fieldType: "currency",
    compatibleModifiers: CURRENCY_MODIFIERS,
    exampleOutput: "—",
    aliases: ["gross settlement", "settlement amount", "total settlement"],
  },
  {
    kind: "canonical",
    category: "Settlement",
    fieldLabel: "Settlement Interest Amount",
    mergeField: "{{settlement.interestAmount}}",
    fieldType: "currency",
    compatibleModifiers: CURRENCY_MODIFIERS,
    exampleOutput: "—",
    aliases: ["settlement interest", "interest amount"],
  },
  {
    kind: "canonical",
    category: "Settlement",
    fieldLabel: "Allocated Settlement Total",
    mergeField: "{{settlement.allocatedTotal}}",
    fieldType: "currency",
    compatibleModifiers: CURRENCY_MODIFIERS,
    exampleOutput: "—",
    aliases: ["allocated settlement", "allocated total"],
  },
  {
    kind: "canonical",
    category: "Settlement",
    fieldLabel: "Settlement Total Fee",
    mergeField: "{{settlement.totalFee}}",
    fieldType: "currency",
    compatibleModifiers: CURRENCY_MODIFIERS,
    exampleOutput: "—",
    aliases: ["settlement fee", "total fee"],
  },
  {
    kind: "canonical",
    category: "Settlement",
    fieldLabel: "Provider Net (Settlement)",
    mergeField: "{{settlement.providerNet}}",
    fieldType: "currency",
    compatibleModifiers: CURRENCY_MODIFIERS,
    exampleOutput: "—",
    aliases: ["provider net", "net to provider"],
  },
  {
    kind: "canonical",
    category: "Settlement",
    fieldLabel: "Settlement Allocation Mode",
    mergeField: "{{settlement.allocationMode}}",
    fieldType: "text",
    compatibleModifiers: TEXT_MODIFIERS,
    exampleOutput: "—",
    aliases: ["allocation mode", "allocation method"],
  },

  // Matters table (repeating rows). Put {{#matters}} in the first cell and {{/matters}} in the last cell of
  // ONE table row; that row is cloned per matter. Use the {{row.*}} tokens in that row's cells, and the
  // {{total.*}} tokens in a separate Total row.
  {
    kind: "canonical",
    category: "Settlement",
    subcategory: "Matters Table",
    fieldLabel: "Matters loop START (first cell of repeating row)",
    mergeField: "{{#matters}}",
    fieldType: "text",
    compatibleModifiers: [],
    exampleOutput: "(repeats the row per matter)",
    aliases: ["matters loop start", "begin matters"],
  },
  {
    kind: "canonical",
    category: "Settlement",
    subcategory: "Matters Table",
    fieldLabel: "Matters loop END (last cell of repeating row)",
    mergeField: "{{/matters}}",
    fieldType: "text",
    compatibleModifiers: [],
    exampleOutput: "(ends the repeating row)",
    aliases: ["matters loop end", "end matters"],
  },
  { kind: "canonical", category: "Settlement", subcategory: "Matters Table", fieldLabel: "Row — File No", mergeField: "{{row.fileNo}}", fieldType: "text", compatibleModifiers: TEXT_MODIFIERS, exampleOutput: "44525-690645", aliases: ["matter file no", "row file number"] },
  { kind: "canonical", category: "Settlement", subcategory: "Matters Table", fieldLabel: "Row — Patient", mergeField: "{{row.patient}}", fieldType: "text", compatibleModifiers: TEXT_MODIFIERS, exampleOutput: "AUSTIN BURGOS", aliases: ["row patient"] },
  { kind: "canonical", category: "Settlement", subcategory: "Matters Table", fieldLabel: "Row — Dates of Service", mergeField: "{{row.dos}}", fieldType: "text", compatibleModifiers: TEXT_MODIFIERS, exampleOutput: "01/28/2025 - 01/28/2025", aliases: ["row dates of service", "row dos"] },
  { kind: "canonical", category: "Settlement", subcategory: "Matters Table", fieldLabel: "Row — Balance", mergeField: "{{row.balance}}", fieldType: "text", compatibleModifiers: TEXT_MODIFIERS, exampleOutput: "$51.28", aliases: ["row balance"] },
  { kind: "canonical", category: "Settlement", subcategory: "Matters Table", fieldLabel: "Row — Settled Principal", mergeField: "{{row.settledPrincipal}}", fieldType: "text", compatibleModifiers: TEXT_MODIFIERS, exampleOutput: "$31.23", aliases: ["row settled principal"] },
  { kind: "canonical", category: "Settlement", subcategory: "Matters Table", fieldLabel: "Row — Interest", mergeField: "{{row.interest}}", fieldType: "text", compatibleModifiers: TEXT_MODIFIERS, exampleOutput: "$2.91", aliases: ["row interest"] },
  { kind: "canonical", category: "Settlement", subcategory: "Matters Table", fieldLabel: "Row — Atty Fees", mergeField: "{{row.attyFees}}", fieldType: "text", compatibleModifiers: TEXT_MODIFIERS, exampleOutput: "$6.83", aliases: ["row atty fees", "row attorney fees"] },
  { kind: "canonical", category: "Settlement", subcategory: "Matters Table", fieldLabel: "Row — Filing Fees", mergeField: "{{row.filingFees}}", fieldType: "text", compatibleModifiers: TEXT_MODIFIERS, exampleOutput: "$41.20", aliases: ["row filing fees"] },
  { kind: "canonical", category: "Settlement", subcategory: "Matters Table", fieldLabel: "Total — Balance", mergeField: "{{total.balance}}", fieldType: "text", compatibleModifiers: TEXT_MODIFIERS, exampleOutput: "$4,077.78", aliases: ["total balance"] },
  { kind: "canonical", category: "Settlement", subcategory: "Matters Table", fieldLabel: "Total — Settled Principal", mergeField: "{{total.settledPrincipal}}", fieldType: "text", compatibleModifiers: TEXT_MODIFIERS, exampleOutput: "$2,483.65", aliases: ["total settled principal"] },
  { kind: "canonical", category: "Settlement", subcategory: "Matters Table", fieldLabel: "Total — Interest", mergeField: "{{total.interest}}", fieldType: "text", compatibleModifiers: TEXT_MODIFIERS, exampleOutput: "$231.82", aliases: ["total interest"] },
  { kind: "canonical", category: "Settlement", subcategory: "Matters Table", fieldLabel: "Total — Atty Fees", mergeField: "{{total.attyFees}}", fieldType: "text", compatibleModifiers: TEXT_MODIFIERS, exampleOutput: "$543.10", aliases: ["total atty fees"] },
  { kind: "canonical", category: "Settlement", subcategory: "Matters Table", fieldLabel: "Total — Filing Fees", mergeField: "{{total.filingFees}}", fieldType: "text", compatibleModifiers: TEXT_MODIFIERS, exampleOutput: "$163.75", aliases: ["total filing fees"] },

  // Sibling-matters table (repeating rows) — works on ANY lawsuit (not settlement-dependent). Put
  // {{#siblings}} in the first cell and {{/siblings}} in the last cell of ONE table row (cloned per
  // member matter); use {{row.*}} in that row and {{total.outstanding}} in a separate Total row.
  { kind: "canonical", category: "Lawsuit", subcategory: "Sibling Matters Table", fieldLabel: "Siblings loop START (first cell of repeating row)", mergeField: "{{#siblings}}", fieldType: "text", compatibleModifiers: [], exampleOutput: "(repeats the row per sibling matter)" },
  { kind: "canonical", category: "Lawsuit", subcategory: "Sibling Matters Table", fieldLabel: "Siblings loop END (last cell of repeating row)", mergeField: "{{/siblings}}", fieldType: "text", compatibleModifiers: [], exampleOutput: "(ends the repeating row)" },
  { kind: "canonical", category: "Lawsuit", subcategory: "Sibling Matters Table", fieldLabel: "Row — Matter Number", mergeField: "{{row.matterNo}}", fieldType: "text", compatibleModifiers: TEXT_MODIFIERS, exampleOutput: "BRL_202500123", aliases: ["row matter number", "underlying matter number"] },
  { kind: "canonical", category: "Lawsuit", subcategory: "Sibling Matters Table", fieldLabel: "Row — Dates of Service", mergeField: "{{row.dos}}", fieldType: "text", compatibleModifiers: TEXT_MODIFIERS, exampleOutput: "01/28/2025", aliases: ["row dos", "row dates of service"] },
  { kind: "canonical", category: "Lawsuit", subcategory: "Sibling Matters Table", fieldLabel: "Row — Outstanding Amount", mergeField: "{{row.outstanding}}", fieldType: "text", compatibleModifiers: TEXT_MODIFIERS, exampleOutput: "$562.25", aliases: ["row outstanding", "row outstanding amount"] },
  { kind: "canonical", category: "Lawsuit", subcategory: "Sibling Matters Table", fieldLabel: "Total — Outstanding", mergeField: "{{total.outstanding}}", fieldType: "text", compatibleModifiers: TEXT_MODIFIERS, exampleOutput: "$1,261.75", aliases: ["total outstanding"] },

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
    category: "Provider",
    fieldLabel: "Provider Street",
    mergeField: "{{provider.street}}",
    fieldType: "text",
    compatibleModifiers: TEXT_MODIFIERS,
    exampleOutput: "—",
  },
  {
    kind: "canonical",
    category: "Provider",
    fieldLabel: "Provider City",
    mergeField: "{{provider.city}}",
    fieldType: "text",
    compatibleModifiers: TEXT_MODIFIERS,
    exampleOutput: "—",
  },
  {
    kind: "canonical",
    category: "Provider",
    fieldLabel: "Provider State",
    mergeField: "{{provider.state}}",
    fieldType: "text",
    compatibleModifiers: TEXT_MODIFIERS,
    exampleOutput: "—",
  },
  {
    kind: "canonical",
    category: "Provider",
    fieldLabel: "Provider ZIP",
    mergeField: "{{provider.zipcode}}",
    fieldType: "text",
    compatibleModifiers: TEXT_MODIFIERS,
    exampleOutput: "—",
  },
  {
    kind: "canonical",
    category: "Provider",
    fieldLabel: "Provider Full Address Block",
    mergeField: "{{provider.fullAddressBlock}}",
    fieldType: "text",
    compatibleModifiers: TEXT_MODIFIERS,
    exampleOutput: "445 Broadhollow Road, Suite CL18\\nMelville, New York 11747",
  },
  {
    kind: "canonical",
    category: "Provider",
    fieldLabel: "Provider Phone",
    mergeField: "{{provider.phone}}",
    fieldType: "text",
    compatibleModifiers: TEXT_MODIFIERS,
    exampleOutput: "—",
  },
  {
    kind: "canonical",
    category: "Provider",
    fieldLabel: "Provider Email",
    mergeField: "{{provider.email}}",
    fieldType: "text",
    compatibleModifiers: TEXT_MODIFIERS,
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
    category: "Insurer",
    fieldLabel: "Insurer Full Address Block",
    mergeField: "{{insurer.fullAddressBlock}}",
    fieldType: "text",
    compatibleModifiers: TEXT_MODIFIERS,
    exampleOutput: "3100 Sanders Road, Suite 201\\nNorthbrook, Illinois 60062",
  },
  {
    kind: "canonical",
    category: "Insurer",
    fieldLabel: "Insurer Telephone Number",
    mergeField: "{{insurer.phone}}",
    fieldType: "text",
    compatibleModifiers: TEXT_MODIFIERS,
    exampleOutput: "—",
  },
  {
    kind: "canonical",
    category: "Insurer",
    fieldLabel: "Insurer Email",
    mergeField: "{{insurer.email}}",
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
    fieldLabel: "Policy Number",
    mergeField: "{{claim.policyNumber}}",
    fieldType: "text",
    compatibleModifiers: ["bold", "italic", "underline"],
    exampleOutput: "—",
  },
  {
    kind: "canonical",
    category: "Lawsuit",
    fieldLabel: "Policy Number (Lawsuit)",
    mergeField: "{{lawsuit.policyNumber}}",
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
    fieldLabel: "Court Short Name",
    mergeField: "{{court.name}}",
    fieldType: "text",
    compatibleModifiers: TEXT_MODIFIERS,
    exampleOutput: "—",
  },
  {
    kind: "canonical",
    category: "Lawsuit",
    fieldLabel: "Court Long Name 1",
    mergeField: "{{court.longName1}}",
    fieldType: "text",
    compatibleModifiers: TEXT_MODIFIERS,
    exampleOutput: "—",
  },
  {
    kind: "canonical",
    category: "Lawsuit",
    fieldLabel: "Court Long Name 2",
    mergeField: "{{court.longName2}}",
    fieldType: "text",
    compatibleModifiers: TEXT_MODIFIERS,
    exampleOutput: "—",
  },
  {
    kind: "canonical",
    category: "Lawsuit",
    fieldLabel: "Court County",
    mergeField: "{{court.county}}",
    fieldType: "text",
    compatibleModifiers: TEXT_MODIFIERS,
    exampleOutput: "—",
  },
  {
    kind: "canonical",
    category: "Lawsuit",
    fieldLabel: "Court Street",
    mergeField: "{{court.street}}",
    fieldType: "text",
    compatibleModifiers: TEXT_MODIFIERS,
    exampleOutput: "—",
  },
  {
    kind: "canonical",
    category: "Lawsuit",
    fieldLabel: "Court City",
    mergeField: "{{court.city}}",
    fieldType: "text",
    compatibleModifiers: TEXT_MODIFIERS,
    exampleOutput: "—",
  },
  {
    kind: "canonical",
    category: "Lawsuit",
    fieldLabel: "Court State",
    mergeField: "{{court.state}}",
    fieldType: "text",
    compatibleModifiers: TEXT_MODIFIERS,
    exampleOutput: "—",
  },
  {
    kind: "canonical",
    category: "Lawsuit",
    fieldLabel: "Court ZIP",
    mergeField: "{{court.zipcode}}",
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
    fieldLabel: "Adversary Attorney File No.",
    mergeField: "{{lawsuit.adversaryAttorneyFileNo}}",
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
    fieldLabel: "Adversary Full Address Block",
    mergeField: "{{adversary.fullAddressBlock}}",
    fieldType: "text",
    compatibleModifiers: TEXT_MODIFIERS,
    exampleOutput: "445 Broadhollow Road, Suite CL18\\nMelville, New York 11747",
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
    fieldLabel: "Date Served",
    mergeField: "{{lawsuit.dateServed}}",
    fieldType: "date",
    compatibleModifiers: DATE_MODIFIERS,
    exampleOutput: "—",
  },
  {
    kind: "canonical",
    category: "Lawsuit",
    fieldLabel: "Date Service Complete",
    mergeField: "{{lawsuit.dateServiceComplete}}",
    fieldType: "date",
    compatibleModifiers: DATE_MODIFIERS,
    exampleOutput: "—",
  },
  {
    kind: "canonical",
    category: "Lawsuit",
    fieldLabel: "Date Answer Received",
    mergeField: "{{lawsuit.dateAnswerReceived}}",
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
  {
    kind: "canonical",
    category: "General",
    fieldLabel: "Letter Date (US Eastern)",
    mergeField: "{{letter.date}}",
    fieldType: "text",
    compatibleModifiers: ["bold", "italic", "underline"],
    exampleOutput: "—",
    aliases: ["today", "todays date", "current date", "letter date", "generation date", "date"],
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
