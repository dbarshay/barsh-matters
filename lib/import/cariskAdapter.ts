import { parseMoney, parseDosSpan, toDateOnly } from "@/lib/import/parse";
import { computeBillFingerprint } from "@/lib/import/fingerprint";
import { toFirstLastProperCase, patientMatchKey } from "@/lib/patientResolution";

// Carisk (searchResults export) adapter — maps a parsed spreadsheet row to a staged matter. Pure
// (no DB): carrier/provider/patient RESOLUTION, CIC# dedup, and status routing happen in the API layer.
// See docs/carisk-data-dictionary.md (authoritative, column by column).

// Status control values (col 8) that drive routing.
export const CARISK_STATUS_CREATE = "Carrier Submission"; // insurer accepted -> create matter
export const CARISK_STATUS_IGNORE = "Submitted"; // transient -> ignore entirely
export const CARISK_STATUS_REPORT = "Saved Incomplete"; // rejected incomplete -> Management Report

// ClaimType (col 11) -> our case_type. Unknown values are flagged, never guessed.
const CASE_TYPE_MAP: Record<string, string> = {
  "ny wc": "Workers Compensation",
  auto: "No-Fault",
};

export type StagedCariskMatter = {
  cic_number: string; // Carisk bill-unique key (hard dedup)
  claim_number_raw: string; // insuredsID (our claim number, as written)
  patient_name: string; // canonical "First Last"
  patient_raw: string;
  carrier_raw: string; // CarrierName -> resolved to carrier registry
  provider_raw: string; // FacilityName -> resolved to provider registry
  date_of_loss: string; // DOI -> YYYY-MM-DD
  dos_start: string;
  dos_end: string;
  treating_provider: string; // PhysicianName, proper-cased
  treating_physician_npi: string;
  treating_physician_license: string;
  provider_tin: string; // FacilityFedID normalized XX-XXXXXXX
  claim_amount: number | null; // totalCharges (gross)
  balance_presuit: number | null; // opens = gross
  case_type: string; // mapped ("Workers Compensation" | "No-Fault"), or "" when unknown
  case_type_raw: string; // original ClaimType
  case_type_unknown: boolean; // true when ClaimType wasn't NY WC / Auto
  service_type: string; // Carisk has no bill-type column
  status: string; // control field (routing)
  status_notes: string; // HTML stripped
  status_date: string;
  date_bill_submitted: string; // SubmittedDate
  carisk_operator: string; // UserName
  place_of_service_address: string;
  place_of_service_address2: string;
  place_of_service_city: string;
  place_of_service_state: string;
  place_of_service_zip: string;
  fingerprint: string;
  errors: string[];
  raw: Record<string, unknown>;
};

function s(v: unknown): string {
  return v === null || v === undefined ? "" : String(v).trim();
}

/** Strip HTML tags from a payer status message and collapse whitespace. */
export function stripHtml(raw: unknown): string {
  return String(raw ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

/** Normalize a Tax ID / EIN to `XX-XXXXXXX` when it has 9 digits; otherwise return trimmed input. */
export function normalizeTin(raw: unknown): string {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (digits.length === 9) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
  return s(raw);
}

/** Map ONE Carisk row to a staged matter (validation errors included, never thrown). */
export function mapCariskRow(row: Record<string, unknown>): StagedCariskMatter {
  const cic = s(row["CIC #"]);
  const claim = s(row["insuredsID"]);
  const patientRaw = s(row["PatientsName"]);
  const patient = toFirstLastProperCase(patientRaw);
  const carrier = s(row["CarrierName"]);
  const provider = s(row["FacilityName"]);
  const dateOfLoss = toDateOnly(row["DOI"]);
  const dos = parseDosSpan(row["DateOfService"]);
  const physician = toFirstLastProperCase(s(row["PhysicianName"]));
  const amount = parseMoney(row["totalCharges"]);
  const claimTypeRaw = s(row["ClaimType"]);
  const caseType = CASE_TYPE_MAP[claimTypeRaw.toLowerCase()] ?? "";
  const status = s(row["Status"]);

  const errors: string[] = [];
  if (!cic) errors.push("Missing CIC # (Carisk identity/dedup key).");
  if (!claim) errors.push("Missing claim number (insuredsID).");
  if (!patient) errors.push("Missing patient name.");
  if (!carrier) errors.push("Missing carrier (CarrierName).");
  if (!provider) errors.push("Missing provider (FacilityName).");
  if (amount === null) errors.push("Missing/invalid total charges.");
  if (!dos.start) errors.push("Missing/invalid date(s) of service.");

  const fingerprint = computeBillFingerprint({
    claimOrPolicy: cic || claim,
    patientKey: patientMatchKey(patient),
    dosStart: dos.start,
    dosEnd: dos.end,
    grossAmount: amount,
  });

  return {
    cic_number: cic,
    claim_number_raw: claim,
    patient_name: patient,
    patient_raw: patientRaw,
    carrier_raw: carrier,
    provider_raw: provider,
    date_of_loss: dateOfLoss,
    dos_start: dos.start,
    dos_end: dos.end,
    treating_provider: physician,
    treating_physician_npi: s(row["NPI"]),
    treating_physician_license: s(row["PhysicianLicenses"]),
    provider_tin: normalizeTin(row["FacilityFedID"]),
    claim_amount: amount,
    balance_presuit: amount,
    case_type: caseType,
    case_type_raw: claimTypeRaw,
    case_type_unknown: Boolean(claimTypeRaw) && caseType === "",
    service_type: "",
    status,
    status_notes: stripHtml(row["StatusNotes"]),
    status_date: toDateOnly(row["StatusDate"]),
    date_bill_submitted: toDateOnly(row["SubmittedDate"]),
    carisk_operator: s(row["UserName"]),
    place_of_service_address: s(row["FacilityAddress"]),
    place_of_service_address2: s(row["FacilityAddress1"]),
    place_of_service_city: s(row["FacilityCity"]),
    place_of_service_state: s(row["FacilityState"]),
    place_of_service_zip: s(row["FacilityZip"]),
    fingerprint,
    errors,
    raw: row,
  };
}

/** Map all Carisk rows, skipping fully-blank rows. */
export function mapCariskRows(rows: Record<string, unknown>[]): StagedCariskMatter[] {
  return rows.filter((r) => Object.values(r).some((v) => s(v) !== "")).map(mapCariskRow);
}

/** Carisk-specific ClaimIndex columns to merge onto a created matter (via CreatableRow.extra). */
export function cariskExtraFields(m: StagedCariskMatter): Record<string, unknown> {
  return {
    cic_number: m.cic_number,
    treating_provider: m.treating_provider || null,
    treating_physician_npi: m.treating_physician_npi || null,
    treating_physician_license: m.treating_physician_license || null,
    provider_tin: m.provider_tin || null,
    status_notes: m.status_notes || null,
    status_date: m.status_date || null,
    date_bill_submitted: m.date_bill_submitted || null,
    carisk_operator: m.carisk_operator || null,
    place_of_service_address: m.place_of_service_address || null,
    place_of_service_address2: m.place_of_service_address2 || null,
    place_of_service_city: m.place_of_service_city || null,
    place_of_service_state: m.place_of_service_state || null,
    place_of_service_zip: m.place_of_service_zip || null,
  };
}
