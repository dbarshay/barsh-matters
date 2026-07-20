// Report field catalog for the Reports builder. Curated, human-labeled fields for the two
// base entities (Matter = ClaimIndex, Lawsuit). Column keys are whitelisted here so the run
// engine never interpolates arbitrary column names into a query.

export type ReportBase = "matter" | "lawsuit";
export type ReportFieldType = "text" | "number" | "date" | "category";

export type ReportField = {
  key: string;          // stable field key used in saved configs
  label: string;        // human label shown in the picker
  group: string;        // picker category
  type: ReportFieldType;
  column?: string;      // underlying DB column (absent for derived rollups)
  rollup?: boolean;     // lawsuit-only: derived from member matters
  format?: "provider";  // display-time legal-name case normalization
  money?: boolean;      // render as USD currency
};

export const OPERATORS_BY_TYPE: Record<ReportFieldType, { key: string; label: string; arity: 0 | 1 | 2 | "list" }[]> = {
  text: [
    { key: "is", label: "is", arity: 1 },
    { key: "is_not", label: "is not", arity: 1 },
    { key: "contains", label: "contains", arity: 1 },
    { key: "starts_with", label: "starts with", arity: 1 },
    { key: "is_blank", label: "is blank", arity: 0 },
  ],
  category: [
    { key: "is", label: "is", arity: 1 },
    { key: "is_not", label: "is not", arity: 1 },
    { key: "is_any_of", label: "is any of", arity: "list" },
    { key: "is_blank", label: "is blank", arity: 0 },
  ],
  number: [
    { key: "eq", label: "=", arity: 1 },
    { key: "ne", label: "≠", arity: 1 },
    { key: "gt", label: ">", arity: 1 },
    { key: "lt", label: "<", arity: 1 },
    { key: "gte", label: "≥", arity: 1 },
    { key: "lte", label: "≤", arity: 1 },
    { key: "between", label: "between", arity: 2 },
  ],
  date: [
    { key: "on", label: "on", arity: 1 },
    { key: "before", label: "before", arity: 1 },
    { key: "after", label: "after", arity: 1 },
    { key: "between", label: "between", arity: 2 },
    { key: "last_n_days", label: "in the last N days", arity: 1 },
  ],
};

export const MATTER_FIELDS: ReportField[] = [
  // Identifiers
  { key: "display_number", label: "Matter Number", group: "Identifiers", type: "text", column: "display_number" },
  { key: "claim_number", label: "Claim Number", group: "Identifiers", type: "text", column: "claim_number_normalized" },
  { key: "index_aaa_number", label: "Index / AAA Number", group: "Identifiers", type: "text", column: "index_aaa_number" },
  { key: "policy_number", label: "Policy Number", group: "Identifiers", type: "text", column: "policy_number" },
  { key: "old_matter_number", label: "Legacy File Number", group: "Identifiers", type: "text", column: "old_matter_number" },
  // Parties
  { key: "patient_name", label: "Patient", group: "Parties", type: "text", column: "patient_name" },
  { key: "provider_name", label: "Provider", group: "Parties", type: "text", column: "provider_name", format: "provider" },
  { key: "treating_provider", label: "Treating Provider", group: "Parties", type: "text", column: "treating_provider", format: "provider" },
  { key: "insurer_name", label: "Insurer", group: "Parties", type: "category", column: "insurer_name", format: "provider" },
  { key: "settled_with", label: "Settled With", group: "Parties", type: "text", column: "settled_with", format: "provider" },
  // Financials
  { key: "claim_amount", label: "Claim Amount", group: "Financials", type: "number", column: "claim_amount", money: true },
  { key: "settled_amount", label: "Settled Amount", group: "Financials", type: "number", column: "settled_amount", money: true },
  { key: "interest_amount", label: "Interest Amount", group: "Financials", type: "number", column: "interest_amount", money: true },
  { key: "principal_fee", label: "Principal Fee", group: "Financials", type: "number", column: "principal_fee", money: true },
  { key: "interest_fee", label: "Interest Fee", group: "Financials", type: "number", column: "interest_fee", money: true },
  { key: "total_fee", label: "Total Fee", group: "Financials", type: "number", column: "total_fee", money: true },
  { key: "provider_net", label: "Provider Net", group: "Financials", type: "number", column: "provider_net", money: true },
  { key: "provider_principal_net", label: "Provider Principal Net", group: "Financials", type: "number", column: "provider_principal_net", money: true },
  { key: "provider_interest_net", label: "Provider Interest Net", group: "Financials", type: "number", column: "provider_interest_net", money: true },
  { key: "payment_amount", label: "Payment Amount", group: "Financials", type: "number", column: "payment_amount", money: true },
  { key: "payment_voluntary", label: "Voluntary Payment", group: "Financials", type: "number", column: "payment_voluntary", money: true },
  { key: "balance_amount", label: "Balance", group: "Financials", type: "number", column: "balance_amount", money: true },
  { key: "balance_presuit", label: "Pre-Suit Balance", group: "Financials", type: "number", column: "balance_presuit", money: true },
  { key: "overdue_days", label: "Overdue Days", group: "Financials", type: "number", column: "overdue_days" },
  // Dates (stored as strings in ClaimIndex; ISO-style compare)
  { key: "dos_range", label: "Date of Service", group: "Dates", type: "text" },
  { key: "date_of_loss", label: "Date of Loss", group: "Dates", type: "date", column: "date_of_loss" },
  { key: "status_date", label: "Status Date", group: "Dates", type: "date", column: "status_date" },
  { key: "date_bill_submitted", label: "Bill Submitted Date", group: "Dates", type: "date", column: "date_bill_submitted" },
  // Status & Classification
  { key: "status", label: "Status", group: "Status & Classification", type: "category", column: "status" },
  { key: "final_status", label: "Final Status", group: "Status & Classification", type: "category", column: "final_status" },
  { key: "close_reason", label: "Close Reason", group: "Status & Classification", type: "category", column: "close_reason" },
  { key: "denial_reason", label: "Denial Reason", group: "Status & Classification", type: "category", column: "denial_reason" },
  { key: "service_type", label: "Service Type", group: "Status & Classification", type: "category", column: "service_type" },
  { key: "case_type", label: "Case Type", group: "Status & Classification", type: "category", column: "case_type" },
  { key: "status_notes", label: "Status Notes", group: "Status & Classification", type: "text", column: "status_notes" },
  // Lawsuit link
  { key: "master_lawsuit_id", label: "Lawsuit Number", group: "Lawsuit", type: "text", column: "master_lawsuit_id" },
];

// Lawsuit attributes joined onto each matter via master_lawsuit_id. Reports always use matters +
// lawsuits together, so these appear as extra columns on every matter row (blank if not in a lawsuit).
export const LAWSUIT_JOIN_FIELDS: ReportField[] = [
  { key: "lawsuit_venue", label: "Lawsuit Venue / Court", group: "Lawsuit", type: "category" },
  { key: "lawsuit_index_aaa", label: "Lawsuit Index / AAA", group: "Lawsuit", type: "text" },
  { key: "lawsuit_amount_sought", label: "Lawsuit Amount Sought", group: "Lawsuit", type: "number", money: true },
  { key: "lawsuit_amount_basis", label: "Lawsuit Amount Basis", group: "Lawsuit", type: "category" },
  { key: "lawsuit_notes", label: "Lawsuit Notes", group: "Lawsuit", type: "text" },
  { key: "lawsuit_created", label: "Lawsuit Created", group: "Lawsuit", type: "date" },
  { key: "lawsuit_updated", label: "Lawsuit Updated", group: "Lawsuit", type: "date" },
];

export const REPORT_FIELDS: ReportField[] = [...MATTER_FIELDS, ...LAWSUIT_JOIN_FIELDS];

export function fieldsFor(): ReportField[] {
  return REPORT_FIELDS;
}

export function fieldMap(): Record<string, ReportField> {
  const out: Record<string, ReportField> = {};
  for (const f of REPORT_FIELDS) out[f.key] = f;
  return out;
}

export const AGGREGATIONS = [
  { key: "sum", label: "Sum" },
  { key: "avg", label: "Average" },
  { key: "count", label: "Count" },
  { key: "distinct", label: "Distinct Count" },
  { key: "min", label: "Min" },
  { key: "max", label: "Max" },
] as const;
export type AggregationKey = (typeof AGGREGATIONS)[number]["key"];
