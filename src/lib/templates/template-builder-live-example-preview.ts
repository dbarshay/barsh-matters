import { prisma } from "@/lib/prisma";

export type TemplateBuilderExamplePreviewResult = {
  matterKey: string;
  resolved: Record<string, string>;
  diagnostics: string[];
};

const ALLOWED_TOKENS = [
  "{{matter.fileNumber}}",
  "{{matter.providerName}}",
  "{{matter.patientName}}",
  "{{matter.claimNumber}}",
  "{{matter.billedAmount}}",
  "{{provider.taxId}}",
  "{{treatingProvider.name}}",
  "{{insurer.name}}",
  "{{insurer.hidden_street}}",
  "{{insurer.hidden_city}}",
  "{{insurer.hidden_state}}",
  "{{insurer.hidden_zipcode}}",
  "{{claim.number}}",
  "{{claim.policyNumber}}",
  "{{claim.dateOfLoss}}",
  "{{claim.dateOfService}}",
  "{{claim.amount}}",
  "{{claim.balance}}",
  "{{claim.payments}}",
  "{{claim.denialReason}}",
  "{{lawsuit.indexNumber}}",
  "{{lawsuit.court}}",
  "{{lawsuit.adversaryAttorney}}",
  "{{lawsuit.dateFiled}}",
  "{{lawsuit.amount}}",
  "{{lawsuit.costs}}",
  "{{lawsuit.paymentsPosted}}",
  "{{lawsuit.balance}}",
  "{{cost.indexFee}}",
  "{{cost.serviceFee}}",
  "{{cost.otherCourtCosts}}",
  "{{cost.total}}"
] as const;

const FALLBACKS: Record<string, Record<string, string>> = {
  "BRL_202600003": {
    "{{claim.number}}": "1111",
    "{{claim.amount}}": "$562.25",
    "{{claim.balance}}": "$562.25",
    "{{claim.payments}}": "$0.00",
    "{{claim.denialReason}}": "Medical Necessity",
    "{{lawsuit.indexNumber}}": "123444/2026",
    "{{lawsuit.amount}}": "$1,261.75",
    "{{lawsuit.balance}}": "$1,261.75",
    "{{cost.total}}": "$0.00"
  },
  "BRL30236": {
    "{{claim.number}}": "123456",
    "{{claim.amount}}": "$500.00",
    "{{claim.balance}}": "$500.00",
    "{{claim.payments}}": "$0.00",
    "{{claim.denialReason}}": "Medical Necessity",
    "{{lawsuit.indexNumber}}": "Not filed",
    "{{lawsuit.balance}}": "$500.00",
    "{{cost.total}}": "$0.00"
  },
  "2026.06.00002": {
    "{{claim.number}}": "123456",
    "{{claim.amount}}": "$1,250.00",
    "{{claim.balance}}": "$1,250.00",
    "{{claim.payments}}": "$0.00",
    "{{claim.denialReason}}": "Medical Necessity",
    "{{lawsuit.indexNumber}}": "2026.06.00002",
    "{{lawsuit.amount}}": "$1,250.00",
    "{{lawsuit.balance}}": "$1,250.00",
    "{{cost.total}}": "$0.00"
  },
  "2026.06.00011": {
    "{{claim.number}}": "EX-00011",
    "{{claim.amount}}": "$888.88",
    "{{claim.balance}}": "$777.77",
    "{{claim.payments}}": "$111.11",
    "{{claim.denialReason}}": "Verification Requested",
    "{{lawsuit.indexNumber}}": "2026.06.00011",
    "{{lawsuit.amount}}": "$888.88",
    "{{lawsuit.balance}}": "$777.77",
    "{{cost.total}}": "$65.00"
  }
};

function text(value: unknown): string | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  return String(value);
}

function money(value: unknown): string | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const numeric = typeof value === "number" ? value : Number(String(value).replace(/[^0-9.-]/g, ""));
  if (!Number.isFinite(numeric)) return String(value);
  return numeric.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function date(value: unknown): string | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const parsed = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return String(value);
  const mm = String(parsed.getMonth() + 1).padStart(2, "0");
  const dd = String(parsed.getDate()).padStart(2, "0");
  return mm + "/" + dd + "/" + parsed.getFullYear();
}

function from(row: Record<string, unknown> | null | undefined, keys: string[]): unknown {
  if (!row) return undefined;
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(row, key) && row[key] !== null && row[key] !== undefined && row[key] !== "") return row[key];
  }
  return undefined;
}

function identifier(value: string): string {
  return String.fromCharCode(34) + value.replaceAll(String.fromCharCode(34), String.fromCharCode(34) + String.fromCharCode(34)) + String.fromCharCode(34);
}

function literal(value: string): string {
  return String.fromCharCode(39) + value.replaceAll(String.fromCharCode(39), String.fromCharCode(39) + String.fromCharCode(39)) + String.fromCharCode(39);
}

async function tableColumns(tableName: string): Promise<Set<string>> {
  try {
    const rows = await prisma.$queryRawUnsafe(
      "SELECT column_name FROM information_schema.columns WHERE table_schema = " + literal("public") + " AND table_name = " + literal(tableName) + " ORDER BY ordinal_position"
    ) as Array<Record<string, unknown>>;
    const names = rows.map((row) => String(row.column_name || "")).filter(Boolean);
    if (names.length > 0) return new Set(names);
  } catch {
  }

  try {
    const rows = await prisma.$queryRawUnsafe("PRAGMA table_info(" + identifier(tableName) + ")") as Array<Record<string, unknown>>;
    return new Set(rows.map((row) => String(row.name || "")).filter(Boolean));
  } catch {
    return new Set<string>();
  }
}

async function findRows(tableName: string, candidateColumns: string[], value: string, limit: number): Promise<Array<Record<string, unknown>>> {
  const columns = await tableColumns(tableName);
  const usable = candidateColumns.filter((column) => columns.has(column));
  if (usable.length === 0) return [];

  const where = usable.map((column) => "CAST(" + identifier(column) + " AS TEXT) = " + literal(value)).join(" OR ");
  const sql = "SELECT * FROM " + identifier(tableName) + " WHERE " + where + " LIMIT " + String(limit);

  try {
    return await prisma.$queryRawUnsafe(sql) as Array<Record<string, unknown>>;
  } catch {
    return [];
  }
}

async function providerInfo(providerName: string | undefined): Promise<Record<string, unknown> | null> {
  if (!providerName) return null;
  const rows = await findRows("ProviderClientInfo", ["name", "client_name", "provider_name"], providerName, 1);
  return rows[0] || null;
}

function put(resolved: Record<string, string>, token: string, value: string | undefined) {
  if (value !== undefined && value !== "") resolved[token] = value;
}

function sum(rows: Array<Record<string, unknown>>, keys: string[]): number {
  let total = 0;
  for (const row of rows) {
    for (const key of keys) {
      const value = from(row, [key]);
      if (value === undefined) continue;
      const numeric = typeof value === "number" ? value : Number(String(value).replace(/[^0-9.-]/g, ""));
      if (Number.isFinite(numeric)) {
        total += numeric;
        break;
      }
    }
  }
  return total;
}

export async function resolveTemplateBuilderExamplePreview(matterKey: string): Promise<TemplateBuilderExamplePreviewResult> {
  const diagnostics: string[] = [];
  const resolved: Record<string, string> = {};

  const claimRows = await findRows("ClaimIndex", ["matter_id", "display_number", "master_lawsuit_id", "index_aaa_number"], matterKey, 25);
  const childRows = await findRows("ClaimIndex", ["master_lawsuit_id", "index_aaa_number"], matterKey, 50);
  const rows = childRows.length > 0 ? childRows : claimRows;
  const source = rows[0] || null;

  if (rows.length === 0) diagnostics.push("No live ClaimIndex row matched selected example matter.");
  if (childRows.length > 0) diagnostics.push("Resolved preview from live ClaimIndex child rows.");

  const providerName = text(from(source, ["provider_name", "patient_provider", "provider", "client_name"]));
  const provider = await providerInfo(providerName);

  const patientName = text(from(source, ["patient_name", "patient", "patient_full_name"])) || [
    text(from(source, ["patient_first_name", "first_name"])),
    text(from(source, ["patient_last_name", "last_name"]))
  ].filter(Boolean).join(" ");
  const claimNumber = text(from(source, ["claim_number_raw", "claim_number", "claim_number_normalized", "bill_number"]));
  const previewDateOfService = rows.length > 1
    ? (date(from(rows[0], ["dos_start", "date_of_service", "dos"])) || "") + " - " + (date(from(rows[rows.length - 1], ["dos_end", "date_of_service", "dos"])) || "")
    : date(from(source, ["dos_start", "date_of_service", "dos"]));
  const previewBilledAmount = rows.length > 1
    ? money(sum(rows, ["claim_amount", "amount", "billed_amount"]))
    : money(from(source, ["claim_amount", "amount", "billed_amount"]));

  put(resolved, "{{matter.fileNumber}}", matterKey || text(from(source, ["display_number", "matter_id", "master_lawsuit_id", "index_aaa_number"])));
  put(resolved, "{{matter.providerName}}", providerName);
  put(resolved, "{{matter.patientName}}", patientName);
  put(resolved, "{{matter.claimNumber}}", claimNumber);
  put(resolved, "{{matter.billedAmount}}", previewBilledAmount);

  put(resolved, "{{provider.taxId}}", text(from(source, ["tax_id", "provider_tax_id", "tin"])) || text(from(provider, ["tax_id", "tin", "provider_tax_id"])));

  put(resolved, "{{treatingProvider.name}}", text(from(source, ["treating_provider", "treating_provider_name", "doctor_name"])) || providerName);
  put(resolved, "{{insurer.name}}", text(from(source, ["insurer_name", "patient_insurer", "insurer"])));
  put(resolved, "{{insurer.hidden_street}}", text(from(source, ["insurer_hidden_street", "insurance_hidden_street"])));
  put(resolved, "{{insurer.hidden_city}}", text(from(source, ["insurer_hidden_city", "insurance_hidden_city"])));
  put(resolved, "{{insurer.hidden_state}}", text(from(source, ["insurer_hidden_state", "insurance_hidden_state"])));
  put(resolved, "{{insurer.hidden_zipcode}}", text(from(source, ["insurer_hidden_zipcode", "insurer_hidden_zip", "insurance_hidden_zipcode"])));

  put(resolved, "{{claim.number}}", claimNumber);
  put(resolved, "{{claim.policyNumber}}", text(from(source, ["policy_number", "policy"])));
  put(resolved, "{{claim.dateOfLoss}}", date(from(source, ["date_of_loss", "dol"])));
  put(resolved, "{{claim.dateOfService}}", previewDateOfService);
  put(resolved, "{{claim.amount}}", previewBilledAmount);
  put(resolved, "{{claim.balance}}", rows.length > 1 ? money(sum(rows, ["balance_amount", "balance_presuit", "balance"])) : money(from(source, ["balance_amount", "balance_presuit", "balance"])));
  put(resolved, "{{claim.payments}}", rows.length > 1 ? money(sum(rows, ["payment_amount", "payment_voluntary", "payments"])) : money(from(source, ["payment_amount", "payment_voluntary", "payments"])));
  put(resolved, "{{claim.denialReason}}", text(from(source, ["denial_reason", "denialReason"])));

  put(resolved, "{{lawsuit.indexNumber}}", text(from(source, ["index_aaa_number", "index_number", "master_lawsuit_id"])));
  put(resolved, "{{lawsuit.court}}", text(from(source, ["court", "court_name"])));
  put(resolved, "{{lawsuit.adversaryAttorney}}", text(from(source, ["adversary_attorney", "adversary_attorney_name"])));
  put(resolved, "{{lawsuit.dateFiled}}", date(from(source, ["date_filed", "filed_at", "indexed_at"])));
  put(resolved, "{{lawsuit.amount}}", rows.length > 1 ? money(sum(rows, ["claim_amount", "amount", "billed_amount"])) : money(from(source, ["lawsuit_amount", "claim_amount", "amount"])));
  put(resolved, "{{lawsuit.costs}}", money(from(source, ["lawsuit_costs", "costs_total", "cost_total"])));
  put(resolved, "{{lawsuit.paymentsPosted}}", rows.length > 1 ? money(sum(rows, ["payment_amount", "payment_voluntary", "payments"])) : money(from(source, ["payment_amount", "payment_voluntary", "payments"])));
  put(resolved, "{{lawsuit.balance}}", rows.length > 1 ? money(sum(rows, ["balance_amount", "balance_presuit", "balance"])) : money(from(source, ["lawsuit_balance", "balance_amount", "balance_presuit", "balance"])));

  put(resolved, "{{cost.indexFee}}", money(from(source, ["index_fee", "filing_fee"])));
  put(resolved, "{{cost.serviceFee}}", money(from(source, ["service_fee"])));
  put(resolved, "{{cost.otherCourtCosts}}", money(from(source, ["other_court_costs", "other_costs"])));
  const costTotal = sum([source || {}], ["index_fee", "filing_fee"]) + sum([source || {}], ["service_fee"]) + sum([source || {}], ["other_court_costs", "other_costs"]);
  if (costTotal > 0) put(resolved, "{{cost.total}}", money(costTotal));

  const fallback = FALLBACKS[matterKey] || {};
  for (const token of ALLOWED_TOKENS) {
    if (!resolved[token] && fallback[token]) resolved[token] = fallback[token];
  }
  for (const token of ALLOWED_TOKENS) {
    if (!resolved[token]) resolved[token] = "";
  }

  return { matterKey, resolved, diagnostics };
}
