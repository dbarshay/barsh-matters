// Required-field validation over an already-STAGED row (not the raw sheet), so it can be re-run after
// the operator patches missing values on the reconcile page. Returns the list of missing fields (with
// editable keys + labels) for a missing_field hold; empty means the row has all required values.

export type MissingField = { key: string; label: string };

// Editable key fields the missing-field dialog exposes, in display order. `numeric` fields are parsed
// as money; everything else is stored as written.
export const EDITABLE_FIELDS: { key: string; label: string; numeric?: boolean; cariskOnly?: boolean }[] = [
  { key: "cic_number", label: "CIC #", cariskOnly: true },
  { key: "claim_number_raw", label: "Claim # (insuredsID)" },
  { key: "patient_name", label: "Patient name" },
  { key: "carrier_raw", label: "Carrier" },
  { key: "provider_raw", label: "Provider (FacilityName)", cariskOnly: true },
  { key: "claim_amount", label: "Charges", numeric: true },
  { key: "dos_start", label: "DOS start" },
  { key: "dos_end", label: "DOS end" },
];

function blank(v: unknown): boolean {
  return v === null || v === undefined || String(v).trim() === "";
}

/** Which required fields are missing on a staged row, given the source. */
export function missingStagedFields(staged: Record<string, unknown>, source: string): MissingField[] {
  const missing: MissingField[] = [];
  const need = (key: string, label: string) => {
    if (blank(staged[key])) missing.push({ key, label });
  };

  if (source === "carisk") need("cic_number", "CIC #");
  need("claim_number_raw", "Claim # (insuredsID)");
  need("patient_name", "Patient name");
  need("carrier_raw", "Carrier");
  if (source === "carisk") need("provider_raw", "Provider (FacilityName)");
  if (staged["claim_amount"] === null || staged["claim_amount"] === undefined) missing.push({ key: "claim_amount", label: "Charges" });
  need("dos_start", "Date(s) of service");

  return missing;
}
