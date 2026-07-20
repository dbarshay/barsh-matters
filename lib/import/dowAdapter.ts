import { parseMoney, parseDosSpan, toDateOnly } from "@/lib/import/parse";
import { computeBillFingerprint } from "@/lib/import/fingerprint";
import { toFirstLastProperCase, patientMatchKey } from "@/lib/patientResolution";

// Dow (provider-sheet) adapter — maps a parsed spreadsheet row to a staged matter. Pure (no DB):
// patient/carrier/provider RESOLUTION and dedup lookups happen in the preview/confirm API layer.
// See docs/dow-data-dictionary.md.

export const DOW_CASE_TYPE = "No-Fault"; // Dow is No-Fault only (derived constant, no source column).

export type StagedDowMatter = {
  claim_number_raw: string; // insuredsID (our claim number, as written)
  patient_name: string; // canonical "First Last"
  patient_raw: string; // original, for raw_json
  carrier_raw: string; // resolved to insurer registry in the API layer
  date_of_loss: string; // DOI -> YYYY-MM-DD
  dos_start: string;
  dos_end: string;
  treating_provider: string; // PhysicianName, proper-cased
  claim_amount: number | null; // totalCharges (gross)
  balance_presuit: number | null; // opens = gross claim amount
  service_type: string; // BillType (Chiro/PT/EMG…)
  case_type: string; // "No-Fault"
  fingerprint: string; // dedup fingerprint
  errors: string[]; // validation errors (missing required / unparseable)
  raw: Record<string, unknown>; // full original row -> raw_json
};

function s(v: unknown): string {
  return v === null || v === undefined ? "" : String(v).trim();
}

/** Map ONE Dow row to a staged matter (validation errors included, never thrown). */
export function mapDowRow(row: Record<string, unknown>, caseType?: string): StagedDowMatter {
  const claim = s(row["insuredsID"]);
  const patientRaw = s(row["PatientsName"]);
  const patient = toFirstLastProperCase(patientRaw);
  const carrier = s(row["CarrierName"]);
  const dateOfLoss = toDateOnly(row["DOI"]);
  const dos = parseDosSpan(row["DateOfService"]);
  const physician = toFirstLastProperCase(s(row["PhysicianName"]));
  const amount = parseMoney(row["totalCharges"]);
  const billType = s(row["BillType"]);

  const errors: string[] = [];
  if (!claim) errors.push("Missing claim number (insuredsID).");
  if (!patient) errors.push("Missing patient name.");
  if (!carrier) errors.push("Missing carrier.");
  if (amount === null) errors.push("Missing/invalid total charges.");
  if (!dos.start) errors.push("Missing/invalid date(s) of service.");

  const fingerprint = computeBillFingerprint({
    claimOrPolicy: claim,
    patientKey: patientMatchKey(patient),
    dosStart: dos.start,
    dosEnd: dos.end,
    grossAmount: amount,
  });

  return {
    claim_number_raw: claim,
    patient_name: patient,
    patient_raw: patientRaw,
    carrier_raw: carrier,
    date_of_loss: dateOfLoss,
    dos_start: dos.start,
    dos_end: dos.end,
    treating_provider: physician,
    claim_amount: amount,
    balance_presuit: amount,
    service_type: billType,
    case_type: (caseType && caseType.trim()) || DOW_CASE_TYPE,
    fingerprint,
    errors,
    raw: row,
  };
}

/** Map all Dow rows, skipping fully-blank rows. */
export function mapDowRows(rows: Record<string, unknown>[], caseType?: string): StagedDowMatter[] {
  return rows.filter((r) => Object.values(r).some((v) => s(v) !== "")).map((r) => mapDowRow(r, caseType));
}
