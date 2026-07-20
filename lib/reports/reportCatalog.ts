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
  { key: "provider_name", label: "Provider", group: "Parties", type: "text", column: "provider_name" },
  { key: "treating_provider", label: "Treating Provider", group: "Parties", type: "text", column: "treating_provider" },
  { key: "insurer_name", label: "Insurer", group: "Parties", type: "category", column: "insurer_name" },
  { key: "settled_with", label: "Settled With", group: "Parties", type: "text", column: "settled_with" },
  // Financials
  { key: "claim_amount", label: "Claim Amount", group: "Financials", type: "number", column: "claim_amount" },
  { key: "settled_amount", label: "Settled Amount", group: "Financials", type: "number", column: "settled_amount" },
  { key: "allocated_settlement", label: "Allocated Settlement", group: "Financials", type: "number", column: "allocated_settlement" },
  { key: "interest_amount", label: "Interest Amount", group: "Financials", type: "number", column: "interest_amount" },
  { key: "principal_fee", label: "Principal Fee", group: "Financials", type: "number", column: "principal_fee" },
  { key: "interest_fee", label: "Interest Fee", group: "Financials", type: "number", column: "interest_fee" },
  { key: "total_fee", label: "Total Fee", group: "Financials", type: "number", column: "total_fee" },
  { key: "provider_net", label: "Provider Net", group: "Financials", type: "number", column: "provider_net" },
  { key: "provider_principal_net", label: "Provider Principal Net", group: "Financials", type: "number", column: "provider_principal_net" },
  { key: "provider_interest_net", label: "Provider Interest Net", group: "Financials", type: "number", column: "provider_interest_net" },
  { key: "payment_amount", label: "Payment Amount", group: "Financials", type: "number", column: "payment_amount" },
  { key: "payment_voluntary", label: "Voluntary Payment", group: "Financials", type: "number", column: "payment_voluntary" },
  { key: "balance_amount", label: "Balance", group: "Financials", type: "number", column: "balance_amount" },
  { key: "balance_presuit", label: "Pre-Suit Balance", group: "Financials", type: "number", column: "balance_presuit" },
  { key: "overdue_days", label: "Overdue Days", group: "Financials", type: "number", column: "overdue_days" },
  // Dates (stored as strings in ClaimIndex; ISO-style compare)
  { key: "dos_start", label: "Date of Service (Start)", group: "Dates", type: "date", column: "dos_start" },
  { key: "dos_end", label: "Date of Service (End)", group: "Dates", type: "date", column: "dos_end" },
  { key: "date_of_loss", label: "Date of Loss", group: "Dates", type: "date", column: "date_of_loss" },
  { key: "status_date", label: "Status Date", group: "Dates", type: "date", column: "status_date" },
  { key: "date_bill_submitted", label: "Bill Submitted Date", group: "Dates", type: "date", column: "date_bill_submitted" },
  // Status & Classification
  { key: "status", label: "Status", group: "Status & Classification", type: "category", column: "status" },
  { key: "final_status", label: "Final Status", group: "Status & Classification", type: "category", column: "final_status" },
  { key: "close_reason", label: "Close Reason", group: "Status & Classification", type: "category", column: "close_reason" },
  { key: "matter_stage_name", label: "Stage", group: "Status & Classification", type: "category", column: "matter_stage_name" },
  { key: "denial_reason", label: "Denial Reason", group: "Status & Classification", type: "category", column: "denial_reason" },
  { key: "service_type", label: "Service Type", group: "Status & Classification", type: "category", column: "service_type" },
  { key: "case_type", label: "Case Type", group: "Status & Classification", type: "category", column: "case_type" },
  { key: "status_notes", label: "Status Notes", group: "Status & Classification", type: "text", column: "status_notes" },
  // Lawsuit link
  { key: "master_lawsuit_id", label: "Lawsuit Number", group: "Lawsuit", type: "text", column: "master_lawsuit_id" },
];

export const LAWSUIT_FIELDS: ReportField[] = [
  // Identifiers
  { key: "masterLawsuitId", label: "Lawsuit Number", group: "Identifiers", type: "text", column: "masterLawsuitId" },
  { key: "oldLawsuitNumber", label: "Legacy Lawsuit Number", group: "Identifiers", type: "text", column: "oldLawsuitNumber" },
  { key: "claimNumber", label: "Claim Number", group: "Identifiers", type: "text", column: "claimNumber" },
  { key: "indexAaaNumber", label: "Index / AAA Number", group: "Identifiers", type: "text", column: "indexAaaNumber" },
  // Venue
  { key: "venue", label: "Venue / Court", group: "Venue", type: "category", column: "venue" },
  // Amounts
  { key: "amountSought", label: "Amount Sought", group: "Amounts", type: "number", column: "amountSought" },
  { key: "amountSoughtMode", label: "Amount Basis", group: "Amounts", type: "category", column: "amountSoughtMode" },
  { key: "customAmountSought", label: "Custom Amount Sought", group: "Amounts", type: "number", column: "customAmountSought" },
  // Rollups (derived from member matters)
  { key: "matterCount", label: "Matter Count", group: "Rollups", type: "number", rollup: true },
  { key: "totalClaimAmount", label: "Total Claim Amount", group: "Rollups", type: "number", rollup: true },
  { key: "totalBalancePresuit", label: "Total Pre-Suit Balance", group: "Rollups", type: "number", rollup: true },
  { key: "memberMatterNumbers", label: "Member Matter Numbers", group: "Rollups", type: "text", rollup: true },
  // Notes & meta
  { key: "lawsuitNotes", label: "Notes", group: "Meta", type: "text", column: "lawsuitNotes" },
  { key: "createdAt", label: "Created Date", group: "Meta", type: "date", column: "createdAt" },
  { key: "updatedAt", label: "Updated Date", group: "Meta", type: "date", column: "updatedAt" },
];

export function fieldsFor(base: ReportBase): ReportField[] {
  return base === "lawsuit" ? LAWSUIT_FIELDS : MATTER_FIELDS;
}

export function fieldMap(base: ReportBase): Record<string, ReportField> {
  const out: Record<string, ReportField> = {};
  for (const f of fieldsFor(base)) out[f.key] = f;
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
