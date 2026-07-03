import { parseMoney, parseDosSpan, toDateOnly } from "@/lib/import/parse";
import { computeBillFingerprint } from "@/lib/import/fingerprint";
import { toFirstLastProperCase, patientMatchKey } from "@/lib/patientResolution";

// Generic "other spreadsheet" adapter. Unlike Dow/Carisk (fixed column layouts), the operator MAPS
// each BM field to a source column at import time (with auto-suggested defaults). Provider and Case
// Type may be a mapped column OR an operator-picked single value (`fixed`). Pure — no DB.

// BM canonical fields the mapper exposes. `required` = the row can't create a matter without it (still
// held/flagged, never silently dropped). `resolve` marks registry-resolved holds (carrier/provider).
export const OTHER_FIELDS: { key: string; label: string; required?: boolean; aliases: string[] }[] = [
  { key: "claim_number_raw", label: "Claim Number", aliases: ["claim", "claimnumber", "claimno", "insuredsid", "claim #"] },
  { key: "policy_number", label: "Policy Number", aliases: ["policy", "policynumber", "policyno", "policy #"] },
  { key: "patient_name", label: "Patient", required: true, aliases: ["patient", "patientname", "patientsname", "insured", "claimant", "member"] },
  { key: "carrier_raw", label: "Insurer / Carrier", required: true, aliases: ["carrier", "carriername", "insurer", "insurance", "payer"] },
  { key: "date_of_loss", label: "Date of Injury", aliases: ["doi", "dateofinjury", "dateofloss", "dol", "accidentdate", "lossdate"] },
  { key: "dos_start", label: "Date(s) of Service", required: true, aliases: ["dos", "dateofservice", "servicedate", "dateservice", "dosstart"] },
  { key: "dos_end", label: "DOS end", aliases: ["dosend", "dateofserviceend", "servicedateend"] },
  { key: "claim_amount", label: "Gross Claim Amount", required: true, aliases: ["amount", "charges", "totalcharges", "billamount", "grosscharges", "billed"] },
  { key: "service_type", label: "Service Type", aliases: ["servicetype", "billtype", "specialty", "type"] },
  { key: "denial_reason", label: "Denial Reason", aliases: ["denial", "denialreason", "reason", "eob", "eor"] },
  { key: "treating_provider", label: "Treating Physician", aliases: ["physician", "physicianname", "provider", "doctor", "treating"] },
  { key: "case_type", label: "Case Type", aliases: ["casetype", "claimtype", "coverage", "lineofbusiness", "lob"] },
  { key: "cic_number", label: "CIC # (bill id)", aliases: ["cic", "cic #", "billid", "lineid"] },
];

export type OtherMapping = Record<string, string>; // bmField -> source column header
export type OtherFixed = { providerEntityId?: string; providerDisplayName?: string; caseType?: string };

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");

/** Auto-suggest a mapping by matching source headers to each field's aliases (best-effort). */
export function suggestMapping(headers: string[]): OtherMapping {
  const out: OtherMapping = {};
  const used = new Set<string>();
  for (const f of OTHER_FIELDS) {
    const wants = new Set([norm(f.key), norm(f.label), ...f.aliases.map(norm)]);
    const hit = headers.find((h) => !used.has(h) && wants.has(norm(h)));
    if (hit) { out[f.key] = hit; used.add(hit); }
  }
  return out;
}

// Case-type normalization to the BM set; unknown values are flagged (case_type_unknown) upstream.
const CASE_TYPE_MAP: Record<string, string> = {
  "no fault": "No-Fault", "nofault": "No-Fault", "nf": "No-Fault", "pip": "No-Fault", "auto": "No-Fault", "no-fault": "No-Fault",
  "wc": "Workers Compensation", "workers comp": "Workers Compensation", "workers compensation": "Workers Compensation", "ny wc": "Workers Compensation", "comp": "Workers Compensation",
  "lien": "Lien",
};
export function normalizeCaseType(raw: string): string {
  return CASE_TYPE_MAP[String(raw || "").trim().toLowerCase()] ?? "";
}

export type StagedOtherMatter = {
  claim_number_raw: string;
  policy_number: string;
  patient_name: string;
  patient_raw: string;
  carrier_raw: string;
  provider_raw: string; // "" when provider is a fixed pick
  date_of_loss: string;
  dos_start: string;
  dos_end: string;
  claim_amount: number | null;
  balance_presuit: number | null;
  service_type: string;
  denial_reason: string;
  treating_provider: string;
  case_type: string; // mapped+normalized, or fixed pick, or "" (unknown)
  case_type_raw: string;
  case_type_unknown: boolean;
  cic_number: string;
  fingerprint: string;
  errors: string[];
  raw: Record<string, unknown>;
};

function cell(row: Record<string, unknown>, mapping: OtherMapping, key: string): string {
  const col = mapping[key];
  if (!col) return "";
  const v = row[col];
  return v === null || v === undefined ? "" : String(v).trim();
}

/** Map ONE generic row using the operator's mapping + fixed picks. */
export function mapOtherRow(row: Record<string, unknown>, mapping: OtherMapping, fixed: OtherFixed): StagedOtherMatter {
  const claim = cell(row, mapping, "claim_number_raw");
  const policy = cell(row, mapping, "policy_number");
  const patientRaw = cell(row, mapping, "patient_name");
  const patient = toFirstLastProperCase(patientRaw);
  const carrier = cell(row, mapping, "carrier_raw");
  const dos = parseDosSpan(cell(row, mapping, "dos_start"));
  const amount = parseMoney(cell(row, mapping, "claim_amount"));

  const caseRaw = fixed.caseType ? fixed.caseType : cell(row, mapping, "case_type");
  const caseType = fixed.caseType ? fixed.caseType : normalizeCaseType(caseRaw);

  const errors: string[] = [];
  if (!claim && !policy) errors.push("Missing Claim Number or Policy Number.");
  if (!patient) errors.push("Missing patient name.");
  if (!carrier) errors.push("Missing carrier.");
  if (amount === null) errors.push("Missing/invalid amount.");
  if (!dos.start) errors.push("Missing/invalid date(s) of service.");
  if (!caseType && !caseRaw) errors.push("Missing case type.");

  const fingerprint = computeBillFingerprint({
    claimOrPolicy: claim || policy,
    patientKey: patientMatchKey(patient),
    dosStart: dos.start,
    dosEnd: dos.end,
    grossAmount: amount,
  });

  return {
    claim_number_raw: claim,
    policy_number: policy,
    patient_name: patient,
    patient_raw: patientRaw,
    carrier_raw: carrier,
    provider_raw: "", // provider is always operator-picked under Import OTHERS, never parsed
    date_of_loss: toDateOnly(cell(row, mapping, "date_of_loss")),
    dos_start: dos.start,
    dos_end: dos.end || dos.start,
    claim_amount: amount,
    balance_presuit: amount,
    service_type: cell(row, mapping, "service_type"),
    denial_reason: cell(row, mapping, "denial_reason"),
    treating_provider: toFirstLastProperCase(cell(row, mapping, "treating_provider")),
    case_type: caseType,
    case_type_raw: caseRaw,
    case_type_unknown: Boolean(caseRaw) && caseType === "",
    cic_number: cell(row, mapping, "cic_number"),
    fingerprint,
    errors,
    raw: row,
  };
}

export function mapOtherRows(rows: Record<string, unknown>[], mapping: OtherMapping, fixed: OtherFixed): StagedOtherMatter[] {
  return rows.filter((r) => Object.values(r).some((v) => String(v ?? "").trim() !== "")).map((r) => mapOtherRow(r, mapping, fixed));
}

/** Carisk-style extra columns to merge onto a created matter for a generic row. */
export function otherExtraFields(m: StagedOtherMatter): Record<string, unknown> {
  return {
    policy_number: m.policy_number || null,
    denial_reason: m.denial_reason || null,
    treating_provider: m.treating_provider || null,
    cic_number: m.cic_number || null,
  };
}
