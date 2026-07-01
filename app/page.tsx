"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import BarshHeaderQuickNav from "@/app/components/BarshHeaderQuickNav";
import BarshHeaderActions from "@/app/components/BarshHeaderActions";
import BarshHeader from "@/app/components/BarshHeader";

type SearchKind = "brl_matter" | "numeric_ambiguous" | "master" | "text";

type MatterResult = {
  id: string;
  displayNumber: string;
  patient: string;
  provider: string;
  insurer: string;
  claimNumber: string;
  masterLawsuitId: string;
  claimAmount: any;
  matchedBy: string;
  court: string;
  adversaryAttorney: string;
  denialReason: string;
  status: string;
  finalStatus: "Open" | "Closed";
};

type AdvancedPicklistOption = {
  value: string;
  label: string;
};

type AdvancedSearchFields = {
  patient: string;
  provider: string;
  insuranceCompany: string;
  claim: string;
  indexAaaNumber: string;
  dateOpenedFrom: string;
  dateOpenedTo: string;
  policyNumber: string;
  accidentDate: string;
  serviceType: string;
  court: string;
  adversaryAttorney: string;
  dosStart: string;
  dosEnd: string;
  denialReason: string;
  status: string;
  closeReason: string;
  finalStatus: string;
};



const colors = {
  ink: "#00346e",
  muted: "#385a83",
  subtle: "#385a83",
  line: "#d7dee9",
  lineSoft: "#e5e7eb",
  page: "#eef2f7",
  panel: "#ffffff",
  blue: "#00346e",
  blueDark: "#00346e",
  errorBg: "#fef2f2",
  errorBorder: "#fecaca",
};

function clean(v: any) {
  return String(v || "").trim();
}

function emptyAdvancedSearchFields(): AdvancedSearchFields {
  return {
    patient: "",
    provider: "",
    insuranceCompany: "",
    claim: "",
    indexAaaNumber: "",
    dateOpenedFrom: "",
    dateOpenedTo: "",
    policyNumber: "",
    accidentDate: "",
    serviceType: "",
    court: "",
    adversaryAttorney: "",
    dosStart: "",
    dosEnd: "",
    denialReason: "",
    status: "",
    closeReason: "",
    finalStatus: "",
  };
}

function lower(v: any) {
  return clean(v).toLowerCase();
}

function compact(v: any) {
  return lower(v).replace(/[\s.\-_/]+/g, "");
}

function matterId(m: any) {
  return clean(m?.matterId ?? m?.matter_id ?? m?.id);
}

function displayNumber(m: any) {
  return (
    clean(m?.displayNumber) ||
    clean(m?.display_number) ||
    clean(m?.matterNumber) ||
    clean(m?.matter_number) ||
    matterId(m)
  );
}

function masterLawsuitId(m: any) {
  return clean(m?.masterLawsuitId ?? m?.master_lawsuit_id);
}

function nameLike(v: any) {
  if (v == null) return "";
  if (typeof v === "object") {
    return clean(
      v.name ??
        v.displayName ??
        v.display_name ??
        v.fullName ??
        v.full_name ??
        v.value ??
        ""
    );
  }

  return clean(v);
}

function patientName(m: any) {
  return nameLike(
    m?.patientName ??
      m?.patient_name ??
      m?.patient
  );
}

function providerName(m: any) {
  return nameLike(
    m?.clientName ??
      m?.client_name ??
      m?.providerName ??
      m?.provider_name ??
      m?.provider ??
      m?.client
  );
}

function insurerName(m: any) {
  return nameLike(
    m?.insurerName ??
      m?.insurer_name ??
      m?.insuranceCompany ??
      m?.insurance_company ??
      m?.insurer
  );
}

function adversaryAttorneyName(m: any) {
  return nameLike(
    m?.adversaryAttorney ??
      m?.adversary_attorney ??
      m?.adversaryAttorneyName ??
      m?.adversary_attorney_name
  );
}


function claimNumberFromMatter(m: any, fallbackClaimNumber = "") {
  return clean(
    m?.claimNumber ??
      m?.claim_number ??
      m?.claimNumberNormalized ??
      m?.claim_number_normalized ??
      fallbackClaimNumber
  );
}

function indexAaaNumberFromMatter(m: any) {
  return clean(
    m?.indexAaaNumber ??
      m?.index_aaa_number ??
      m?.indexAAANumber ??
      m?.indexNumber ??
      m?.index_number ??
      ""
  );
}

function statusFromMatter(m: any) {
  return clean(m?.status ?? m?.matterStage ?? m?.matter_stage ?? m?.stage ?? "");
}

function finalStatusFromMatter(m: any) {
  return clean(m?.finalStatus ?? m?.final_status ?? "");
}

function denialReasonFromMatter(m: any) {
  return clean(m?.denialReason ?? m?.denial_reason ?? "");
}

function homeDetailedStatusFromMatter(m: any) {
  return clean(
    m?.matterStageName ??
      m?.matter_stage_name ??
      m?.status ??
      m?.matterStage?.name ??
      m?.matter_stage?.name ??
      m?.matterStage ??
      m?.matter_stage ??
      m?.stage ??
      ""
  );
}

function homeFinalStatusFromMatter(m: any): "Open" | "Closed" {
  const explicitFinalStatus = clean(m?.finalStatus ?? m?.final_status ?? "").toLowerCase();
  if (explicitFinalStatus === "closed") return "Closed";
  if (explicitFinalStatus === "open") return "Open";

  const closeReason = clean(
    m?.closeReason ??
      m?.close_reason ??
      m?.closedReason ??
      m?.closed_reason ??
      ""
  );

  if (closeReason) return "Closed";
  return "Open";
}

function homeStatusBadgeStyle(status: "Open" | "Closed"): React.CSSProperties {
  const closed = status === "Closed";
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 58,
    borderRadius: 999,
    padding: "3px 8px",
    fontSize: 12,
    fontWeight: 900,
    color: closed ? "#991b1b" : "#166534",
    background: closed ? "#fee2e2" : "#dcfce7",
    border: `1px solid ${closed ? "#fecaca" : "#bbf7d0"}`,
  };
}

const ADVANCED_SEARCH_FIELD_IDS = {
  patient: 22145885,
  insuranceCompany: 22145900,
  claimNumber: 22145915,
  dosStart: 22145960,
  dosEnd: 22145975,
  denialReason: 22146035,
  indexAaaNumber: 22146050,
  closeReason: 22145660,
  dateOfLoss: 22405400,
  serviceType: 22146005,
  policyNumber: 22403975,
  paymentVoluntary: 22296515,
  balancePresuit: 22296530,
} as const;

function customFieldRecordFieldId(cfv: any) {
  const raw =
    cfv?.custom_field?.id ??
    cfv?.customField?.id ??
    cfv?.custom_field_id ??
    cfv?.customFieldId ??
    cfv?.field_id ??
    cfv?.fieldId ??
    cfv?.custom_field;

  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function customFieldIdValue(row: any, fieldId: number) {
  const values = Array.isArray(row?.custom_field_values)
    ? row.custom_field_values
    : Array.isArray(row?.customFieldValues)
      ? row.customFieldValues
      : [];

  const match = values.find((cfv: any) => customFieldRecordFieldId(cfv) === fieldId);

  if (!match) return "";

  return clean(
    match?.value ??
    match?.display_value ??
    match?.displayValue ??
    match?.text ??
    ""
  );
}

function customFieldIdMatches(row: any, fieldId: number, expected: string) {
  const q = clean(expected);
  if (!q) return true;

  const actual = customFieldIdValue(row, fieldId);

  if (!actual) return false;

  return exactOrContains(actual, q);
}

const DENIAL_REASON_PICKLIST_OPTIONS = [
  { value: "12497975|12498110", label: "Medical Necessity (IME)" },
  { value: "12498065|12498155", label: "Fee Schedule / Coding" },
];

const FINAL_STATUS_THREE_OPTIONS = [
  { value: "Open", label: "Open" },
  { value: "Pending", label: "Pending" },
  { value: "Closed", label: "Closed" },
];

const FINAL_STATUS_PICKLIST_OPTIONS = [
  { value: "12497450", label: "Closed" },
  { value: "12497555", label: "PAID (SETTLEMENT)" },
];

const SERVICE_TYPE_PICKLIST_OPTIONS = [
  { value: "12497915", label: "ANESTHESIA" },
  { value: "12497930", label: "CHIROPRACTIC" },
  { value: "12509225", label: "DENTAL" },
  { value: "12509240", label: "DISABILITY EXAM" },
  { value: "12509255", label: "DME" },
  { value: "12509270", label: "EEG" },
  { value: "12509285", label: "EM VISIT-FOLLOW UP" },
  { value: "12509300", label: "EM VISIT-INITIAL" },
  { value: "12509315", label: "EMG/NCV" },
  { value: "12509330", label: "EPIDURAL INJECTION" },
  { value: "12509345", label: "FACILITY FEE" },
  { value: "12509360", label: "FLUOROSCOPY" },
  { value: "12509375", label: "MUA" },
  { value: "12509390", label: "NERVE BLOCK" },
  { value: "12509405", label: "OT" },
  { value: "12509420", label: "OUTCOME ASSESSMENT" },
  { value: "12509435", label: "PHARMACY" },
  { value: "12509450", label: "PHYSICAL CAPACITY TESTING" },
  { value: "12509465", label: "PSYCH" },
  { value: "12509480", label: "PT" },
  { value: "12509495", label: "RADIOLOGY-CT" },
  { value: "12509510", label: "RADIOLOGY-MRI" },
  { value: "12509525", label: "RADIOLOGY-XRAY" },
  { value: "12509540", label: "ROM/MMT" },
  { value: "12509555", label: "SONOGRAM" },
  { value: "12509570", label: "SPINAL DECOMPRESSION" },
  { value: "12509585", label: "SURGERY" },
  { value: "12509600", label: "ULTRASOUND" },
  { value: "12509615", label: "UNKNOWN" },
];


const CLOSE_REASON_PICKLIST_OPTIONS = [
  { value: "12497450", label: "AAA- DECISION- DISMISSED WITH PREJUDICE" },
  { value: "12497465", label: "AAA- VOLUNTARILY WITHDRAWN WITH PREJUDICE" },
  { value: "12497480", label: "DISCONTINUED WITH PREJUDICE" },
  { value: "12497495", label: "MOTION LOSS" },
  { value: "12497510", label: "OUT OF STATE CARRIER" },
  { value: "12497525", label: "PAID (DECISION)" },
  { value: "12497540", label: "PAID (JUDGMENT)" },
  { value: "12497555", label: "PAID (SETTLEMENT)" },
  { value: "12497570", label: "PAID (FEE SCHEDULE)" },
  { value: "12497585", label: "PAID (VOLUNTARY)" },
  { value: "12497600", label: "PER CLIENT" },
  { value: "12497615", label: "POLICY CANCELLED" },
  { value: "12497630", label: "POLICY EXHAUSTED/NO COVERAGE" },
  { value: "12497645", label: "PPO" },
  { value: "12497660", label: "SOL" },
  { value: "12497675", label: "TRIAL LOSS" },
  { value: "12497690", label: "WORKERS COMPENSATION" },
  { value: "12497825", label: "TRANSFERRED TO LB" },
];


const ADVANCED_SEARCH_PICKLIST_LABELS: Record<number, Record<string, string[]>> = {
  [ADVANCED_SEARCH_FIELD_IDS.denialReason]: {
    "12497975": ["Medical Necessity (IME)", "Medical Necessity", "IME"],
    "12498110": ["Medical Necessity (IME)", "Medical Necessity", "IME"],
    "12498065": ["Fee Schedule / Coding", "Fee Schedule", "Coding"],
    "12498155": ["Fee Schedule / Coding", "Fee Schedule", "Coding"],
  },

};

function picklistOptionLabelForValue(fieldId: number, rawValue: string) {
  const raw = clean(rawValue);
  if (!raw) return "";

  const localOptions =
    fieldId === ADVANCED_SEARCH_FIELD_IDS.serviceType
      ? SERVICE_TYPE_PICKLIST_OPTIONS
      : fieldId === ADVANCED_SEARCH_FIELD_IDS.closeReason
        ? CLOSE_REASON_PICKLIST_OPTIONS
        : fieldId === ADVANCED_SEARCH_FIELD_IDS.denialReason
          ? DENIAL_REASON_PICKLIST_OPTIONS
          : [];

  return clean(localOptions.find((option) => clean(option.value) === raw)?.label);
}

function picklistSearchTextForValue(fieldId: number, rawValue: string) {
  const raw = clean(rawValue);
  const directLabel = picklistOptionLabelForValue(fieldId, raw);
  const labels = ADVANCED_SEARCH_PICKLIST_LABELS[fieldId]?.[raw] || [];

  return [raw, directLabel, ...labels].filter(Boolean).join(" | ");
}

function customPicklistFieldIdMatches(row: any, fieldId: number, expected: string) {
  const q = clean(expected);
  if (!q) return true;

  const raw = customFieldIdValue(row, fieldId);
  if (!raw) return false;

  const expectedValues = q.split("|").map((part) => clean(part)).filter(Boolean);

  for (const expectedValue of expectedValues.length ? expectedValues : [q]) {
    const searchable = picklistSearchTextForValue(fieldId, raw);
    const expectedSearchable = picklistSearchTextForValue(fieldId, expectedValue);

    if (exactOrContains(raw, expectedValue)) return true;
    if (exactOrContains(searchable, expectedValue)) return true;
    if (exactOrContains(searchable, expectedSearchable)) return true;
    if (exactOrContains(expectedSearchable, searchable)) return true;
  }

  return false;
}

function picklistFieldMatchesAnySource(
  row: any,
  fieldId: number,
  expected: string,
  rowKeys: string[]
) {
  const q = clean(expected);
  if (!q) return true;

  const expectedValues = q.split("|").map((part) => clean(part)).filter(Boolean);
  const valuesToCheck = expectedValues.length ? expectedValues : [q];

  const candidateValues = [
    customFieldIdValue(row, fieldId),
    ...rowKeys.map((key) => clean(row?.[key])),
  ].filter(Boolean);

  for (const expectedValue of valuesToCheck) {
    const qSearchable = picklistSearchTextForValue(fieldId, expectedValue);

    for (const value of candidateValues) {
      const valueSearchable = picklistSearchTextForValue(fieldId, value);

      if (exactOrContains(value, expectedValue)) return true;
      if (exactOrContains(valueSearchable, expectedValue)) return true;
      if (exactOrContains(valueSearchable, qSearchable)) return true;
      if (exactOrContains(qSearchable, valueSearchable)) return true;
    }
  }

  return false;
}

function normalizeDateForSearch(value: any) {
  const raw = clean(value);
  if (!raw) return "";

  const iso = raw.match(/\d{4}-\d{2}-\d{2}/)?.[0];
  if (iso) return iso;

  const slash = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash) {
    const [, mm, dd, yyyy] = slash;
    return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  }

  return raw.slice(0, 10);
}

function dateFieldMatches(actual: any, expected: string) {
  const actualDate = normalizeDateForSearch(actual);
  const expectedDate = normalizeDateForSearch(expected);

  if (!expectedDate) return true;
  if (!actualDate) return false;

  return actualDate === expectedDate;
}

function customFieldDateIdMatches(row: any, fieldId: number, expected: string) {
  const q = clean(expected);
  if (!q) return true;

  return dateFieldMatches(customFieldIdValue(row, fieldId), q);
}

function supportedFieldValueFromMatter(m: any, keys: string[]) {
  for (const key of keys) {
    const value = m?.[key];

    if (value == null) continue;

    if (typeof value === "object") {
      const named = nameLike(value);
      if (named) return named;
    }

    const cleanValue = clean(value);
    if (cleanValue) return cleanValue;
  }

  return "";
}

function supportedFieldMatches(row: any, expected: string, keys: string[]) {
  const q = clean(expected);
  if (!q) return true;

  return exactOrContains(supportedFieldValueFromMatter(row, keys), q);
}

function supportedMoneyMatches(row: any, expected: string, keys: string[]) {
  const qRaw = clean(expected);
  if (!qRaw) return true;

  const q = Number(qRaw.replace(/[$,]/g, ""));
  if (!Number.isFinite(q)) return false;

  for (const key of keys) {
    const raw = row?.[key];
    const n = Number(String(raw ?? "").replace(/[$,]/g, ""));

    if (Number.isFinite(n) && Math.abs(n - q) < 0.01) return true;
  }

  return false;
}

function formatDateForDisplay(value: any) {
  const raw = clean(value);
  if (!raw) return "";

  const iso = raw.match(/\d{4}-\d{2}-\d{2}/)?.[0];
  if (!iso) return raw;

  const [yyyy, mm, dd] = iso.split("-");
  return `${mm}/${dd}/${yyyy}`;
}

function supportedDateValueFromMatter(row: any, keys: string[]) {
  for (const key of keys) {
    const raw = clean(row?.[key]);

    if (raw) return raw.slice(0, 10);
  }

  return "";
}

function supportedDateMatches(row: any, expected: string, keys: string[]) {
  const q = clean(expected);
  if (!q) return true;

  const raw = supportedDateValueFromMatter(row, keys);
  if (!raw) return false;

  return exactOrContains(raw, q);
}

function supportedDateRangeMatches(row: any, from: string, to: string, keys: string[]) {
  const start = clean(from);
  const end = clean(to);

  if (!start && !end) return true;

  const raw = supportedDateValueFromMatter(row, keys);
  if (!raw) return false;

  if (start && raw < start) return false;
  if (end && raw > end) return false;

  return true;
}

function advancedActualValuesFromMatter(row: any) {
  return {
    patient: supportedFieldValueFromMatter(row, ["patientName", "patient_name", "patient"]),
    provider: supportedFieldValueFromMatter(row, ["providerName", "provider_name", "provider", "clientName", "client_name", "client"]),
    insuranceCompany: supportedFieldValueFromMatter(row, ["insuranceCompany", "insurance_company", "insurerName", "insurer_name", "insurer"]),
    claim: supportedFieldValueFromMatter(row, ["claimNumber", "claim_number", "claimNumberNormalized", "claim_number_normalized"]),
    indexAaaNumber: supportedFieldValueFromMatter(row, ["indexAaaNumber", "index_aaa_number", "indexAAANumber", "indexNumber", "index_number"]),
    dateOpened: supportedDateValueFromMatter(row, ["dateOpened", "date_opened", "openedAt", "opened_at", "createdAt", "created_at"]),
    policyNumber: supportedFieldValueFromMatter(row, ["policyNumber", "policy_number", "policy"]),
    dateOfLoss: supportedDateValueFromMatter(row, ["dateOfLoss", "date_of_loss", "accidentDate", "accident_date", "lossDate", "loss_date"]),
    serviceType:
      picklistOptionLabelForValue(
        ADVANCED_SEARCH_FIELD_IDS.serviceType,
        customFieldIdValue(row, ADVANCED_SEARCH_FIELD_IDS.serviceType)
      ) || supportedFieldValueFromMatter(row, ["serviceType", "service_type"]),
    court: supportedFieldValueFromMatter(row, ["court", "courtName", "court_name", "venue", "venueSelection", "venue_selection"]),
    adversaryAttorney: supportedFieldValueFromMatter(row, ["adversaryAttorney", "adversary_attorney", "adversaryAttorneyName", "adversary_attorney_name"]),
    dosStart:
      supportedFieldValueFromMatter(row, ["dosStart", "dos_start_display"]) ||
      formatDateForDisplay(customFieldIdValue(row, ADVANCED_SEARCH_FIELD_IDS.dosStart)) ||
      supportedDateValueFromMatter(row, ["dos_start"]),
    dosEnd:
      supportedFieldValueFromMatter(row, ["dosEnd", "dos_end_display"]) ||
      formatDateForDisplay(customFieldIdValue(row, ADVANCED_SEARCH_FIELD_IDS.dosEnd)) ||
      supportedDateValueFromMatter(row, ["dos_end"]),
    denialReason:
      picklistOptionLabelForValue(
        ADVANCED_SEARCH_FIELD_IDS.denialReason,
        customFieldIdValue(row, ADVANCED_SEARCH_FIELD_IDS.denialReason)
      ) || supportedFieldValueFromMatter(row, ["denialReason", "denial_reason"]),
    status: supportedFieldValueFromMatter(row, ["status", "matterStage", "matter_stage", "stage"]),
    closeReason:
      picklistOptionLabelForValue(
        ADVANCED_SEARCH_FIELD_IDS.closeReason,
        customFieldIdValue(row, ADVANCED_SEARCH_FIELD_IDS.closeReason)
      ) || supportedFieldValueFromMatter(row, ["closeReason", "close_reason", "finalStatus", "final_status"]),
    finalStatus: supportedFieldValueFromMatter(row, ["status", "finalStatus", "final_status"]),
  };
}

function advancedDisplayValue(label: string, value: any) {
  const raw = clean(value);

  if (!raw) return "";

  if (label === "Denial Reason") {
    return picklistSearchTextForValue(ADVANCED_SEARCH_FIELD_IDS.denialReason, raw);
  }

  if (label === "Close Reason") {
    return picklistSearchTextForValue(ADVANCED_SEARCH_FIELD_IDS.closeReason, raw);
  }

  if (label === "Final Status") {
    return raw;
  }

  return raw;
}

function advancedFieldReadbackRows(row: any) {
  const values = advancedActualValuesFromMatter(row);

  return [
    ["Patient", values.patient],
    ["Provider", values.provider],
    ["Insurance Company", values.insuranceCompany],
    ["Claim Number", values.claim],
    ["Index / AAA Number", values.indexAaaNumber],
    ["Date Opened", values.dateOpened],
    ["Policy Number", values.policyNumber],
    ["Date of Loss", values.dateOfLoss],
    ["Service Type", values.serviceType],
    ["Court", values.court],
    ["DOS Start", values.dosStart],
    ["DOS End", values.dosEnd],
    ["Denial Reason", values.denialReason],
    ["Status", values.status],
    ["Close Reason", values.closeReason],
    ["Final Status", values.finalStatus],
  ];
}

function fieldValueFromMatter(m: any, keys: string[]) {
  for (const key of keys) {
    const value = m?.[key];

    if (value == null) continue;

    if (typeof value === "object") {
      const named = nameLike(value);
      if (named) return named;
    }

    const cleanValue = clean(value);
    if (cleanValue) return cleanValue;
  }

  return "";
}

function dateLikeFromMatter(m: any, keys: string[]) {
  const raw = fieldValueFromMatter(m, keys);
  if (!raw) return "";

  return raw.slice(0, 10);
}

function fieldMatches(row: any, expected: string, keys: string[]) {
  const q = clean(expected);
  if (!q) return true;

  return exactOrContains(fieldValueFromMatter(row, keys), q);
}

function fieldDateMatches(row: any, expected: string, keys: string[]) {
  const q = clean(expected);
  if (!q) return true;

  return exactOrContains(dateLikeFromMatter(row, keys), q);
}

function fieldDateRangeMatches(row: any, from: string, to: string, keys: string[]) {
  const raw = dateLikeFromMatter(row, keys);
  const start = clean(from);
  const end = clean(to);

  if (!start && !end) return true;
  if (!raw) return false;

  if (start && raw < start) return false;
  if (end && raw > end) return false;

  return true;
}

function money(v: any) {
  const n = Number(v ?? 0);
  return Number.isFinite(n)
    ? n.toLocaleString("en-US", { style: "currency", currency: "USD" })
    : "$0.00";
}

function isBrlMatterInput(q: string) {
  return /^BRL\s*-?\s*\d+$/i.test(q);
}

function normalizeBrlMatterInput(q: string) {
  const m = clean(q).match(/^BRL\s*-?\s*(\d+)$/i);
  return m ? `BRL${m[1]}` : clean(q);
}

function isNumericOnly(q: string) {
  return /^\d+$/.test(clean(q));
}

function numericToBrlMatter(q: string) {
  return `BRL${clean(q)}`;
}

function isMasterLawsuitInput(q: string) {
  return /^\d{4}\.\d{2}\.\d{5}$/.test(clean(q));
}

function classifySearch(q: string): SearchKind {
  if (isBrlMatterInput(q)) return "brl_matter";
  if (isMasterLawsuitInput(q)) return "master";
  if (isNumericOnly(q)) return "numeric_ambiguous";
  return "text";
}

function exactOrContains(haystack: string, q: string) {
  const h = lower(haystack);
  const n = lower(q);
  return h === n || h.includes(n);
}

function rowMatchesText(row: any, q: string, matchedBy: string) {
  if (matchedBy === "Patient") return exactOrContains(patientName(row), q);
  if (matchedBy === "Provider") return exactOrContains(providerName(row), q);
  return exactOrContains(patientName(row), q) || exactOrContains(providerName(row), q);
}

function toMatterResult(row: any, matchedBy: string, fallbackClaimNumber = ""): MatterResult | null {
  const id = matterId(row);
  if (!id) return null;

  const advancedValues = advancedActualValuesFromMatter(row);

  return {
    id,
    displayNumber: displayNumber(row),
    patient: patientName(row),
    provider: providerName(row),
    insurer: insurerName(row),
    claimNumber: claimNumberFromMatter(row, fallbackClaimNumber),
    masterLawsuitId: masterLawsuitId(row),
    claimAmount: row?.claimAmount ?? row?.claim_amount,
    matchedBy,
    court: advancedValues.court,
    adversaryAttorney: advancedValues.adversaryAttorney,
    denialReason: advancedDisplayValue("Denial Reason", advancedValues.denialReason),
    status: homeDetailedStatusFromMatter(row),
    finalStatus: homeFinalStatusFromMatter(row),
  };
}

function dedupeMatterResults(rows: MatterResult[]) {
  const seen = new Set<string>();
  const out: MatterResult[] = [];

  for (const row of rows) {
    if (!row.id || seen.has(row.id)) continue;
    seen.add(row.id);
    out.push(row);
  }

  return out;
}

function uniqueSuggestionValues(values: string[], limit = 12) {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const value of values) {
    const cleanValue = clean(value);
    const key = lower(cleanValue);

    if (!cleanValue || seen.has(key)) continue;

    seen.add(key);
    out.push(cleanValue);

    if (out.length >= limit) break;
  }

  return out;
}

async function fetchMatterByDisplayNumber(displayNumberValue: string) {
  const res = await fetch(`/api/claim-index/by-matter?displayNumber=${encodeURIComponent(displayNumberValue)}`, {
    cache: "no-store",
  });

  const json = await res.json();
  if (!res.ok || !json?.ok) {
    throw new Error(json?.error || "Matter lookup failed.");
  }

  if (Array.isArray(json.matters)) return json.matters;
  if (json.matter) return [json.matter];
  if (json.overlay) return [json.overlay];
  if (json.row) return [json.row];
  if (json.displayNumber || json.display_number || json.matterId || json.id) return [json];

  return [];
}

async function fetchFastRows(url: string) {
  const res = await fetch(url, { cache: "no-store" });
  const json = await res.json();

  if (!res.ok || !json?.ok) {
    throw new Error(json?.error || "Search failed.");
  }

  return Array.isArray(json.rows) ? json.rows : [];
}

async function hydrateAdvancedRows(rows: any[]) {
  // Local-first transition: advanced search candidates already come from ClaimIndex.
  // Do not call legacy Clio hydration.  ClaimIndex/local Barsh Matters is the operational source of truth.
  return Array.isArray(rows) ? rows : [];
}

async function fetchAdvancedFallbackCandidateRows(limit = 750) {
  const rows = await fetchFastRows(
    `/api/advanced-search/candidates?limit=${encodeURIComponent(String(limit))}`
  );

  return Array.isArray(rows) ? rows : [];
}


async function fetchAdvancedCandidateRows(fields: AdvancedSearchFields, limit = 250) {
  const params = new URLSearchParams();

  const entries: Array<[keyof AdvancedSearchFields, string]> = [
    ["patient", fields.patient],
    ["provider", fields.provider],
    ["insuranceCompany", fields.insuranceCompany],
    ["claim", fields.claim],
    ["indexAaaNumber", fields.indexAaaNumber],
    ["dateOpenedFrom", fields.dateOpenedFrom],
    ["dateOpenedTo", fields.dateOpenedTo],
    ["adversaryAttorney", fields.adversaryAttorney],
    ["dosStart", fields.dosStart],
    ["dosEnd", fields.dosEnd],
    ["denialReason", fields.denialReason],
    ["status", fields.status],
    ["closeReason", fields.closeReason],
    ["finalStatus", fields.finalStatus],
  ];

  for (const [key, value] of entries) {
    const v = clean(value);
    if (v) params.set(String(key), v);
  }

  params.set("limit", String(limit));

  if ([...params.keys()].filter((key) => key !== "limit").length === 0) {
    return [];
  }

  return fetchFastRows(`/api/advanced-search/candidates?${params.toString()}`);
}

async function hydrateMatterResultFromContext(
  base: MatterResult,
  matchedBy: string,
  fallbackClaimNumber = ""
): Promise<MatterResult> {
  if (!base?.id) return base;

  try {
    const res = await fetch(`/api/claim-index/by-matter?matterId=${encodeURIComponent(base.id)}`, {
      cache: "no-store",
    });

    const json = await res.json();

    if (!res.ok || !json?.ok) return base;

    const contextMatter = json?.matter ?? json;
    const hydrated = toMatterResult(
      {
        ...contextMatter,
        matterId: contextMatter?.id ?? base.id,
        displayNumber: contextMatter?.displayNumber ?? contextMatter?.display_number ?? base.displayNumber,
        patientName: contextMatter?.patient?.name ?? contextMatter?.patientName ?? contextMatter?.patient_name,
        providerName:
          contextMatter?.client?.name ??
          contextMatter?.providerName ??
          contextMatter?.provider_name ??
          base.provider,
        insurerName: contextMatter?.insurer?.name ?? contextMatter?.insurerName ?? contextMatter?.insurer_name,
        claimNumber: contextMatter?.claimNumber ?? contextMatter?.claim_number ?? base.claimNumber,
        masterLawsuitId:
          contextMatter?.masterLawsuitId ?? contextMatter?.master_lawsuit_id ?? base.masterLawsuitId,
        claimAmount: contextMatter?.claimAmount ?? contextMatter?.claim_amount ?? base.claimAmount,
      },
      matchedBy,
      fallbackClaimNumber
    );
    return hydrated || base;
  } catch {
    return base;
  }
}

async function getEntrySearchResults(qInput: string): Promise<{
  checkedLabel: string;
  results: MatterResult[];
}> {
  const q = clean(qInput);

  if (!q) {
    return { checkedLabel: "", results: [] };
  }

  const kind = classifySearch(q);
  const mapped: MatterResult[] = [];

  if (kind === "brl_matter") {
    const matterDisplay = normalizeBrlMatterInput(q);
    const matters = await fetchMatterByDisplayNumber(matterDisplay);

    for (const row of matters) {
      if (compact(displayNumber(row)) !== compact(matterDisplay)) continue;
      const mappedRow = toMatterResult(row, "Matter number");
      if (mappedRow) mapped.push(await hydrateMatterResultFromContext(mappedRow, "Matter number"));
    }

    return { checkedLabel: "Matter number", results: dedupeMatterResults(mapped) };
  }

  if (kind === "numeric_ambiguous") {
    const matterDisplay = numericToBrlMatter(q);
    const matters = await fetchMatterByDisplayNumber(matterDisplay);

    for (const row of matters) {
      if (compact(displayNumber(row)) !== compact(matterDisplay)) continue;
      const mappedRow = toMatterResult(row, "Matter number");
      if (mappedRow) mapped.push(await hydrateMatterResultFromContext(mappedRow, "Matter number"));
    }

    const claimRows = await fetchFastRows(`/api/claim-index/by-claim?claimNumber=${encodeURIComponent(q)}`);
    for (const row of claimRows) {
      const mappedRow = toMatterResult(row, "Claim number", q);
      if (mappedRow) mapped.push(mappedRow);
    }

    return { checkedLabel: "Matter number / Claim number", results: dedupeMatterResults(mapped) };
  }

  if (kind === "master") {
    const rows = await fetchFastRows(`/api/claim-index/by-master?masterLawsuitId=${encodeURIComponent(q)}`);
    for (const row of rows) {
      const mappedRow = toMatterResult(row, "Master lawsuit number");
      if (mappedRow) mapped.push(mappedRow);
    }

    return { checkedLabel: "Master lawsuit number", results: dedupeMatterResults(mapped) };
  }

  const [patientRows, providerRows] = await Promise.all([
    fetchFastRows(`/api/claim-index/by-patient?name=${encodeURIComponent(q)}`),
    fetchFastRows(`/api/claim-index/by-provider?name=${encodeURIComponent(q)}`),
  ]);

  for (const row of patientRows) {
    if (!rowMatchesText(row, q, "Patient")) continue;
    const mappedRow = toMatterResult(row, "Patient");
    if (mappedRow) mapped.push(mappedRow);
  }

  for (const row of providerRows) {
    if (!rowMatchesText(row, q, "Provider")) continue;
    const mappedRow = toMatterResult(row, "Provider");
    if (mappedRow) mapped.push(mappedRow);
  }

  return { checkedLabel: "Patient / Provider", results: dedupeMatterResults(mapped) };
}


async function getEntryTypeaheadResults(qInput: string): Promise<{
  checkedLabel: string;
  results: MatterResult[];
}> {
  const q = clean(qInput);

  if (!q) {
    return { checkedLabel: "", results: [] };
  }

  const kind = classifySearch(q);

  if (kind === "brl_matter" || kind === "numeric_ambiguous") {
    const mapped: MatterResult[] = [];

    try {
      const prefixRows = await fetchFastRows(
        `/api/claim-index/by-display-prefix?prefix=${encodeURIComponent(q)}&limit=8`
      );

      for (const row of prefixRows) {
        const mappedRow = toMatterResult(row, "Matter number");
        if (mappedRow) mapped.push(mappedRow);
      }
    } catch {
      // Continue to claim lookup for numeric inputs.
    }

    if (kind === "numeric_ambiguous") {
      try {
        const claimRows = await fetchFastRows(`/api/claim-index/search?claim=${encodeURIComponent(q)}`);

        for (const row of claimRows) {
          const mappedRow = toMatterResult(row, "Claim number", q);
          if (mappedRow) mapped.push(mappedRow);
        }
      } catch {
        // Keep matter-number prefix suggestions even if claim lookup is unavailable.
      }
    }

    return {
      checkedLabel: kind === "brl_matter" ? "Matter number" : "Matter number / Claim number",
      results: dedupeMatterResults(mapped),
    };
  }

  return getEntrySearchResults(q);
}

type HomeSearchUrlState = {
  patient: string;
  claim: string;
  provider: string;
  insurer: string;
  lawsuitId: string;
  court: string;
  adversaryAttorney: string;
  denialReason: string;
};

function homeSearchStateFromUrl(): HomeSearchUrlState {
  if (typeof window === "undefined") {
    return {
      patient: "",
      claim: "",
      provider: "",
      insurer: "",
      lawsuitId: "",
      court: "",
      adversaryAttorney: "",
      denialReason: "",
    };
  }

  const params = new URLSearchParams(window.location.search);

  return {
    patient: params.get("patient") || "",
    claim: params.get("claim") || "",
    provider: params.get("provider") || "",
    insurer: params.get("insurer") || "",
    lawsuitId: params.get("lawsuitId") || "",
    court: params.get("court") || "",
    adversaryAttorney: params.get("adversaryAttorney") || "",
    denialReason: params.get("denialReason") || "",
  };
}

function homeSearchStateHasAnyValue(state: HomeSearchUrlState) {
  return Boolean(
    state.patient ||
      state.claim ||
      state.provider ||
      state.insurer ||
      state.lawsuitId ||
      state.court ||
      state.adversaryAttorney ||
      state.denialReason
  );
}

function homeSearchUrlForState(state: HomeSearchUrlState) {
  const params = new URLSearchParams();

  if (state.patient) params.set("patient", state.patient);
  if (state.claim) params.set("claim", state.claim);
  if (state.provider) params.set("provider", state.provider);
  if (state.insurer) params.set("insurer", state.insurer);
  if (state.lawsuitId) params.set("lawsuitId", state.lawsuitId);
  if (state.court) params.set("court", state.court);
  if (state.adversaryAttorney) params.set("adversaryAttorney", state.adversaryAttorney);
  if (state.denialReason) params.set("denialReason", state.denialReason);

  return params.toString() ? `/?${params.toString()}` : "/";
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [brlNumberInput, setBrlNumberInput] = useState("");
  const [lawsuitNumberInput, setLawsuitNumberInput] = useState("");
  const [directPatientInput, setDirectPatientInput] = useState("");
  const [directClaimInput, setDirectClaimInput] = useState("");
  const [patientSearchInput, setPatientSearchInput] = useState("");
  const [claimSearchInput, setClaimSearchInput] = useState("");
  const [providerSearchInput, setProviderSearchInput] = useState("");
  const [directPatientSuggestions, setDirectPatientSuggestions] = useState<string[]>([]);
  const [patientSearchSuggestions, setPatientSearchSuggestions] = useState<string[]>([]);
  const [claimSearchSuggestions, setClaimSearchSuggestions] = useState<string[]>([]);
  const [providerSearchSuggestions, setProviderSearchSuggestions] = useState<string[]>([]);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [denialReasonPicklistOptions, setDenialReasonPicklistOptions] =
    useState<AdvancedPicklistOption[]>(DENIAL_REASON_PICKLIST_OPTIONS);
  const [statusPicklistOptions, setStatusPicklistOptions] =
    useState<Array<{ value: string; label: string }>>([
      { value: "READY FOR ARBITRATION/LITIGATION", label: "READY FOR ARBITRATION/LITIGATION" },
      { value: "READY FOR ARBITRATION LITIGATION", label: "READY FOR ARBITRATION LITIGATION" },
    ]);
  const [closeReasonPicklistOptions, setCloseReasonPicklistOptions] =
    useState<Array<{ value: string; label: string }>>([]);
  const [finalStatusPicklistOptions, setFinalStatusPicklistOptions] =
    useState<AdvancedPicklistOption[]>(FINAL_STATUS_PICKLIST_OPTIONS);
  const [serviceTypePicklistOptions, setServiceTypePicklistOptions] =
    useState<AdvancedPicklistOption[]>(SERVICE_TYPE_PICKLIST_OPTIONS);
  const [providerReferenceOptions, setProviderReferenceOptions] = useState<any[]>([]);
  const [insurerReferenceOptions, setInsurerReferenceOptions] = useState<any[]>([]);
  const [courtReferenceOptions, setCourtReferenceOptions] = useState<any[]>([]);
  const [adversaryAttorneyReferenceOptions, setAdversaryAttorneyReferenceOptions] = useState<any[]>([]);
  const [advancedFields, setAdvancedFields] = useState<AdvancedSearchFields>(() =>
    emptyAdvancedSearchFields()
  );
  const advancedFieldsRef = useRef<AdvancedSearchFields>(advancedFields);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<MatterResult[]>([]);
  const [homeTableSort, setHomeTableSort] = useState<{ key: HomeResultsSortKey; direction: "asc" | "desc" }>({
    key: "matter",
    direction: "asc",
  });
  const [hideClosedHomeResults, setHideClosedHomeResults] = useState(false);
  const [checkedLabel, setCheckedLabel] = useState("");
  const [suggestions, setSuggestions] = useState<MatterResult[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionLabel, setSuggestionLabel] = useState("");

  type HomeResultsSortKey =
    | "matter"
    | "patient"
    | "provider"
    | "insurer"
    | "claimNumber"
    | "lawsuitId"
    | "court"
    | "adversaryAttorney"
    | "denialReason"
    | "status"
    | "finalStatus"
    | "matchedBy";

  function homeResultSortValue(row: MatterResult, key: HomeResultsSortKey) {
    if (key === "matter") return row.displayNumber || row.id;
    if (key === "patient") return row.patient;
    if (key === "provider") return row.provider;
    if (key === "insurer") return row.insurer;
    if (key === "claimNumber") return row.claimNumber;
    if (key === "lawsuitId") return row.masterLawsuitId;
    if (key === "court") return row.court;
    if (key === "adversaryAttorney") return row.adversaryAttorney;
    if (key === "denialReason") return row.denialReason;
    if (key === "status") return row.status;
    if (key === "finalStatus") return row.finalStatus;
    if (key === "matchedBy") return row.matchedBy;
    return "";
  }

  function sortHomeResults(rows: MatterResult[]) {
    const visibleRows = hideClosedHomeResults
      ? rows.filter((row) => row.finalStatus !== "Closed")
      : rows;
    const sorted = [...visibleRows];

    sorted.sort((a, b) => {
      const av = String(homeResultSortValue(a, homeTableSort.key) ?? "").toLowerCase();
      const bv = String(homeResultSortValue(b, homeTableSort.key) ?? "").toLowerCase();
      const cmp = av.localeCompare(bv, undefined, { numeric: true, sensitivity: "base" });
      return homeTableSort.direction === "asc" ? cmp : -cmp;
    });

    return sorted;
  }

  function homeSortableHeader(label: string, key: HomeResultsSortKey) {
    const active = homeTableSort.key === key;
    const direction = active ? homeTableSort.direction : "asc";

    return (
      <button
        type="button"
        onClick={() =>
          setHomeTableSort((current) =>
            current.key === key
              ? { key, direction: current.direction === "asc" ? "desc" : "asc" }
              : { key, direction: "asc" }
          )
        }
        style={homeResultsHeaderButtonStyle}
        title={`Sort by ${label}`}
      >
        {label} {active ? (direction === "asc" ? "▲" : "▼") : ""}
      </button>
    );
  }

  const sortedHomeResults = useMemo(
    () => sortHomeResults(results),
    [results, homeTableSort, hideClosedHomeResults]
  );

  const resultLabel = useMemo(() => {
    if (!searched || loading || error) return "";
    if (results.length === 1) return "1 matching matter found.";
    return `${results.length} matching matters found.`;
  }, [searched, loading, error, results.length]);

  useEffect(() => {
    const q = clean(query);

    if (q.length < 2) {
      setSuggestions([]);
      setSuggestionLabel("");
      setSuggestionsLoading(false);
      return;
    }

    let cancelled = false;

    const timer = window.setTimeout(async () => {
      setSuggestionsLoading(true);

      try {
        const quick = await getEntryTypeaheadResults(q);

        if (cancelled) return;

        setSuggestions(quick.results.slice(0, 6));
        setSuggestionLabel(quick.checkedLabel);
      } catch {
        if (cancelled) return;

        setSuggestions([]);
        setSuggestionLabel("");
      } finally {
        if (!cancelled) setSuggestionsLoading(false);
      }
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    function applyHomeSearchStateFromUrl() {
      const urlState = homeSearchStateFromUrl();

      if (homeSearchStateHasAnyValue(urlState)) {
        setPatientSearchInput(urlState.patient);
        setClaimSearchInput(urlState.claim);
        setProviderSearchInput(urlState.provider);

        if (urlState.insurer) {
          void runFilteredSearchPage(urlState.insurer, "Insurer", { updateUrl: false });
        } else if (urlState.lawsuitId) {
          void runFilteredSearchPage(urlState.lawsuitId, "Lawsuit ID", { updateUrl: false });
        } else if (urlState.court) {
          void runFilteredSearchPage(urlState.court, "Court", { updateUrl: false });
        } else if (urlState.adversaryAttorney) {
          void runFilteredSearchPage(urlState.adversaryAttorney, "Adversary Attorney", { updateUrl: false });
        } else if (urlState.denialReason) {
          void runFilteredSearchPage(urlState.denialReason, "Denial Reason", { updateUrl: false });
        } else {
          void runMainCombinedSearch(urlState, { updateUrl: false });
        }
      } else {
        resetSearch({ updateUrl: false });
      }
    }

    applyHomeSearchStateFromUrl();
    window.addEventListener("popstate", applyHomeSearchStateFromUrl);

    return () => {
      window.removeEventListener("popstate", applyHomeSearchStateFromUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  function openAdministratorMenu() {
    window.location.href = "/admin";
  }




  async function loadPatientSuggestions(value: string, setter: React.Dispatch<React.SetStateAction<string[]>>) {
    const q = clean(value);

    if (q.length < 2) {
      setter([]);
      return;
    }

    try {
      const rows = await fetchFastRows(`/api/claim-index/by-patient?name=${encodeURIComponent(q)}`);
      setter(uniqueSuggestionValues(rows.map((row: any) => patientName(row))));
    } catch {
      setter([]);
    }
  }

  async function loadClaimSuggestions(value: string) {
    const q = clean(value);

    if (q.length < 2) {
      setClaimSearchSuggestions([]);
      return;
    }

    try {
      const rows = await fetchFastRows(`/api/claim-index/search?claim=${encodeURIComponent(q)}`);
      setterClaimSuggestionsFromRows(rows);
    } catch {
      setClaimSearchSuggestions([]);
    }
  }

  function setterClaimSuggestionsFromRows(rows: any[]) {
    setClaimSearchSuggestions(uniqueSuggestionValues(rows.map((row: any) => claimNumberFromMatter(row))));
  }

  async function loadProviderSuggestions(value: string) {
    const q = clean(value);

    if (q.length < 2) {
      setProviderSearchSuggestions([]);
      return;
    }

    try {
      const rows = await fetchFastRows(`/api/claim-index/by-provider?name=${encodeURIComponent(q)}`);
      setProviderSearchSuggestions(uniqueSuggestionValues(rows.map((row: any) => providerName(row))));
    } catch {
      setProviderSearchSuggestions([]);
    }
  }

  useEffect(() => {
    let cancelled = false;
    const value = directPatientInput;

    const timer = window.setTimeout(() => {
      if (!cancelled) void loadPatientSuggestions(value, setDirectPatientSuggestions);
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [directPatientInput]);

  useEffect(() => {
    let cancelled = false;
    const value = patientSearchInput;

    const timer = window.setTimeout(() => {
      if (!cancelled) void loadPatientSuggestions(value, setPatientSearchSuggestions);
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [patientSearchInput]);

  useEffect(() => {
    let cancelled = false;
    const value = claimSearchInput;

    const timer = window.setTimeout(() => {
      if (!cancelled) void loadClaimSuggestions(value);
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [claimSearchInput]);

  useEffect(() => {
    let cancelled = false;
    const value = providerSearchInput;

    const timer = window.setTimeout(() => {
      if (!cancelled) void loadProviderSuggestions(value);
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [providerSearchInput]);

  useEffect(() => {
    advancedFieldsRef.current = advancedFields;
  }, [advancedFields]);

  function referenceOptionLabel(option: any): string {
    return clean(option?.displayName || option?.label || option?.value || option?.name || "");
  }

  async function loadSearchReferenceOptions() {
    try {
      const [providerResponse, insurerResponse, courtResponse, adversaryAttorneyResponse] = await Promise.all([
        fetch("/api/reference-data/options?type=provider_client", { cache: "no-store" }),
        fetch("/api/reference-data/options?type=insurer_company", { cache: "no-store" }),
        fetch("/api/reference-data/options?type=court_venue", { cache: "no-store" }),
        fetch("/api/reference-data/options?type=adversary_attorney", { cache: "no-store" }),
      ]);

      const [providerJson, insurerJson, courtJson, adversaryAttorneyJson] = await Promise.all([
        providerResponse.json().catch(() => ({})),
        insurerResponse.json().catch(() => ({})),
        courtResponse.json().catch(() => ({})),
        adversaryAttorneyResponse.json().catch(() => ({})),
      ]);

      setProviderReferenceOptions(Array.isArray(providerJson?.options) ? providerJson.options : []);
      setInsurerReferenceOptions(Array.isArray(insurerJson?.options) ? insurerJson.options : []);
      setCourtReferenceOptions(Array.isArray(courtJson?.options) ? courtJson.options : []);
      setAdversaryAttorneyReferenceOptions(Array.isArray(adversaryAttorneyJson?.options) ? adversaryAttorneyJson.options : []);
    } catch {
      setProviderReferenceOptions([]);
      setInsurerReferenceOptions([]);
      setCourtReferenceOptions([]);
      setAdversaryAttorneyReferenceOptions([]);
    }
  }

  useEffect(() => {
    void loadSearchReferenceOptions();
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadAdvancedPicklists() {
      try {
        const json = await fetch("/api/advanced-search/picklists", {
          cache: "no-store",
        }).then((r) => r.json());

        if (cancelled || !json?.ok) return;

        if (Array.isArray(json?.denialReason?.options) && json.denialReason.options.length > 0) {
          setDenialReasonPicklistOptions(json.denialReason.options);
        }

        if (Array.isArray(json?.status?.options) && json.status.options.length > 0) {
          setStatusPicklistOptions(json.status.options);
        }

        if (Array.isArray(json?.closeReason?.options) && json.closeReason.options.length > 0) {
          setCloseReasonPicklistOptions(json.closeReason.options);
        }

        if (Array.isArray(json?.finalStatus?.options) && json.finalStatus.options.length > 0) {
          setFinalStatusPicklistOptions(json.finalStatus.options);
        }

        if (Array.isArray(json?.serviceType?.options) && json.serviceType.options.length > 0) {
          setServiceTypePicklistOptions(json.serviceType.options);
        }
      } catch {
        // Keep safe local fallback options.
      }
    }

    void loadAdvancedPicklists();

    return () => {
      cancelled = true;
    };
  }, []);

  async function runSearch() {
    const q = clean(query);

    setLoading(true);
    setSearched(true);
    setError("");
    setResults([]);
    setCheckedLabel("");
    setSuggestions([]);
    setSuggestionLabel("");
    setSuggestionsLoading(false);

    try {
      if (!q) {
        throw new Error("Enter a matter number, master lawsuit number, claim number, patient, or provider.");
      }

      const search = await getEntrySearchResults(q);
      setCheckedLabel(search.checkedLabel);
      setResults(search.results);
    } catch (e: any) {
      setError(e?.message || "Search failed.");
    } finally {
      setLoading(false);
    }
  }

  function resetSearch(options: { updateUrl?: boolean } = {}) {
    setQuery("");
    setBrlNumberInput("");
    setLawsuitNumberInput("");
    setDirectPatientInput("");
    setDirectClaimInput("");
    setPatientSearchInput("");
    setClaimSearchInput("");
    setProviderSearchInput("");
    const clearedAdvancedFields = emptyAdvancedSearchFields();
    advancedFieldsRef.current = clearedAdvancedFields;
    setAdvancedFields(clearedAdvancedFields);
    setLoading(false);
    setSearched(false);
    setError("");
    setResults([]);
    setCheckedLabel("");
    setSuggestions([]);
    setDirectPatientSuggestions([]);
    setPatientSearchSuggestions([]);
    setClaimSearchSuggestions([]);
    setProviderSearchSuggestions([]);
    setSuggestionLabel("");
    setSuggestionsLoading(false);

    if (typeof window !== "undefined" && options.updateUrl !== false) {
      window.history.pushState({ barshMattersHomeSearch: true }, "", "/");
    }
  }

  type HomeLinkedFilterTarget =
    | "Patient"
    | "Provider"
    | "Insurer"
    | "Claim number"
    | "Lawsuit ID"
    | "Court"
    | "Adversary Attorney"
    | "Denial Reason";

  function homeLinkedFilterState(nextQuery: string, target: HomeLinkedFilterTarget): HomeSearchUrlState {
    const q = clean(nextQuery);

    return {
      patient: target === "Patient" ? q : "",
      claim: target === "Claim number" ? q : "",
      provider: target === "Provider" ? q : "",
      insurer: target === "Insurer" ? q : "",
      lawsuitId: target === "Lawsuit ID" ? q : "",
      court: target === "Court" ? q : "",
      adversaryAttorney: target === "Adversary Attorney" ? q : "",
      denialReason: target === "Denial Reason" ? q : "",
    };
  }

  function linkedSearchButtonTitle(target: HomeLinkedFilterTarget) {
    if (target === "Claim number") return "Show all matters for this claim number";
    if (target === "Lawsuit ID") return "Show all matters for this lawsuit ID";
    if (target === "Adversary Attorney") return "Show all matters for this adversary attorney";
    if (target === "Denial Reason") return "Show all matters for this denial reason";
    return `Show all matters for this ${target.toLowerCase()}`;
  }

  function runHomeLinkedFilter(nextQuery: string, target: HomeLinkedFilterTarget) {
    const q = clean(nextQuery);
    if (!q) return;
    void runFilteredSearchPage(q, target);
  }

  async function runFilteredSearchPage(
    nextQuery: string,
    target: HomeLinkedFilterTarget,
    options: { updateUrl?: boolean; replaceUrl?: boolean } = {}
  ) {
    const q = clean(nextQuery);

    if (!q) return;

    if (typeof window !== "undefined" && options.updateUrl !== false) {
      const nextUrl = homeSearchUrlForState(homeLinkedFilterState(q, target));
      const currentUrl = `${window.location.pathname}${window.location.search}`;

      if (nextUrl !== currentUrl) {
        if (options.replaceUrl) {
          window.history.replaceState({ barshMattersHomeSearch: true }, "", nextUrl);
        } else {
          window.history.pushState({ barshMattersHomeSearch: true }, "", nextUrl);
        }
      }
    }

    setQuery(q);
    setLoading(true);
    setSearched(true);
    setError("");
    setResults([]);
    setCheckedLabel(target);
    setSuggestions([]);
    setSuggestionLabel("");
    setSuggestionsLoading(false);

    try {
      const mapped: MatterResult[] = [];

      if (target === "Patient") {
        const rows = await fetchFastRows(`/api/claim-index/search?patient=${encodeURIComponent(q)}`);

        for (const row of rows) {
          if (!exactOrContains(patientName(row), q)) continue;
          const mappedRow = toMatterResult(row, "Patient");
          if (mappedRow) mapped.push(mappedRow);
        }
      } else if (target === "Provider") {
        const rows = await fetchFastRows(`/api/claim-index/search?provider=${encodeURIComponent(q)}`);

        for (const row of rows) {
          if (!exactOrContains(providerName(row), q)) continue;
          const mappedRow = toMatterResult(row, "Provider");
          if (mappedRow) mapped.push(mappedRow);
        }
      } else if (target === "Insurer") {
        const rows = await fetchFastRows(`/api/claim-index/search?insurer=${encodeURIComponent(q)}`);

        for (const row of rows) {
          if (!exactOrContains(insurerName(row), q)) continue;
          const mappedRow = toMatterResult(row, "Insurer");
          if (mappedRow) mapped.push(mappedRow);
        }
      } else if (target === "Claim number") {
        const rows = await fetchFastRows(`/api/claim-index/search?claim=${encodeURIComponent(q)}`);

        for (const row of rows) {
          if (!exactOrContains(claimNumberFromMatter(row), q)) continue;
          const mappedRow = toMatterResult(row, "Claim number", q);
          if (mappedRow) mapped.push(mappedRow);
        }
      } else if (target === "Lawsuit ID") {
        const rows = await fetchFastRows(`/api/claim-index/by-master?masterLawsuitId=${encodeURIComponent(q)}`);

        for (const row of rows) {
          const mappedRow = toMatterResult(row, "Lawsuit ID");
          if (mappedRow) mapped.push(mappedRow);
        }
      } else {
        const params = new URLSearchParams();
        params.set("limit", "250");

        if (target === "Court") params.set("court", q);
        if (target === "Adversary Attorney") params.set("adversaryAttorney", q);
        if (target === "Denial Reason") params.set("denialReason", q);

        const rows = await fetchFastRows(`/api/advanced-search/candidates?${params.toString()}`);

        for (const row of rows) {
          const values = advancedActualValuesFromMatter(row);

          if (target === "Court" && !exactOrContains(values.court, q)) continue;
          if (target === "Adversary Attorney" && !exactOrContains(values.adversaryAttorney, q)) continue;
          if (target === "Denial Reason" && !exactOrContains(advancedDisplayValue("Denial Reason", values.denialReason), q)) continue;

          const mappedRow = toMatterResult(row, target);
          if (mappedRow) mapped.push(mappedRow);
        }
      }

      setResults(dedupeMatterResults(mapped));
    } catch (e: any) {
      setError(e?.message || "Search failed.");
    } finally {
      setLoading(false);
    }
  }

  async function runTargetedSuggestionSearch(
    nextQuery: string,
    target: "Patient" | "Provider" | "Insurer" | "Claim number"
  ) {
    const q = clean(nextQuery);

    if (!q) return;

    setQuery(q);
    setLoading(true);
    setSearched(true);
    setError("");
    setResults([]);
    setCheckedLabel(target);
    setSuggestions([]);
    setSuggestionLabel("");
    setSuggestionsLoading(false);

    try {
      const mapped: MatterResult[] = [];

      if (target === "Patient") {
        const rows = await fetchFastRows(`/api/claim-index/search?patient=${encodeURIComponent(q)}`);

        for (const row of rows) {
          if (!exactOrContains(patientName(row), q)) continue;
          const mappedRow = toMatterResult(row, "Patient");
          if (mappedRow) mapped.push(mappedRow);
        }
      } else if (target === "Provider") {
        const rows = await fetchFastRows(`/api/claim-index/search?provider=${encodeURIComponent(q)}`);

        for (const row of rows) {
          if (!exactOrContains(providerName(row), q)) continue;
          const mappedRow = toMatterResult(row, "Provider");
          if (mappedRow) mapped.push(mappedRow);
        }
      } else if (target === "Insurer") {
        const rows = await fetchFastRows(`/api/claim-index/search?insurer=${encodeURIComponent(q)}`);

        for (const row of rows) {
          if (!exactOrContains(insurerName(row), q)) continue;
          const mappedRow = toMatterResult(row, "Insurer");
          if (mappedRow) mapped.push(mappedRow);
        }
      } else {
        const rows = await fetchFastRows(`/api/claim-index/search?claim=${encodeURIComponent(q)}`);

        for (const row of rows) {
          if (!exactOrContains(claimNumberFromMatter(row), q)) continue;
          const mappedRow = toMatterResult(row, "Claim number", q);
          if (mappedRow) mapped.push(mappedRow);
        }
      }

      setResults(dedupeMatterResults(mapped));
    } catch (e: any) {
      setError(e?.message || "Search failed.");
    } finally {
      setLoading(false);
    }
  }

  function targetedSearchUrl(
    nextQuery: string,
    target: "Patient" | "Provider" | "Insurer" | "Claim number"
  ) {
    const q = clean(nextQuery);
    const params = new URLSearchParams();

    if (target === "Patient") {
      params.set("patient", q);
    } else if (target === "Provider") {
      params.set("provider", q);
    } else if (target === "Insurer") {
      params.set("insurer", q);
    } else {
      params.set("claim", q);
    }

    return `/matters?${params.toString()}`;
  }

  function launchTargetedSuggestionPage(
    nextQuery: string,
    target: "Patient" | "Provider" | "Insurer" | "Claim number"
  ) {
    const q = clean(nextQuery);
    if (!q) return;

    window.location.href = targetedSearchUrl(q, target);
  }

  function normalizeBrlEntryInput(v: string) {
    const raw = String(v || "").trim().toUpperCase();

    if (!raw) return "";

    const full = raw.match(/^BRL[_\\s-]?(\\d{4})(\\d{5})$/);
    if (full) return `BRL_${full[1]}${full[2]}`;

    const digits = raw.replace(/\\D+/g, "");
    if (digits.length === 9) return `BRL_${digits}`;

    return raw.replace(/[^A-Z0-9_]+/g, "");
  }

  function normalizeLawsuitNumberEntryInput(v: string) {
    const digits = clean(v).replace(/[^0-9]/g, "").slice(0, 11);

    if (digits.length <= 4) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 4)}.${digits.slice(4)}`;
    return `${digits.slice(0, 4)}.${digits.slice(4, 6)}.${digits.slice(6)}`;
  }

  function updateAdvancedField<K extends keyof AdvancedSearchFields>(
    key: K,
    value: AdvancedSearchFields[K]
  ) {
    setAdvancedFields((prev) => {
      const next = { ...prev, [key]: value };
      advancedFieldsRef.current = next;
      return next;
    });
  }

  function openAdvancedSearch() {
    const clearedAdvancedFields = emptyAdvancedSearchFields();
    advancedFieldsRef.current = clearedAdvancedFields;
    setAdvancedFields(clearedAdvancedFields);
    setAdvancedOpen(true);
  }

  function advancedFieldCount(fields: AdvancedSearchFields) {
    return Object.values(fields).filter((v) => clean(v)).length;
  }

  function matterStageSearchText(row: any) {
    const rawStage = row?.matter_stage ?? row?.matterStage ?? row?.stage;
    const parts = [
      rawStage?.id,
      rawStage?.name,
      rawStage,
      row?.matterStageName,
      row?.matter_stage_name,
      row?.stageName,
      row?.stage_name,
    ];

    return parts.map((part) => clean(part)).filter(Boolean).join(" | ");
  }

  function matterStageMatches(row: any, expected: string) {
    const q = clean(expected);
    if (!q) return true;

    const searchable = matterStageSearchText(row);
    if (!searchable) return false;

    return exactOrContains(searchable, q);
  }

  function rawMatterMatchesAdvanced(row: any, fields: AdvancedSearchFields) {
    if (!supportedFieldMatches(row, fields.patient, ["patientName", "patient_name", "patient"])) {
      if (!customFieldIdMatches(row, ADVANCED_SEARCH_FIELD_IDS.patient, fields.patient)) return false;
    }

    if (!supportedFieldMatches(row, fields.provider, ["providerName", "provider_name", "provider", "clientName", "client_name", "client"])) return false;

    if (!supportedFieldMatches(row, fields.insuranceCompany, ["insuranceCompany", "insurance_company", "insurerName", "insurer_name", "insurer"])) {
      if (!customFieldIdMatches(row, ADVANCED_SEARCH_FIELD_IDS.insuranceCompany, fields.insuranceCompany)) return false;
    }

    if (!supportedFieldMatches(row, fields.claim, ["claimNumber", "claim_number", "claimNumberNormalized", "claim_number_normalized"])) {
      if (!customFieldIdMatches(row, ADVANCED_SEARCH_FIELD_IDS.claimNumber, fields.claim)) return false;
    }

    if (!supportedFieldMatches(row, fields.indexAaaNumber, ["indexAaaNumber", "index_aaa_number", "indexAAANumber", "indexNumber", "index_number"])) {
      if (!customFieldIdMatches(row, ADVANCED_SEARCH_FIELD_IDS.indexAaaNumber, fields.indexAaaNumber)) return false;
    }

    if (!supportedDateRangeMatches(row, fields.dateOpenedFrom, fields.dateOpenedTo, [
      "dateOpened",
      "date_opened",
      "openDate",
      "open_date",
      "createdAt",
      "created_at",
      "created_at",
    ])) return false;

    if (!customFieldIdMatches(row, ADVANCED_SEARCH_FIELD_IDS.policyNumber, fields.policyNumber)) return false;
    if (!customFieldDateIdMatches(row, ADVANCED_SEARCH_FIELD_IDS.dateOfLoss, fields.accidentDate)) return false;

    if (!customPicklistFieldIdMatches(row, ADVANCED_SEARCH_FIELD_IDS.serviceType, fields.serviceType)) {
      if (!picklistFieldMatchesAnySource(
        row,
        ADVANCED_SEARCH_FIELD_IDS.serviceType,
        fields.serviceType,
        ["serviceType", "service_type"]
      )) return false;
    }
    if (!supportedFieldMatches(row, fields.court, ["court", "courtName", "court_name", "venue", "venueSelection", "venue_selection"])) return false;
    if (!supportedFieldMatches(row, fields.adversaryAttorney, ["adversaryAttorney", "adversary_attorney", "adversaryAttorneyName", "adversary_attorney_name"])) return false;

    if (!customFieldDateIdMatches(row, ADVANCED_SEARCH_FIELD_IDS.dosStart, fields.dosStart)) return false;
    if (!customFieldDateIdMatches(row, ADVANCED_SEARCH_FIELD_IDS.dosEnd, fields.dosEnd)) return false;

    if (!picklistFieldMatchesAnySource(
      row,
      ADVANCED_SEARCH_FIELD_IDS.denialReason,
      fields.denialReason,
      ["denialReason", "denial_reason"]
    )) return false;

    if (!matterStageMatches(row, fields.status)) return false;

    if (!customPicklistFieldIdMatches(row, ADVANCED_SEARCH_FIELD_IDS.closeReason, fields.closeReason)) {
      if (!picklistFieldMatchesAnySource(
        row,
        ADVANCED_SEARCH_FIELD_IDS.closeReason,
        fields.closeReason,
        ["closeReason", "close_reason", "finalStatus", "final_status"]
      )) return false;
    }

    if (!supportedFieldMatches(row, fields.finalStatus, ["status", "finalStatus", "final_status"])) return false;

    return true;
  }

  async function runBrlNumberSearch() {
    const display = normalizeBrlEntryInput(brlNumberInput);

    setLoading(true);
    setSearched(false);
    setError("");
    setResults([]);
    setCheckedLabel("");
    setSuggestions([]);
    setSuggestionLabel("");
    setSuggestionsLoading(false);

    try {
      if (!display) {
        throw new Error("Enter the Barsh Matters file number, e.g., BRL_202600001 or 202600001.");
      }

      const rows = await fetchMatterByDisplayNumber(display);
      const exact = rows.find((row: any) => compact(displayNumber(row)) === compact(display));

      if (!exact) {
        throw new Error(`No exact matter found for ${display}.`);
      }

      const resolvedDisplay = displayNumber(exact) || display;
      const id = resolvedDisplay || matterId(exact);

      if (!id) {
        throw new Error(`Matter ${display} was found, but no matter number was returned.`);
      }

      window.location.href = `/matter/${encodeURIComponent(id)}`;
    } catch (e: any) {
      setSearched(true);
      setError(e?.message || "BRL lookup failed.");
      setLoading(false);
    }
  }

  async function runLawsuitNumberSearch() {
    const q = clean(lawsuitNumberInput);

    setLoading(true);
    setSearched(false);
    setError("");
    setResults([]);
    setCheckedLabel("");
    setSuggestions([]);
    setSuggestionLabel("");
    setSuggestionsLoading(false);

    try {
      if (!q) {
        throw new Error("Enter a lawsuit number.");
      }

      if (!isMasterLawsuitInput(q)) {
        throw new Error("Enter the lawsuit number in YYYY.MM.NNNNN format.");
      }

      window.location.href = `/matters?master=${encodeURIComponent(q)}`;
    } catch (e: any) {
      setSearched(true);
      setError(e?.message || "Lawsuit lookup failed.");
      setLoading(false);
    }
  }

  async function runPatientSearch() {
    const q = clean(patientSearchInput);

    setLoading(true);
    setSearched(true);
    setError("");
    setResults([]);
    setCheckedLabel("Patient");
    setSuggestions([]);
    setSuggestionLabel("");
    setSuggestionsLoading(false);

    try {
      if (!q) {
        throw new Error("Enter a patient name.");
      }

      let rows = await fetchFastRows(`/api/claim-index/by-patient?name=${encodeURIComponent(q)}`);
      rows = await hydrateAdvancedRows(rows);

      const mapped: MatterResult[] = [];

      for (const row of rows) {
        if (!exactOrContains(patientName(row), q)) continue;
        const mappedRow = toMatterResult(row, "Patient");
        if (mappedRow) mapped.push(mappedRow);
      }

      setResults(dedupeMatterResults(mapped));
    } catch (e: any) {
      setError(e?.message || "Patient search failed.");
    } finally {
      setLoading(false);
    }
  }

  async function runClaimNumberSearch() {
    const q = clean(claimSearchInput);

    setLoading(true);
    setSearched(true);
    setError("");
    setResults([]);
    setCheckedLabel("Claim number");
    setSuggestions([]);
    setSuggestionLabel("");
    setSuggestionsLoading(false);

    try {
      if (!q) {
        throw new Error("Enter a claim number.");
      }

      const rows = await fetchFastRows(`/api/claim-index/by-claim?claimNumber=${encodeURIComponent(q)}`);
      const mapped = rows
        .map((row: any) => toMatterResult(row, "Claim number", q))
        .filter(Boolean) as MatterResult[];

      setResults(dedupeMatterResults(mapped));
    } catch (e: any) {
      setError(e?.message || "Claim search failed.");
    } finally {
      setLoading(false);
    }
  }

  async function runProviderSearch() {
    const q = clean(providerSearchInput);

    setLoading(true);
    setSearched(true);
    setError("");
    setResults([]);
    setCheckedLabel("Provider");
    setSuggestions([]);
    setSuggestionLabel("");
    setSuggestionsLoading(false);

    try {
      if (!q) {
        throw new Error("Enter a provider name.");
      }

      const rows = await fetchFastRows(`/api/claim-index/by-provider?name=${encodeURIComponent(q)}`);
      const mapped: MatterResult[] = [];

      for (const row of rows) {
        if (!exactOrContains(providerName(row), q)) continue;
        const mappedRow = toMatterResult(row, "Provider");
        if (mappedRow) mapped.push(mappedRow);
      }

      setResults(dedupeMatterResults(mapped));
    } catch (e: any) {
      setError(e?.message || "Provider search failed.");
    } finally {
      setLoading(false);
    }
  }

  function launchDirectPatient() {
    const q = clean(directPatientInput);
    if (!q) return;
    window.location.href = `/matters?workflow=patient&patient=${encodeURIComponent(q)}`;
  }

  function launchDirectClaim() {
    const q = clean(directClaimInput);
    if (!q) return;
    window.location.href = `/matters?workflow=claim&claim=${encodeURIComponent(q)}`;
  }

  async function runMainCombinedSearch(
    overrides: Partial<HomeSearchUrlState> = {},
    options: { updateUrl?: boolean; replaceUrl?: boolean } = {}
  ) {
    const patient = Object.prototype.hasOwnProperty.call(overrides, "patient") ? clean(overrides.patient) : clean(patientSearchInput);
    const claim = Object.prototype.hasOwnProperty.call(overrides, "claim") ? clean(overrides.claim) : clean(claimSearchInput);
    const provider = Object.prototype.hasOwnProperty.call(overrides, "provider") ? clean(overrides.provider) : clean(providerSearchInput);

    setPatientSearchInput(patient);
    setClaimSearchInput(claim);
    setProviderSearchInput(provider);

    setLoading(true);
    setSearched(true);
    setError("");
    setResults([]);
    setCheckedLabel("Combined search");
    setSuggestions([]);
    setSuggestionLabel("");
    setSuggestionsLoading(false);

    try {
      if (!patient && !claim && !provider) {
        throw new Error("Enter a patient, claim number, provider, or a combination of those fields.");
      }

      if (typeof window !== "undefined" && options.updateUrl !== false) {
        const nextUrl = homeSearchUrlForState({
          patient,
          claim,
          provider,
          insurer: "",
          lawsuitId: "",
          court: "",
          adversaryAttorney: "",
          denialReason: "",
        });
        const currentUrl = `${window.location.pathname}${window.location.search}`;

        if (nextUrl !== currentUrl) {
          if (options.replaceUrl) {
            window.history.replaceState({ barshMattersHomeSearch: true }, "", nextUrl);
          } else {
            window.history.pushState({ barshMattersHomeSearch: true }, "", nextUrl);
          }
        }
      }

      let rows: any[] = [];

      if (claim) {
        rows = await fetchFastRows(`/api/claim-index/by-claim?claimNumber=${encodeURIComponent(claim)}`);
      } else if (patient) {
        rows = await fetchFastRows(`/api/claim-index/by-patient?name=${encodeURIComponent(patient)}`);
      } else {
        rows = await fetchFastRows(`/api/claim-index/by-provider?name=${encodeURIComponent(provider)}`);
      }

      const mapped: MatterResult[] = [];

      for (const row of rows) {
        if (patient && !exactOrContains(patientName(row), patient)) continue;
        if (claim && !exactOrContains(claimNumberFromMatter(row), claim)) continue;
        if (provider && !exactOrContains(providerName(row), provider)) continue;

        const mappedRow = toMatterResult(row, "Combined search", claim);
        if (mappedRow) mapped.push(mappedRow);
      }

      setResults(dedupeMatterResults(mapped));
    } catch (e: any) {
      setError(e?.message || "Combined search failed.");
    } finally {
      setLoading(false);
    }
  }

  async function runAdvancedSearch() {
    const fields = advancedFieldsRef.current;
    const count = advancedFieldCount(fields);

    setLoading(true);
    setSearched(true);
    setError("");
    setResults([]);
    setCheckedLabel("Advanced search");
    setSuggestions([]);
    setSuggestionLabel("");
    setSuggestionsLoading(false);

    try {
      if (count === 0) {
        throw new Error("Enter at least one advanced search field.");
      }

      let rows: any[] = await fetchAdvancedCandidateRows(fields);

      if (rows.length === 0) {
        rows = await fetchAdvancedFallbackCandidateRows();
      }

      rows = await hydrateAdvancedRows(rows);

      const mapped: MatterResult[] = [];

      for (const row of rows) {
        if (!rawMatterMatchesAdvanced(row, fields)) continue;
        const mappedRow = toMatterResult(row, "Advanced search", clean(fields.claim));
        if (mappedRow) mapped.push(mappedRow);
      }

      setResults(dedupeMatterResults(mapped));
      setAdvancedOpen(false);
    } catch (e: any) {
      setError(e?.message || "Advanced search failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={pageStyle}>
      <div style={shellStyle}>
        <BarshHeader onAdministratorClick={openAdministratorMenu} />

          <style jsx global>{`
            .barsh-suggestion-row:hover {
              background: #f8fbff !important;
              border-color: #c7d7ef !important;
              box-shadow: 0 8px 18px rgba(15, 23, 42, 0.06) !important;
              transform: translateY(-1px);
            }

            .barsh-field-link:hover {
              color: #00346e !important;
              text-decoration-thickness: 2px !important;
            }

            .barsh-open-link:hover {
              background: #eff6ff !important;
              border-color: #93b4e8 !important;
              transform: translateY(-1px);
            }

            .barsh-brl-direct-input::placeholder {
              color: #8b95a1 !important;
              font-weight: 500 !important;
              opacity: 1 !important;
            }
          

            .barsh-prominent-select {
              appearance: none !important;
              -webkit-appearance: none !important;
              -moz-appearance: none !important;
              background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='22' height='22' viewBox='0 0 24 24' fill='none' stroke='%231b2850' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E") !important;
              background-repeat: no-repeat !important;
              background-position: right 16px center !important;
              background-size: 18px 18px !important;
              padding-right: 52px !important;
              cursor: pointer !important;
            }

            .barsh-prominent-select:hover {
              border-color: #93b4e8 !important;
            }

            .barsh-prominent-select:focus {
              outline: none !important;
              border-color: #93b4e8 !important;
              box-shadow: 0 0 0 3px rgba(147, 180, 232, 0.18) !important;
            }
`}
</style>

        <section style={compactLandingLookupPanelStyle}>
          <div
            style={{
              padding: "16px 18px 18px",
              borderTop: "1px solid #cbd5e1",
              borderBottom: "1px solid #cbd5e1",
              borderLeft: "none",
              borderRight: "none",
              borderRadius: 0,
              background: "#f8fafc",
              boxShadow: "none",
            }}
          >
            <div
              style={{
                marginBottom: 14,
                color: "#385a83",
                fontSize: 18,
                fontWeight: 950,
                letterSpacing: "0.10em",
                textTransform: "uppercase",
              }}
            >
              Direct Entry
            </div>

            <div style={knownInformationGridStyle}>
              <label style={structuredFieldStyle}>
                <span style={labelStyle}>Barsh Matters File Number</span>
                <input
                  value={brlNumberInput}
                  onChange={(e) => setBrlNumberInput(normalizeBrlEntryInput(e.target.value))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void runBrlNumberSearch();
                  }}
                  placeholder="BRL_202600001 or 202600001"
                  className="barsh-brl-direct-input"
                  style={inputStyle}
                  inputMode="text"
                  autoFocus
                />
              </label>

              <label style={structuredFieldStyle}>
                <span style={labelStyle}>Lawsuit Number</span>
                <input
                  value={lawsuitNumberInput}
                  onChange={(e) => setLawsuitNumberInput(normalizeLawsuitNumberEntryInput(e.target.value))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void runLawsuitNumberSearch();
                  }}
                  placeholder="2026.05.00010"
                  style={inputStyle}
                  inputMode="numeric"
                  maxLength={13}
                />
              </label>
            </div>

            <div
              style={{
                height: 2,
                margin: "26px 0 24px",
                background: "#cbd5e1",
                borderRadius: 999,
              }}
            />

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16,
                marginBottom: 14,
              }}
            >
              <div
                style={{
                  color: "#385a83",
                  fontSize: 18,
                  fontWeight: 950,
                  letterSpacing: "0.10em",
                  textTransform: "uppercase",
                }}
              >
                Search
              </div>

              <button
                type="button"
                onClick={openAdvancedSearch}
                style={advancedSearchButtonStyle}
              >
                Advanced Search
              </button>
            </div>

            <div style={mainPageSearchGridStyle}>
              <label style={structuredFieldStyle}>
                <span style={labelStyle}>Patient</span>
                <input
                  value={patientSearchInput}
                  onChange={(e) => setPatientSearchInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void runMainCombinedSearch();
                  }}
                  placeholder="Search patient"
                  style={inputStyle}
                  list="barsh-search-patient-suggestions"
                />
              </label>

              <label style={structuredFieldStyle}>
                <span style={labelStyle}>Claim Number</span>
                <input
                  value={claimSearchInput}
                  onChange={(e) => setClaimSearchInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void runMainCombinedSearch();
                  }}
                  placeholder="Search claim number"
                  style={inputStyle}
                  list="barsh-search-claim-suggestions"
                />
              </label>

              <label style={structuredFieldStyle}>
                <span style={labelStyle}>Provider</span>
                <input
                  value={providerSearchInput}
                  onChange={(e) => setProviderSearchInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void runMainCombinedSearch();
                  }}
                  placeholder="Search provider"
                  style={inputStyle}
                  list="barsh-search-provider-suggestions"
                />
              </label>
            </div>

            <datalist id="barsh-search-patient-suggestions">
              {patientSearchSuggestions.map((value) => (
                <option key={`search-patient-${value}`} value={value} />
              ))}
            </datalist>

            <datalist id="barsh-search-claim-suggestions">
              {claimSearchSuggestions.map((value) => (
                <option key={`search-claim-${value}`} value={value} />
              ))}
            </datalist>

            <datalist id="barsh-search-provider-suggestions">
              {providerReferenceOptions.map((option, index) => {
                const value = referenceOptionLabel(option);
                if (!value) return null;
                return <option key={`search-provider-reference-${option.id || value}-${index}`} value={value} />;
              })}
              {providerSearchSuggestions.map((value) => (
                <option key={`search-provider-${value}`} value={value} />
              ))}
            </datalist>

            <div style={structuredButtonGridStyle}>
              <button type="button" onClick={() => void runMainCombinedSearch()} disabled={loading} style={primaryButtonStyle(loading)}>
                Search
              </button>

              <button type="button" onClick={() => resetSearch()} style={secondaryButtonStyle}>
                Clear Results
              </button>
            </div>
          </div>

          {(loading || error || searched) && (
            <section style={homeResultsTablePanelStyle} aria-label="Search results">
              <div style={homeResultsTableHeaderStyle}>
                <div>
                  <div style={searchResultsKickerStyle}>Search Results</div>
                  <h2 style={searchResultsTitleStyle}>
                    {loading ? "Searching..." : resultLabel || "Search Results"}
                  </h2>
                  {checkedLabel && !loading && !error && (
                    <div style={searchResultsSubTitleStyle}>Checked: {checkedLabel}</div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => resetSearch()}
                  style={secondaryButtonStyle}
                >
                  Clear Results
                </button>
              </div>

              {loading && <div style={searchMetaStyle}>Searching...</div>}

              {!loading && error && <div style={errorStyle}>{error}</div>}

              {!loading && !error && searched && results.length === 0 && (
                <div style={emptyStyle}>
                  No matching matter was returned.
                </div>
              )}

              {!loading && !error && results.length > 0 && (
                <>
                  <label
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      margin: "0 0 10px",
                      fontSize: 13,
                      fontWeight: 800,
                      color: "#385a83",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={hideClosedHomeResults}
                      onChange={(event) => setHideClosedHomeResults(event.target.checked)}
                    />
                    Hide Closed?
                  </label>
                  <div style={homeResultsTableScrollStyle}>
                    <table style={homeResultsTableStyle}>
                    <thead>
                      <tr>
                        <th style={homeResultsThStyle}>{homeSortableHeader("Matter", "matter")}</th>
                        <th style={homeResultsThStyle}>{homeSortableHeader("Patient", "patient")}</th>
                        <th style={homeResultsThStyle}>{homeSortableHeader("Provider", "provider")}</th>
                        <th style={homeResultsThStyle}>{homeSortableHeader("Insurer", "insurer")}</th>
                        <th style={homeResultsThStyle}>{homeSortableHeader("Claim Number", "claimNumber")}</th>
                        <th style={homeResultsThStyle}>{homeSortableHeader("Lawsuit ID", "lawsuitId")}</th>
                        <th style={homeResultsThStyle}>{homeSortableHeader("Court", "court")}</th>
                        <th style={homeResultsThStyle}>{homeSortableHeader("Adversary Attorney", "adversaryAttorney")}</th>
                        <th style={homeResultsThStyle}>{homeSortableHeader("Denial Reason", "denialReason")}</th>
                        <th style={homeResultsThStyle}>{homeSortableHeader("Status", "status")}</th>
                        <th style={homeResultsThStyle}>{homeSortableHeader("Final Status", "finalStatus")}</th>
                        <th style={homeResultsThStyle}>{homeSortableHeader("Matched By", "matchedBy")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedHomeResults.map((row) => {
                        const values = advancedActualValuesFromMatter(row);
                        const courtValue = row.court || advancedDisplayValue("Court", values.court);
                        const adversaryAttorneyValue =
                          row.adversaryAttorney || advancedDisplayValue("Adversary Attorney", values.adversaryAttorney);
                        const denialReasonValue =
                          row.denialReason || advancedDisplayValue("Denial Reason", values.denialReason);

                        return (
                          <tr key={row.id}>
                            <td style={homeResultsTdStyle}>
                              <a href={`/matter/${row.id}`} style={homeResultsMatterLinkStyle}>
                                {row.displayNumber || row.id}
                              </a>
                            </td>
                            <td style={homeResultsTdStyle}>
                              {row.patient ? (
                                <button
                                  type="button"
                                  onClick={() => runHomeLinkedFilter(row.patient, "Patient")}
                                  className="barsh-field-link"
                                  style={homeResultsFieldButtonStyle}
                                  title={linkedSearchButtonTitle("Patient")}
                                >
                                  {row.patient}
                                </button>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td style={homeResultsTdStyle}>
                              {row.provider ? (
                                <button
                                  type="button"
                                  onClick={() => runHomeLinkedFilter(row.provider, "Provider")}
                                  className="barsh-field-link"
                                  style={homeResultsFieldButtonStyle}
                                  title={linkedSearchButtonTitle("Provider")}
                                >
                                  {row.provider}
                                </button>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td style={homeResultsTdStyle}>
                              {row.insurer ? (
                                <button
                                  type="button"
                                  onClick={() => runHomeLinkedFilter(row.insurer, "Insurer")}
                                  className="barsh-field-link"
                                  style={homeResultsFieldButtonStyle}
                                  title={linkedSearchButtonTitle("Insurer")}
                                >
                                  {row.insurer}
                                </button>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td style={homeResultsTdStyle}>
                              {row.claimNumber || values.claim ? (
                                <button
                                  type="button"
                                  onClick={() => runHomeLinkedFilter(row.claimNumber || values.claim, "Claim number")}
                                  className="barsh-field-link"
                                  style={homeResultsFieldButtonStyle}
                                  title={linkedSearchButtonTitle("Claim number")}
                                >
                                  {row.claimNumber || values.claim}
                                </button>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td style={homeResultsTdStyle}>
                              {row.masterLawsuitId ? (
                                <a
                                  href={`/matters?master=${encodeURIComponent(row.masterLawsuitId)}`}
                                  className="barsh-field-link"
                                  style={homeResultsFieldButtonStyle}
                                  title="Open master lawsuit page"
                                >
                                  {row.masterLawsuitId}
                                </a>
                              ) : (
                                "Not Filed"
                              )}
                            </td>
                            <td style={homeResultsTdStyle}>
                              {courtValue ? (
                                <button
                                  type="button"
                                  onClick={() => runHomeLinkedFilter(courtValue, "Court")}
                                  className="barsh-field-link"
                                  style={homeResultsFieldButtonStyle}
                                  title={linkedSearchButtonTitle("Court")}
                                >
                                  {courtValue}
                                </button>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td style={homeResultsTdStyle}>
                              {adversaryAttorneyValue ? (
                                <button
                                  type="button"
                                  onClick={() => runHomeLinkedFilter(adversaryAttorneyValue, "Adversary Attorney")}
                                  className="barsh-field-link"
                                  style={homeResultsFieldButtonStyle}
                                  title={linkedSearchButtonTitle("Adversary Attorney")}
                                >
                                  {adversaryAttorneyValue}
                                </button>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td style={homeResultsTdStyle}>
                              {denialReasonValue ? (
                                <button
                                  type="button"
                                  onClick={() => runHomeLinkedFilter(denialReasonValue, "Denial Reason")}
                                  className="barsh-field-link"
                                  style={homeResultsFieldButtonStyle}
                                  title={linkedSearchButtonTitle("Denial Reason")}
                                >
                                  {denialReasonValue}
                                </button>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td style={homeResultsTdStyle}>{row.status || "—"}</td>
                            <td style={homeResultsTdStyle}>
                              <span style={homeStatusBadgeStyle(row.finalStatus)}>{row.finalStatus}</span>
                            </td>
                            <td style={homeResultsTdStyle}>{row.matchedBy || checkedLabel || "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    </table>
                  </div>
                </>
              )}
            </section>
          )}

          {advancedOpen && (
            <div style={advancedOverlayStyle} role="dialog" aria-modal="true">
              <div
                style={advancedModalStyle}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void runAdvancedSearch();
                  }
                }}
              >
                <div style={advancedModalHeaderStyle}>
                  <div>
                    <div style={structuredSearchKickerStyle}>Advanced Search</div>
                    <h2 style={advancedModalTitleStyle}>Combine Search Fields</h2>
                    <div style={advancedModalHelpStyle}>
                      Enter one or more fields.  Search results are read-only and are filtered against returned matter values.
                    </div>
                  </div>

                  <button type="button" onClick={() => setAdvancedOpen(false)} style={advancedCloseButtonStyle}>
                    ×
                  </button>
                </div>

                <div style={advancedGridStyle}>

                  <label style={structuredFieldStyle}>
                    <span style={labelStyle}>Patient</span>
                    <input
                      value={advancedFields.patient}
                      onChange={(e) => updateAdvancedField("patient", e.target.value)}
                      placeholder="Patient name"
                      style={inputStyle}
                    />
                  </label>

                  <label style={structuredFieldStyle}>
                    <span style={labelStyle}>Provider</span>
                    <input
                      value={advancedFields.provider}
                      onChange={(e) => updateAdvancedField("provider", e.target.value)}
                      placeholder="Provider"
                      style={inputStyle}
                      list="barsh-advanced-provider-reference-options"
                    />
                  </label>

                  <label style={structuredFieldStyle}>
                    <span style={labelStyle}>Insurance Company</span>
                    <input
                      value={advancedFields.insuranceCompany}
                      onChange={(e) => updateAdvancedField("insuranceCompany", e.target.value)}
                      placeholder="Insurance company"
                      style={inputStyle}
                      list="barsh-advanced-insurer-reference-options"
                    />
                  </label>

                  <label style={structuredFieldStyle}>
                    <span style={labelStyle}>Claim Number</span>
                    <input
                      value={advancedFields.claim}
                      onChange={(e) => updateAdvancedField("claim", e.target.value)}
                      placeholder="Claim number"
                      style={inputStyle}
                    />
                  </label>

                  <label style={structuredFieldStyle}>
                    <span style={labelStyle}>Index / AAA Number</span>
                    <input
                      value={advancedFields.indexAaaNumber}
                      onChange={(e) => updateAdvancedField("indexAaaNumber", e.target.value)}
                      placeholder="Index or AAA number"
                      style={inputStyle}
                    />
                  </label>

                  <label style={structuredFieldStyle}>
                    <span style={labelStyle}>Date Opened From</span>
                    <input
                      type="date"
                      value={advancedFields.dateOpenedFrom}
                      onChange={(e) => updateAdvancedField("dateOpenedFrom", e.target.value)}
                      style={inputStyle}
                    />
                  </label>

                  <label style={structuredFieldStyle}>
                    <span style={labelStyle}>Date Opened To</span>
                    <input
                      type="date"
                      value={advancedFields.dateOpenedTo}
                      onChange={(e) => updateAdvancedField("dateOpenedTo", e.target.value)}
                      style={inputStyle}
                    />
                  </label>

                  <label style={structuredFieldStyle}>
                    <span style={labelStyle}>Policy Number</span>
                    <input
                      value={advancedFields.policyNumber}
                      onChange={(e) => updateAdvancedField("policyNumber", e.target.value)}
                      placeholder="Policy number"
                      style={inputStyle}
                    />
                  </label>

                  <label style={structuredFieldStyle}>
                    <span style={labelStyle}>Accident Date / Date of Loss</span>
                    <input
                      type="date"
                      value={advancedFields.accidentDate}
                      onChange={(e) => updateAdvancedField("accidentDate", e.target.value)}
                      style={inputStyle}
                    />
                  </label>

                  <label style={structuredFieldStyle}>
                    <span style={labelStyle}>Service Type</span>
                    <select className="barsh-prominent-select"
                      value={advancedFields.serviceType}
                      onChange={(e) => updateAdvancedField("serviceType", e.target.value)}
                      style={inputStyle}
                    >
                      <option value="">Any Service Type</option>
                      {serviceTypePicklistOptions.map((option) => (
                        <option key={`service-type-${option.value}`} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label style={structuredFieldStyle}>
                    <span style={labelStyle}>Court</span>
                    <input
                      value={advancedFields.court}
                      onChange={(e) => updateAdvancedField("court", e.target.value)}
                      placeholder="Court"
                      style={inputStyle}
                      list="barsh-advanced-court-reference-options"
                    />
                  </label>

                    <label style={structuredFieldStyle}>
                      <span style={labelStyle}>Adversary Attorney</span>
                      <input
                        value={advancedFields.adversaryAttorney}
                        onChange={(e) => updateAdvancedField("adversaryAttorney", e.target.value)}
                        placeholder="Adversary Attorney"
                        style={inputStyle}
                        list="barsh-advanced-adversary-attorney-reference-options"
                      />
                    </label>

                  <label style={structuredFieldStyle}>
                    <span style={labelStyle}>DOS Start</span>
                    <input
                      type="date"
                      value={advancedFields.dosStart}
                      onChange={(e) => updateAdvancedField("dosStart", e.target.value)}
                      style={inputStyle}
                    />
                  </label>

                  <label style={structuredFieldStyle}>
                    <span style={labelStyle}>DOS End</span>
                    <input
                      type="date"
                      value={advancedFields.dosEnd}
                      onChange={(e) => updateAdvancedField("dosEnd", e.target.value)}
                      style={inputStyle}
                    />
                  </label>

                  <label style={structuredFieldStyle}>
                    <span style={labelStyle}>Denial Reason</span>
                    <select className="barsh-prominent-select"
                      value={advancedFields.denialReason}
                      onChange={(e) => updateAdvancedField("denialReason", e.target.value)}
                      style={inputStyle}
                    >
                      <option value="">Any Denial Reason</option>
                      {denialReasonPicklistOptions.map((option) => (
                        <option key={`denial-${option.value}`} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label style={structuredFieldStyle}>
                    <span style={labelStyle}>Status</span>
                    <select className="barsh-prominent-select"
                      value={advancedFields.status}
                      onChange={(e) => updateAdvancedField("status", e.target.value)}
                      style={inputStyle}
                    >
                      <option value="">Any Status</option>
                      {statusPicklistOptions.map((option) => (
                        <option key={`status-${option.value}`} value={option.label}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label style={structuredFieldStyle}>
                    <span style={labelStyle}>Close Reason</span>
                    <select className="barsh-prominent-select"
                      value={advancedFields.closeReason}
                      onChange={(e) => updateAdvancedField("closeReason", e.target.value)}
                      style={inputStyle}
                    >
                      <option value="">Any Close Reason</option>
                      {closeReasonPicklistOptions.map((option) => (
                        <option key={`close-reason-${option.value}`} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label style={structuredFieldStyle}>
                    <span style={labelStyle}>Final Status</span>
                    <select className="barsh-prominent-select"
                      value={advancedFields.finalStatus}
                      onChange={(e) => updateAdvancedField("finalStatus", e.target.value)}
                      style={inputStyle}
                    >
                      <option value="">Any Final Status</option>
                      {FINAL_STATUS_THREE_OPTIONS.map((option) => (
                        <option key={`final-status-${option.value}`} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                </div>

                <datalist id="barsh-advanced-provider-reference-options">
                  {providerReferenceOptions.map((option, index) => {
                    const value = referenceOptionLabel(option);
                    if (!value) return null;
                    return <option key={`advanced-provider-reference-${option.id || value}-${index}`} value={value} />;
                  })}
                </datalist>

                <datalist id="barsh-advanced-insurer-reference-options">
                  {insurerReferenceOptions.map((option, index) => {
                    const value = referenceOptionLabel(option);
                    if (!value) return null;
                    return <option key={`advanced-insurer-reference-${option.id || value}-${index}`} value={value} />;
                  })}
                </datalist>

                <datalist id="barsh-advanced-court-reference-options">
                  {courtReferenceOptions.map((option, index) => {
                    const value = referenceOptionLabel(option);
                    if (!value) return null;
                    return <option key={`advanced-court-reference-${option.id || value}-${index}`} value={value} />;
                  })}
                </datalist>
                <datalist id="barsh-advanced-adversary-attorney-reference-options">
                  {adversaryAttorneyReferenceOptions.map((option, index) => {
                    const value = String(option?.displayName || option?.name || option?.value || "").trim();
                    if (!value) return null;
                    return <option key={`advanced-adversary-attorney-reference-${option.id || value}-${index}`} value={value} />;
                  })}
                </datalist>

                <div style={advancedModalActionsStyle}>
                  <button type="button" onClick={runAdvancedSearch} disabled={loading} style={primaryButtonStyle(loading)}>
                    Run Advanced Search
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const clearedAdvancedFields = emptyAdvancedSearchFields();
                      advancedFieldsRef.current = clearedAdvancedFields;
                      setAdvancedFields(clearedAdvancedFields);
                    }}
                    style={secondaryButtonStyle}
                  >
                    Clear Fields
                  </button>

                  <button type="button" onClick={() => setAdvancedOpen(false)} style={secondaryButtonStyle}>
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  padding: "12px 20px 32px",
  background: "#f8fafc",
  color: colors.ink,
  fontFamily:
    'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
};

const shellStyle: React.CSSProperties = {
  maxWidth: "none",
  margin: "0 auto",
};

const topBarStyle: React.CSSProperties = {
  position: "sticky",
  top: 0,
  zIndex: 10000,
  isolation: "isolate",
  display: "grid",
  gridTemplateColumns: "500px minmax(0, 1fr) 330px",
  alignItems: "start",
  gap: 16,
  marginBottom: 14,
  padding: "8px 0 10px",
  background: "#f8fafc",
  boxShadow: "0 8px 24px rgba(15, 23, 42, 0.10)",
  borderBottom: "1px solid rgba(203, 213, 225, 0.9)",
};

const leftLogoWrapStyle: React.CSSProperties = {
  gridColumn: "1",
  display: "flex",
  justifyContent: "flex-start",
  alignItems: "flex-start",
};

const centerCaricatureWrapStyle: React.CSSProperties = {
  gridColumn: "2",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  alignSelf: "center",
  minHeight: 218,
  padding: "0 8px",
};

const headerCaricatureStyle: React.CSSProperties = {
  width: 326,
  height: 218,
  objectFit: "contain",
  objectPosition: "center center",
  borderRadius: 18,
};

const rightTopWrapStyle: React.CSSProperties = {
  gridColumn: "3",
  justifySelf: "end",
  position: "relative",
  width: 520,
  height: 132,
  display: "block",
};

const printButtonRowStyle: React.CSSProperties = {
  position: "absolute",
  top: 0,
  right: 304,
  display: "flex",
  justifyContent: "flex-end",
  alignItems: "center",
  gap: 8,
  flexWrap: "nowrap",
  zIndex: 2,
};

const bmLogoLinkStyle: React.CSSProperties = {
  position: "absolute",
  top: 0,
  right: 0,
  display: "inline-flex",
  alignItems: "flex-start",
  justifyContent: "flex-end",
  textDecoration: "none",
  width: 292,
  height: 132,
  flexShrink: 0,
  zIndex: 1,
};

const brlLogoStyle: React.CSSProperties = {
  width: 190,
  height: 126,
  objectFit: "contain",
  display: "block",
};

const bmLogoStyle: React.CSSProperties = {
  width: 292,
  height: 132,
  minWidth: 292,
  objectFit: "contain",
  objectPosition: "right top",
  display: "block",
  flexShrink: 0,
};

const printQueueButtonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  padding: "7px 11px",
  border: "1px solid #cbd5e1",
  borderRadius: 999,
  background: "#ffffff",
  color: colors.muted,
  fontSize: 12,
  fontWeight: 800,
  whiteSpace: "nowrap",
  cursor: "not-allowed",
  opacity: 0.9,
  marginTop: 0,
};

const lookupPanelStyle: React.CSSProperties = {
  marginTop: 18,
  padding: 0,
  border: "none",
  borderRadius: 0,
  background: "transparent",
  boxShadow: "none",
};

const fieldStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
};

const labelStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 900,
  color: colors.subtle,
  letterSpacing: "0.08em",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "17px 18px",
  border: "1px solid #c7d2e4",
  borderRadius: 18,
  fontSize: 18,
  color: colors.ink,
  background: "#ffffff",
  outline: "none",
};

const inlineResultAreaStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
  marginTop: 14,
};

const actionRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 12,
  alignItems: "center",
  marginTop: 18,
};

function primaryButtonStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: "15px 34px",
    border: "1px solid " + (disabled ? "#cbd5e1" : colors.blue),
    borderRadius: 16,
    background: disabled ? "#dbe4f6" : colors.blue,
    color: "#ffffff",
    cursor: disabled ? "not-allowed" : "pointer",
    fontWeight: 900,
    fontSize: 18,
    minWidth: 160,
    boxShadow: disabled ? "none" : "0 10px 18px rgba(0, 52, 110, 0.18)",
  };
}

const secondaryButtonStyle: React.CSSProperties = {
  padding: "15px 26px",
  border: "1px solid #cbd5e1",
  borderRadius: 16,
  background: "#ffffff",
  color: colors.ink,
  cursor: "pointer",
  fontWeight: 850,
  fontSize: 18,
};

const errorStyle: React.CSSProperties = {
  padding: 12,
  border: "1px solid " + colors.errorBorder,
  borderRadius: 14,
  background: colors.errorBg,
  color: "#991b1b",
  fontSize: 13,
  fontWeight: 750,
};

const searchMetaStyle: React.CSSProperties = {
  padding: 11,
  border: "1px solid " + colors.line,
  borderRadius: 14,
  background: "#f8fafc",
  color: colors.muted,
  fontSize: 13,
  lineHeight: 1.45,
};

const emptyStyle: React.CSSProperties = {
  padding: 14,
  border: "1px solid " + colors.line,
  borderRadius: 14,
  background: "#f8fafc",
  color: colors.muted,
  fontSize: 14,
};


const matterTitleStyle: React.CSSProperties = {
  fontSize: 17,
  fontWeight: 950,
  color: colors.blueDark,
  marginBottom: 4,
};

const matterTitleLinkStyle: React.CSSProperties = {
  display: "inline-flex",
  fontSize: 17,
  fontWeight: 950,
  color: colors.blueDark,
  marginBottom: 4,
  textDecoration: "none",
};


const matterMetaStyle: React.CSSProperties = {
  color: colors.ink,
  fontSize: 14,
  fontWeight: 750,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const matterSubMetaStyle: React.CSSProperties = {
  marginTop: 4,
  color: colors.muted,
  fontSize: 12,
  lineHeight: 1.4,
};

const resultAmountStyle: React.CSSProperties = {
  display: "grid",
  gap: 5,
  textAlign: "right",
  color: colors.muted,
  fontSize: 13,
};


const typeaheadSuggestionBoxStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
  padding: 12,
  border: "1px solid #dbe3ee",
  borderRadius: 18,
  background: "linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)",
};

const typeaheadHeadingStyle: React.CSSProperties = {
  color: colors.ink,
  fontSize: 13,
  fontWeight: 950,
  letterSpacing: "0.02em",
};

const typeaheadHelpTextStyle: React.CSSProperties = {
  marginTop: 3,
  color: colors.subtle,
  fontSize: 12,
  fontWeight: 650,
};

const typeaheadStatusStyle: React.CSSProperties = {
  color: colors.subtle,
  fontSize: 12,
  fontWeight: 850,
};

const typeaheadHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  color: colors.subtle,
  fontSize: 12,
  fontWeight: 800,
};

const typeaheadEmptyStyle: React.CSSProperties = {
  padding: "8px 10px",
  color: colors.muted,
  fontSize: 13,
};

const typeaheadListStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
};

const typeaheadRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  alignItems: "center",
  gap: 16,
  padding: "12px 14px",
  border: "1px solid #e5e7eb",
  borderRadius: 16,
  background: "#ffffff",
  color: colors.ink,
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.03)",
  transition: "background 140ms ease, border-color 140ms ease, box-shadow 140ms ease, transform 140ms ease",
};




const typeaheadTextButtonStyle: React.CSSProperties = {
  appearance: "none",
  border: 0,
  padding: 0,
  margin: 0,
  background: "transparent",
  color: colors.ink,
  font: "inherit",
  fontWeight: 850,
  cursor: "pointer",
  textDecoration: "underline",
  textDecorationThickness: 1,
  textUnderlineOffset: 3,
};


const typeaheadMetaStyle: React.CSSProperties = {
  color: colors.ink,
  fontSize: 13,
  fontWeight: 750,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const typeaheadRightStyle: React.CSSProperties = {
  display: "grid",
  justifyItems: "end",
  gap: 4,
  color: colors.muted,
  fontSize: 12,
  fontWeight: 800,
};


const typeaheadTopLineStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  marginBottom: 8,
};


const typeaheadTitleLinkStyle: React.CSSProperties = {
  display: "inline-flex",
  color: colors.blueDark,
  fontSize: 17,
  fontWeight: 950,
  textDecoration: "none",
};

const typeaheadMatchedBadgeStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "3px 7px",
  border: "1px solid #dbe3ee",
  borderRadius: 999,
  background: "#f8fafc",
  color: colors.subtle,
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
};

const typeaheadMetaGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(120px, 0.85fr) minmax(190px, 1.2fr) minmax(160px, 1fr) minmax(95px, 0.5fr)",
  gap: 10,
  alignItems: "start",
};

const resultMetaGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(120px, 0.85fr) minmax(190px, 1.2fr) minmax(160px, 1fr) minmax(95px, 0.5fr) minmax(120px, 0.65fr)",
  gap: 10,
  alignItems: "start",
};

const typeaheadFieldStyle: React.CSSProperties = {
  display: "grid",
  gap: 3,
  minWidth: 0,
};

const typeaheadFieldLabelStyle: React.CSSProperties = {
  color: colors.subtle,
  fontSize: 10,
  fontWeight: 950,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

const typeaheadFieldLinkStyle: React.CSSProperties = {
  color: colors.ink,
  fontSize: 13,
  fontWeight: 850,
  textDecoration: "underline",
  textDecorationThickness: 1,
  textUnderlineOffset: 3,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const resultFieldLinkStyle: React.CSSProperties = {
  color: colors.ink,
  fontSize: 13,
  fontWeight: 850,
  textDecoration: "underline",
  textDecorationThickness: 1,
  textUnderlineOffset: 3,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const typeaheadMissingStyle: React.CSSProperties = {
  color: colors.subtle,
  fontSize: 13,
  fontWeight: 700,
};

const typeaheadAmountStyle: React.CSSProperties = {
  color: colors.muted,
  fontSize: 13,
  fontWeight: 900,
  fontVariantNumeric: "tabular-nums",
};

const typeaheadOpenLinkStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "8px 12px",
  border: "1px solid #b6c7e3",
  borderRadius: 11,
  background: "#f8fbff",
  color: colors.blueDark,
  fontSize: 12,
  fontWeight: 950,
  textDecoration: "none",
  whiteSpace: "nowrap",
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.05)",
  transition: "background 140ms ease, border-color 140ms ease, transform 140ms ease",
};


const structuredSearchHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 18,
  marginBottom: 18,
};

const structuredSearchKickerStyle: React.CSSProperties = {
  color: colors.subtle,
  fontSize: 12,
  fontWeight: 950,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
};

const structuredSearchTitleStyle: React.CSSProperties = {
  margin: "5px 0 0",
  color: colors.ink,
  fontSize: 24,
  fontWeight: 950,
  letterSpacing: "-0.035em",
};

const advancedSearchButtonStyle: React.CSSProperties = {
  appearance: "none",
  border: "1px solid #bfdbfe",
  borderRadius: 16,
  background: "#eff6ff",
  color: "#00346e",
  padding: "12px 16px",
  fontSize: 14,
  fontWeight: 900,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const structuredSearchGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: 14,
  alignItems: "end",
};

const knownInformationGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 14,
  alignItems: "end",
};

const structuredFieldStyle: React.CSSProperties = {
  display: "grid",
  gap: 7,
  minWidth: 0,
};

const brlInputWrapStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "auto minmax(0, 1fr)",
  alignItems: "center",
  border: "1px solid " + colors.line,
  borderRadius: 16,
  background: "#ffffff",
  overflow: "hidden",
};

const brlPrefixStyle: React.CSSProperties = {
  height: "100%",
  display: "inline-flex",
  alignItems: "center",
  padding: "0 14px",
  borderRight: "1px solid " + colors.line,
  background: "#f8fafc",
  color: colors.blueDark,
  fontSize: 16,
  fontWeight: 950,
  letterSpacing: "0.02em",
};

const prefixedInputStyle: React.CSSProperties = {
  border: "none",
  outline: "none",
  padding: "16px 18px",
  color: colors.ink,
  fontSize: 18,
  fontWeight: 850,
  background: "#ffffff",
  minWidth: 0,
};

const structuredButtonGridStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 10,
  marginTop: 18,
};

const advancedOverlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 500,
  display: "grid",
  placeItems: "center",
  padding: 24,
  background: "rgba(15, 23, 42, 0.42)",
};

const advancedModalStyle: React.CSSProperties = {
  width: "calc(100vw - 32px)",
  maxHeight: "calc(100vh - 70px)",
  overflow: "auto",
  border: "1px solid " + colors.line,
  borderRadius: 24,
  background: "#ffffff",
  boxShadow: "0 28px 80px rgba(15, 23, 42, 0.32)",
  padding: 22,
};

const advancedModalHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 18,
  marginBottom: 18,
};

const advancedModalTitleStyle: React.CSSProperties = {
  margin: "4px 0 0",
  color: colors.ink,
  fontSize: 24,
  fontWeight: 950,
  letterSpacing: "-0.03em",
};

const advancedModalHelpStyle: React.CSSProperties = {
  marginTop: 6,
  color: colors.muted,
  fontSize: 13,
  fontWeight: 700,
  lineHeight: 1.45,
};

const advancedCloseButtonStyle: React.CSSProperties = {
  appearance: "none",
  width: 40,
  height: 40,
  border: "1px solid " + colors.line,
  borderRadius: 14,
  background: "#ffffff",
  color: colors.ink,
  fontSize: 26,
  fontWeight: 900,
  lineHeight: 1,
  cursor: "pointer",
};

const advancedGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: 12,
};

const advancedModalActionsStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 10,
  justifyContent: "flex-end",
  marginTop: 20,
  paddingTop: 16,
  borderTop: "1px solid " + colors.lineSoft,
};



const compactLandingTopBarStyle: React.CSSProperties = {
  ...topBarStyle,
  position: "relative",
  top: "auto",
  zIndex: 10,
  gridTemplateColumns: "500px minmax(0, 1fr) 330px",
  minHeight: 124,
  padding: "6px 0 4px",
  marginBottom: 6,
  alignItems: "start",
  background: "#f8fafc",
  boxShadow: "none",
  borderBottom: "none",
};

const compactLandingLookupPanelStyle: React.CSSProperties = {
  ...lookupPanelStyle,
  marginTop: 0,
};

const mainPageSectionLabelStyle: React.CSSProperties = {
  margin: "4px 0 10px",
  color: colors.subtle,
  fontSize: 12,
  fontWeight: 950,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
};

const mainPageDirectHelpStyle: React.CSSProperties = {
  marginTop: 10,
  color: colors.muted,
  fontSize: 12,
  fontWeight: 750,
  lineHeight: 1.4,
};

const mainPageSearchDividerStyle: React.CSSProperties = {
  height: 1,
  margin: "20px 0 16px",
  background: colors.lineSoft,
};

const mainPageSearchHeaderRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 14,
  margin: "0 0 10px",
};

const mainPageSearchGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 14,
  alignItems: "end",
};




const searchResultsHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 18,
  marginBottom: 16,
  paddingBottom: 14,
  borderBottom: "1px solid #e2e8f0",
};

const searchResultsKickerStyle: React.CSSProperties = {
  color: "#385a83",
  fontSize: 12,
  fontWeight: 950,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
};

const searchResultsTitleStyle: React.CSSProperties = {
  margin: "5px 0 0",
  color: colors.ink,
  fontSize: 24,
  fontWeight: 950,
  letterSpacing: "-0.03em",
};

const searchResultsSubTitleStyle: React.CSSProperties = {
  marginTop: 5,
  color: colors.muted,
  fontSize: 13,
  fontWeight: 750,
};



const homeResultsTablePanelStyle: React.CSSProperties = {
  marginTop: 22,
  padding: 18,
  border: "1px solid #cbd5e1",
  borderRadius: 20,
  background: "#ffffff",
  boxShadow: "0 16px 42px rgba(15, 23, 42, 0.10)",
};

const homeResultsTableHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 18,
  marginBottom: 14,
  paddingBottom: 12,
  borderBottom: "1px solid #e2e8f0",
};

const homeResultsTableScrollStyle: React.CSSProperties = {
  overflowX: "auto",
  border: "1px solid #e2e8f0",
  borderRadius: 14,
};

const homeResultsTableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 13,
};

const homeResultsThStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderBottom: "1px solid #cbd5e1",
  background: "#f8fafc",
  color: "#385a83",
  fontWeight: 950,
  textAlign: "left",
  whiteSpace: "nowrap",
};

const homeResultsTdStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderBottom: "1px solid #e2e8f0",
  color: "#00346e",
  verticalAlign: "top",
  whiteSpace: "nowrap",
};

const homeResultsMatterLinkStyle: React.CSSProperties = {
  color: "#00346e",
  font: "inherit",
  fontSize: "inherit",
  fontWeight: 850,
  textDecoration: "none",
};

const homeResultsFieldButtonStyle: React.CSSProperties = {
  appearance: "none",
  border: 0,
  background: "transparent",
  color: "#00346e",
  cursor: "pointer",
  font: "inherit",
  fontSize: "inherit",
  fontWeight: 800,
  padding: 0,
  textAlign: "left",
  textDecoration: "none",
};

const homeResultsHeaderButtonStyle: React.CSSProperties = {
  appearance: "none",
  border: 0,
  background: "transparent",
  color: "inherit",
  cursor: "pointer",
  font: "inherit",
  fontWeight: 950,
  padding: 0,
  textAlign: "left",
};










