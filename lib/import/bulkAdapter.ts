import { parseMoney, parseDosSpan, toDateOnly } from "@/lib/import/parse";
import { computeBillFingerprint } from "@/lib/import/fingerprint";
import { toFirstLastProperCase, patientMatchKey } from "@/lib/patientResolution";
import { normalizeCaseType } from "@/lib/import/otherAdapter";

// Adapter for the ONE-TIME bulk load of the closed NF file (~264k rows). Like the "Other" adapter the
// operator maps columns to BM fields, but bulk adds two things the live importers don't need:
//   1) `opened_date` — the matter's opened date, used for the PRE-2025 PATIENT QUARANTINE (matters
//      opened before 1/1/2025 record a bulk-only, non-matchable patient; 2025+ seed matchable ones).
//   2) an ACCIDENT KEY (Packet ID > Claim# > Policy#+DOL > solo) used to cluster same-accident bills
//      into one patient (fold misspellings safely without merging namesakes across accidents).
// Pure — no DB. Carrier resolution is lenient (see bulkCarrierResolution.ts): matched carriers link,
// everything else is recorded RAW on the historical matter (never held, never creates a registry row).

export const BULK_FIELDS: { key: string; label: string; required?: boolean; aliases: string[] }[] = [
  { key: "old_matter_number", label: "Case_Id (legacy 445 # → matter; sets year)", required: true, aliases: ["caseid", "case id", "case_id", "445", "oldfilenumber", "filenumber", "oldmatternumber", "matternumber"] },
  { key: "old_lawsuit_number", label: "Packet ID (legacy 445-PKT # → lawsuit; 2+ = a lawsuit)", aliases: ["packet", "packetid", "packet id", "445pkt", "445 pkt", "packetnumber", "oldlawsuitnumber", "lawsuitnumber"] },
  { key: "claim_number_raw", label: "Claim Number", aliases: ["claim", "claimnumber", "claimno", "claim #", "insuredsid"] },
  { key: "policy_number", label: "Policy Number", aliases: ["policy", "policynumber", "policyno", "policy #"] },
  { key: "patient_name", label: "Patient / Claimant", required: true, aliases: ["patient", "patientname", "claimant", "insured", "member", "name"] },
  { key: "carrier_raw", label: "Insurer / Carrier", required: true, aliases: ["carrier", "carriername", "insurer", "insurance", "insurancecompany", "payer"] },
  { key: "provider_raw", label: "Provider (per-row)", aliases: ["provider", "providername", "facility"] },
  { key: "provider_group", label: "Provider Group", aliases: ["providergroup", "provider group", "group"] },
  { key: "settled_with", label: "Settled With", aliases: ["settledwith", "settled with"] },
  { key: "index_aaa_number", label: "Index OR AAA Number", aliases: ["index", "aaa", "indexoraaanumber", "index or aaa number", "indexnumber"] },
  { key: "court_venue", label: "Court Name (→ lawsuit venue)", aliases: ["court", "courtname", "court name", "venue"] },
  { key: "defendant", label: "Defendant (→ adversary attorney)", aliases: ["defendant", "adversary", "defensefirm"] },
  { key: "date_bill_sent", label: "Date Bill Sent (→ notes)", aliases: ["datebillsent", "date bill sent", "billsent"] },
  { key: "date_aaa_arb_filed", label: "Date AAA Arb Filed (→ lawsuit Date Filed)", aliases: ["dateaaaarbfiled", "date aaa arb filed", "arbfiled", "datefiled"] },
  { key: "opened_date", label: "Date Opened (matter)", required: true, aliases: ["dateopened", "opened", "openeddate", "date opened", "intake", "createddate"] },
  { key: "date_of_loss", label: "Date of Loss / Injury", aliases: ["doi", "dateofinjury", "dateofloss", "dol", "accidentdate", "lossdate"] },
  { key: "dos_start", label: "Date(s) of Service", required: true, aliases: ["dos", "dateofservice", "servicedate", "dosstart"] },
  { key: "dos_end", label: "DOS end", aliases: ["dosend", "dateofserviceend"] },
  { key: "claim_amount", label: "Claim Amount", required: true, aliases: ["amount", "charges", "totalcharges", "billamount", "billed", "claimamount"] },
  { key: "voluntary_payment", label: "Voluntary Payment (Case Level)", aliases: ["voluntary", "voluntarypayment", "voluntary payment"] },
  { key: "collection_payment", label: "Collection Payment (Case Level)", aliases: ["collection", "collectionpayment", "collection payment"] },
  { key: "suit_balance", label: "Suit Balance (Case Level)", aliases: ["suitbalance", "suit balance", "balance"] },
  { key: "service_type", label: "Service Type", aliases: ["servicetype", "billtype", "specialty", "type"] },
  { key: "denial_reason", label: "Denial Reason", aliases: ["denial", "denialreason", "denialreasons", "reason", "eob"] },
  { key: "close_reason", label: "Status / Close Reason", aliases: ["status", "closereason", "close reason"] },
  { key: "treating_provider", label: "Treating Provider", aliases: ["physician", "provider", "doctor", "treating"] },
  { key: "case_type", label: "Case Type", aliases: ["casetype", "claimtype", "coverage", "lineofbusiness", "lob"] },
];

export type BulkMapping = Record<string, string>; // bmField -> source column header
export type BulkFixed = { providerEntityId?: string; providerDisplayName?: string; caseType?: string };

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");

/** Original file year from a legacy Case_Id `445YY-NNNNNN` (e.g. 44521-… -> 2021). */
export function yearFromCaseId(caseId: string): number | null {
  const m = String(caseId || "").match(/\b445\s*(\d{2})\b/);
  return m ? 2000 + Number(m[1]) : null;
}
/** Original file year from a legacy Packet id `445-PKTYY-NNNNNN` (e.g. 445-PKT24-… -> 2024). */
export function yearFromPacket(packetId: string): number | null {
  const m = String(packetId || "").match(/PKT\s*(\d{2})/i);
  return m ? 2000 + Number(m[1]) : null;
}

/** Auto-suggest a mapping by matching source headers to each field's aliases (best-effort). */
export function suggestBulkMapping(headers: string[]): BulkMapping {
  const out: BulkMapping = {};
  const used = new Set<string>();
  for (const f of BULK_FIELDS) {
    const wants = new Set([norm(f.key), norm(f.label), ...f.aliases.map(norm)]);
    const hit = headers.find((h) => !used.has(h) && wants.has(norm(h)));
    if (hit) { out[f.key] = hit; used.add(hit); }
  }
  return out;
}

export type StagedBulkMatter = {
  packet_id: string;
  packet_key: string; // packet_id OR 445-PKT — presence => this bill joins/forms a lawsuit
  old_matter_number: string; // legacy 445 file number -> ClaimIndex.old_matter_number
  old_lawsuit_number: string; // legacy 445-PKT number -> Lawsuit.oldLawsuitNumber
  claim_number_raw: string;
  policy_number: string;
  patient_name: string;
  patient_raw: string;
  carrier_raw: string;
  provider_raw: string; // per-row Provider value (resolved to provider_client, lenient)
  provider_group: string;
  settled_with: string;
  index_aaa_number: string; // lawsuit-level; standalone -> notes
  court_venue: string; // -> Lawsuit.venue
  defendant: string; // -> adversary_attorney (lawsuit); standalone -> notes
  date_bill_sent: string; // -> matter notes
  date_aaa_arb_filed: string; // -> Lawsuit.lawsuitOptions.dateFiled; standalone -> notes
  matter_year: number | null; // from Case_Id 445YY -> BRL_ year
  lawsuit_year: number | null; // from Packet 445-PKTYY -> dotted lawsuit year
  opened_date: string; // YYYY-MM-DD or ""
  opened_year: number | null;
  is_pre2025: boolean; // opened before 2025-01-01 (or unknown) -> quarantined patient
  date_of_loss: string;
  dos_start: string;
  dos_end: string;
  claim_amount: number | null;
  balance_presuit: number | null; // = Suit Balance (Claim − voluntary), what the UI "Balance" reads
  voluntary_payment: number | null; // Voluntary Payment (Case Level)
  collection_payment: number | null; // Collection Payment (Case Level) — lawsuit-level "Payments"
  suit_balance: number | null;
  service_type: string;
  denial_reason: string;
  close_reason: string; // legacy Status/close detail
  treating_provider: string;
  case_type: string;
  case_type_raw: string;
  case_type_unknown: boolean;
  accident_key: string; // strong key clustering same-accident bills
  patient_cluster: string; // accident_key + patient match key
  fingerprint: string;
  errors: string[];
  raw: Record<string, unknown>;
};

function cell(row: Record<string, unknown>, mapping: BulkMapping, key: string): string {
  const col = mapping[key];
  if (!col) return "";
  const v = row[col];
  return v === null || v === undefined ? "" : String(v).trim();
}

// Service-type capitalization normalizer (bulk-only). The NF sheet stores service types in wildly
// inconsistent case: acronyms ("MRI", "EMG/NCV", "DME"), shout-case words ("PHYSICAL THERAPY"), mixed
// case ("Disability Exam"), comma-joined combos, and a junk placeholder ("--- Select Sevice Types ---").
// We Title-Case ordinary words, keep known acronyms uppercase, preserve "/" and "-" compounds, and drop
// the placeholder. Live importers store service_type raw — this runs ONLY in the bulk load.
const SERVICE_TYPE_ACRONYMS = new Set([
  "MRI", "MRA", "CT", "PT", "OT", "DME", "EMG", "NCV", "NCS", "MUA", "ROM", "MMT",
  "CPM", "AC", "CH", "3T", "XRAY", "XR", "US", "TENS", "DOT", "CPT", "TMJ",
]);

function normalizeServiceWord(word: string): string {
  if (!word) return word;
  const up = word.toUpperCase();
  if (SERVICE_TYPE_ACRONYMS.has(up)) return up;
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

export function normalizeServiceType(raw: string): string {
  const s = String(raw || "").trim();
  if (!s) return "";
  const tokens = s
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .filter((t) => !(/select/i.test(t) && /type/i.test(t))); // drop "--- Select Sevice Types ---" placeholder
  const normalized = tokens
    .map((tok) =>
      tok
        .split(/\s+/)
        .filter(Boolean)
        .map((w) =>
          w
            .split(/([/-])/) // keep "/" and "-" as separators between sub-parts
            .map((part) => (part === "/" || part === "-" ? part : normalizeServiceWord(part)))
            .join("")
        )
        .join(" ")
    )
    .filter(Boolean);
  return normalized.join(", ");
}

const PRE_2025_CUTOFF_YEAR = 2025;

export function mapBulkRow(row: Record<string, unknown>, mapping: BulkMapping, fixed: BulkFixed, rowIndex: number): StagedBulkMatter {
  const packet = cell(row, mapping, "packet_id");
  const oldMatter = cell(row, mapping, "old_matter_number");
  const oldLawsuit = cell(row, mapping, "old_lawsuit_number");
  // A PKT number in EITHER the Packet ID or the 445-PKT column means this bill forms/joins a lawsuit.
  const packetKey = packet || oldLawsuit;
  const claim = cell(row, mapping, "claim_number_raw");
  const policy = cell(row, mapping, "policy_number");
  const patientRaw = cell(row, mapping, "patient_name");
  const patient = toFirstLastProperCase(patientRaw);
  const carrier = cell(row, mapping, "carrier_raw");
  const dos = parseDosSpan(cell(row, mapping, "dos_start"));
  const amount = parseMoney(cell(row, mapping, "claim_amount"));
  const voluntary = parseMoney(cell(row, mapping, "voluntary_payment"));
  const collection = parseMoney(cell(row, mapping, "collection_payment"));
  const suit = parseMoney(cell(row, mapping, "suit_balance"));
  const dol = toDateOnly(cell(row, mapping, "date_of_loss"));

  const opened = toDateOnly(cell(row, mapping, "opened_date"));
  const openedYear = opened ? Number(opened.slice(0, 4)) : null;
  // Unknown/unparseable opened date is treated as pre-2025 (quarantine) — safer than seeding a
  // matchable patient we can't date-confirm as recent.
  const isPre2025 = openedYear == null || openedYear < PRE_2025_CUTOFF_YEAR;

  const caseRaw = fixed.caseType ? fixed.caseType : cell(row, mapping, "case_type");
  const caseType = fixed.caseType ? fixed.caseType : normalizeCaseType(caseRaw);

  const errors: string[] = [];
  if (!claim && !policy && !packet) errors.push("Missing Packet ID / Claim / Policy.");
  if (!patient) errors.push("Missing patient name.");
  if (!carrier) errors.push("Missing carrier.");
  if (amount === null) errors.push("Missing/invalid amount.");
  if (!dos.start) errors.push("Missing/invalid date(s) of service.");
  if (!opened) errors.push("Missing/invalid Date Opened.");

  // Strong accident key: PKT (Packet ID / 445-PKT) > Claim# > Policy#+DOL > per-row solo (never merges).
  const accident_key = packetKey
    ? `pkt:${norm(packetKey)}`
    : claim
      ? `clm:${norm(claim)}`
      : policy
        ? `pol:${norm(policy)}|${dol}`
        : `solo:${rowIndex}`;

  const fingerprint = computeBillFingerprint({
    claimOrPolicy: claim || policy || packet,
    patientKey: patientMatchKey(patient),
    dosStart: dos.start,
    dosEnd: dos.end,
    grossAmount: amount,
  });

  return {
    packet_id: packet,
    packet_key: packetKey,
    old_matter_number: oldMatter,
    old_lawsuit_number: oldLawsuit,
    claim_number_raw: claim,
    policy_number: policy,
    patient_name: patient,
    patient_raw: patientRaw,
    carrier_raw: carrier,
    provider_raw: cell(row, mapping, "provider_raw"),
    provider_group: cell(row, mapping, "provider_group"),
    settled_with: cell(row, mapping, "settled_with"),
    index_aaa_number: cell(row, mapping, "index_aaa_number"),
    court_venue: cell(row, mapping, "court_venue"),
    defendant: cell(row, mapping, "defendant"),
    date_bill_sent: toDateOnly(cell(row, mapping, "date_bill_sent")),
    date_aaa_arb_filed: toDateOnly(cell(row, mapping, "date_aaa_arb_filed")),
    matter_year: yearFromCaseId(oldMatter),
    lawsuit_year: yearFromPacket(oldLawsuit),
    opened_date: opened,
    opened_year: openedYear,
    is_pre2025: isPre2025,
    date_of_loss: dol,
    dos_start: dos.start,
    dos_end: dos.end || dos.start,
    claim_amount: amount,
    balance_presuit: suit != null ? suit : amount, // Suit Balance = Claim − voluntary (UI "Balance")
    voluntary_payment: voluntary,
    collection_payment: collection,
    suit_balance: suit,
    service_type: normalizeServiceType(cell(row, mapping, "service_type")),
    denial_reason: cell(row, mapping, "denial_reason"),
    close_reason: cell(row, mapping, "close_reason"),
    treating_provider: toFirstLastProperCase(cell(row, mapping, "treating_provider")),
    case_type: caseType,
    case_type_raw: caseRaw,
    case_type_unknown: Boolean(caseRaw) && caseType === "",
    accident_key,
    patient_cluster: `${accident_key}||${patientMatchKey(patient)}`,
    fingerprint,
    errors,
    raw: row,
  };
}

export function mapBulkRows(rows: Record<string, unknown>[], mapping: BulkMapping, fixed: BulkFixed): StagedBulkMatter[] {
  const out: StagedBulkMatter[] = [];
  let i = 0;
  for (const r of rows) {
    if (!Object.values(r).some((v) => String(v ?? "").trim() !== "")) continue; // skip blank rows
    out.push(mapBulkRow(r, mapping, fixed, i));
    i += 1;
  }
  return out;
}

/** Source-specific columns to merge onto a created matter. */
export function bulkExtraFields(m: StagedBulkMatter): Record<string, unknown> {
  return {
    policy_number: m.policy_number || null,
    denial_reason: m.denial_reason || null,
    treating_provider: m.treating_provider || null,
    old_matter_number: m.old_matter_number || null, // legacy 445 file number
  };
}
